-- Agenda Showroom · instalación completa. Pegar todo en Supabase → SQL Editor → Run.
-- Agenda Showroom · base de datos (Supabase / Postgres)
-- Multi-showroom: cada fila pertenece a un showroom. Las clientas reservan por funciones
-- seguras (no leen datos de otras clientas); el panel lo usan las personas autorizadas
-- de cada showroom (tabla miembros, por email).

create extension if not exists pgcrypto;

/* ---------------- tablas ---------------- */
create table if not exists showrooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  config jsonb not null default '{}'::jsonb,
  creado timestamptz not null default now()
);

create table if not exists miembros (
  showroom_id uuid not null references showrooms(id) on delete cascade,
  email text not null,
  rol text not null default 'editora' check (rol in ('duena', 'editora')),
  nombre text not null default '',
  primary key (showroom_id, email)
);

create table if not exists productos (
  showroom_id uuid not null references showrooms(id) on delete cascade,
  id text not null,
  orden int not null default 0,
  data jsonb not null,
  primary key (showroom_id, id)
);

create table if not exists clientas (
  showroom_id uuid not null references showrooms(id) on delete cascade,
  id text not null,
  whatsapp text not null,
  data jsonb not null,
  primary key (showroom_id, id),
  unique (showroom_id, whatsapp)
);

create table if not exists citas (
  showroom_id uuid not null references showrooms(id) on delete cascade,
  id text not null,
  fecha date not null,
  hora text not null check (hora ~ '^\d{2}:\d{2}$'),
  estado text not null default 'confirmada' check (estado in ('confirmada', 'asistio', 'no_vino', 'cancelada')),
  tipo text not null check (tipo in ('presencial', 'video')),
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  data jsonb not null,
  primary key (showroom_id, id)
);
create index if not exists citas_fecha on citas (showroom_id, fecha);

create table if not exists bloqueos (
  showroom_id uuid not null references showrooms(id) on delete cascade,
  id text not null,
  fecha date not null,
  data jsonb not null,
  primary key (showroom_id, id)
);

/* ---------------- permisos (RLS) ---------------- */
alter table showrooms enable row level security;
alter table miembros enable row level security;
alter table productos enable row level security;
alter table clientas enable row level security;
alter table citas enable row level security;
alter table bloqueos enable row level security;

-- ¿La persona logueada pertenece a este showroom?
create or replace function es_miembro(p_showroom uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros m
    where m.showroom_id = p_showroom and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
create or replace function es_duena(p_showroom uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros m
    where m.showroom_id = p_showroom and m.rol = 'duena' and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

drop policy if exists showrooms_leer on showrooms;
create policy showrooms_leer on showrooms for select using (true);
drop policy if exists showrooms_editar on showrooms;
create policy showrooms_editar on showrooms for update to authenticated using (es_miembro(id)) with check (es_miembro(id));

drop policy if exists miembros_leer on miembros;
create policy miembros_leer on miembros for select to authenticated using (es_miembro(showroom_id));
drop policy if exists miembros_alta on miembros;
create policy miembros_alta on miembros for insert to authenticated with check (es_duena(showroom_id));
drop policy if exists miembros_baja on miembros;
create policy miembros_baja on miembros for delete to authenticated using (es_duena(showroom_id) and lower(email) <> lower(auth.jwt() ->> 'email'));

drop policy if exists productos_leer on productos;
create policy productos_leer on productos for select using (true);
drop policy if exists productos_editar on productos;
create policy productos_editar on productos for all to authenticated using (es_miembro(showroom_id)) with check (es_miembro(showroom_id));

drop policy if exists clientas_panel on clientas;
create policy clientas_panel on clientas for all to authenticated using (es_miembro(showroom_id)) with check (es_miembro(showroom_id));
drop policy if exists citas_panel on citas;
create policy citas_panel on citas for all to authenticated using (es_miembro(showroom_id)) with check (es_miembro(showroom_id));
drop policy if exists bloqueos_panel on bloqueos;
create policy bloqueos_panel on bloqueos for all to authenticated using (es_miembro(showroom_id)) with check (es_miembro(showroom_id));

/* ---------------- disponibilidad (misma regla que la app) ---------------- */
create or replace function hoy_ar() returns timestamp language sql stable as $$
  select now() at time zone 'America/Argentina/Buenos_Aires';
$$;
create or replace function a_min(h text) returns int language sql immutable as $$
  select split_part(h, ':', 1)::int * 60 + split_part(h, ':', 2)::int;
$$;

-- Devuelve null si el horario se puede reservar, o el motivo si no.
create or replace function motivo_no_disponible(p_showroom uuid, p_fecha date, p_hora text, p_ignorar text default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb; dur int; m int; franjas jsonb; esp jsonb; f jsonb; ok boolean := false; ahora timestamp := hoy_ar();
begin
  select config into cfg from showrooms where id = p_showroom;
  if cfg is null then return 'showroom'; end if;
  dur := coalesce((cfg ->> 'duracion')::int, 30);
  m := a_min(p_hora);
  if p_fecha < ahora::date or (p_fecha = ahora::date and m <= extract(hour from ahora)::int * 60 + extract(minute from ahora)::int) then
    return 'pasado';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(cfg -> 'feriados', '[]')) x
             where p_fecha between (x ->> 'desde')::date and coalesce(nullif(x ->> 'hasta', ''), x ->> 'desde')::date) then
    return 'feriado';
  end if;
  select x into esp from jsonb_array_elements(coalesce(cfg -> 'fechasEspeciales', '[]')) x where x ->> 'fecha' = p_fecha::text limit 1;
  if esp is not null then
    franjas := esp -> 'franjas';
  else
    if not (coalesce(cfg -> 'dias', '[]') @> to_jsonb(extract(dow from p_fecha)::int)) then return 'cerrado'; end if;
    franjas := coalesce(cfg -> 'franjas', '[]');
  end if;
  for f in select * from jsonb_array_elements(franjas) loop
    if m >= a_min(f ->> 0) and m + dur <= a_min(f ->> 1) and (m - a_min(f ->> 0)) % dur = 0 then ok := true; end if;
  end loop;
  if not ok then return 'fuera_de_horario'; end if;
  if exists (select 1 from citas c where c.showroom_id = p_showroom and c.fecha = p_fecha and c.estado <> 'cancelada'
             and c.id is distinct from p_ignorar and a_min(c.hora) < m + dur and m < a_min(c.hora) + dur) then
    return 'ocupado';
  end if;
  if exists (select 1 from bloqueos b where b.showroom_id = p_showroom and b.fecha = p_fecha
             and (coalesce(b.data ->> 'desde', '') = '' or (a_min(b.data ->> 'desde') < m + dur and m < a_min(b.data ->> 'hasta')))) then
    return 'bloqueado';
  end if;
  return null;
end $$;

/* ---------------- funciones públicas (clientas) ---------------- */
-- Horarios tomados, sin datos personales.
create or replace function ocupados(p_slug text, p_desde date, p_hasta date)
returns table (id text, fecha date, hora text, estado text, desde text, hasta text, es_bloqueo boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.fecha, c.hora, c.estado, null, null, false from citas c join showrooms s on s.id = c.showroom_id
    where s.slug = p_slug and c.fecha between p_desde and p_hasta and c.estado <> 'cancelada'
  union all
  select b.id, b.fecha, null, null, nullif(b.data ->> 'desde', ''), nullif(b.data ->> 'hasta', ''), true from bloqueos b join showrooms s on s.id = b.showroom_id
    where s.slug = p_slug and b.fecha between p_desde and p_hasta;
$$;

-- Reserva de una clienta. p jsonb: fecha, hora, tipo, nombre, whatsapp, email, zona, comoCompra, queBusca, prendas[]
create or replace function reservar(p_slug text, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  sid uuid; motivo text; wa text; cid text; nueva_id text := left(replace(gen_random_uuid()::text, '-', ''), 12); tok text := replace(gen_random_uuid()::text, '-', '');
  sala text; datos jsonb; fecha date := (p ->> 'fecha')::date; prendas jsonb;
begin
  select id into sid from showrooms where slug = p_slug;
  if sid is null then raise exception 'showroom inexistente'; end if;
  perform pg_advisory_xact_lock(hashtext(sid::text || fecha::text));
  wa := regexp_replace(coalesce(p ->> 'whatsapp', ''), '\D', '', 'g');
  if length(wa) < 8 or length(wa) > 15 then raise exception 'whatsapp invalido'; end if;
  if length(trim(coalesce(p ->> 'nombre', ''))) < 2 then raise exception 'nombre invalido'; end if;
  if coalesce(p ->> 'tipo', '') not in ('presencial', 'video') then raise exception 'tipo invalido'; end if;
  motivo := motivo_no_disponible(sid, fecha, p ->> 'hora');
  if motivo is not null then return jsonb_build_object('error', motivo); end if;
  -- prendas: solo id, nombre, talle (máx. 40)
  select coalesce(jsonb_agg(jsonb_build_object('id', left(x ->> 'id', 80), 'nombre', left(x ->> 'nombre', 120), 'talle', left(x ->> 'talle', 10), 'seLlevo', null)), '[]')
    into prendas from (select x from jsonb_array_elements(coalesce(p -> 'prendas', '[]')) x limit 40) t;
  datos := jsonb_build_object('nombre', left(trim(p ->> 'nombre'), 80), 'email', left(trim(coalesce(p ->> 'email', '')), 120),
    'zona', left(trim(coalesce(p ->> 'zona', '')), 80), 'comoCompra', left(coalesce(p ->> 'comoCompra', ''), 40));
  -- clienta: se identifica por WhatsApp; los datos nuevos completan, las notas no se tocan
  select id into cid from clientas where showroom_id = sid and whatsapp = wa;
  if cid is null then
    cid := 'c-' || left(replace(gen_random_uuid()::text, '-', ''), 10);
    insert into clientas (showroom_id, id, whatsapp, data)
      values (sid, cid, wa, datos || jsonb_build_object('id', cid, 'whatsapp', wa, 'notas', '', 'creada', now()));
  else
    update clientas set data = data || jsonb_strip_nulls(jsonb_build_object(
        'nombre', nullif(datos ->> 'nombre', ''), 'email', nullif(datos ->> 'email', ''),
        'zona', nullif(datos ->> 'zona', ''), 'comoCompra', nullif(datos ->> 'comoCompra', '')))
      where showroom_id = sid and id = cid;
  end if;
  if p ->> 'tipo' = 'video' then sala := 'showroom-' || left(replace(gen_random_uuid()::text, '-', ''), 14); end if;
  insert into citas (showroom_id, id, fecha, hora, estado, tipo, token, data) values (sid, nueva_id, fecha, p ->> 'hora', 'confirmada', p ->> 'tipo', tok,
    datos || jsonb_build_object('whatsapp', wa, 'queBusca', left(coalesce(p ->> 'queBusca', ''), 500), 'prendas', prendas,
      'notas', '', 'sala', sala, 'creada', now(), 'clientaId', cid, 'origen', 'clienta'));
  return jsonb_build_object('id', nueva_id, 'token', tok, 'sala', sala);
end $$;

-- Página de la cita (link del recordatorio): ver, cancelar, reprogramar.
create or replace function ver_cita(p_id text, p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'fecha', c.fecha, 'hora', c.hora, 'tipo', c.tipo, 'estado', c.estado,
      'nombre', split_part(c.data ->> 'nombre', ' ', 1), 'sala', c.data ->> 'sala', 'slug', s.slug)
    from citas c join showrooms s on s.id = c.showroom_id where c.id = p_id and c.token = p_token;
$$;

create or replace function cancelar_cita(p_id text, p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  update citas set estado = 'cancelada' where id = p_id and token = p_token and estado = 'confirmada';
  if not found then return jsonb_build_object('error', 'no_encontrada'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function reprogramar_cita(p_id text, p_token text, p_fecha date, p_hora text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c citas; motivo text;
begin
  select * into c from citas where id = p_id and token = p_token and estado = 'confirmada';
  if c.id is null then return jsonb_build_object('error', 'no_encontrada'); end if;
  perform pg_advisory_xact_lock(hashtext(c.showroom_id::text || p_fecha::text));
  motivo := motivo_no_disponible(c.showroom_id, p_fecha, p_hora, c.id);
  if motivo is not null then return jsonb_build_object('error', motivo); end if;
  update citas set fecha = p_fecha, hora = p_hora where showroom_id = c.showroom_id and id = c.id;
  return jsonb_build_object('ok', true);
end $$;

-- Para el panel: a qué showroom(s) pertenece la persona logueada.
create or replace function mis_showrooms() returns table (id uuid, slug text, rol text, nombre text)
language sql stable security definer set search_path = public as $$
  select s.id, s.slug, m.rol, m.nombre from miembros m join showrooms s on s.id = m.showroom_id
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

revoke all on function motivo_no_disponible(uuid, date, text, text) from public;
grant execute on function ocupados(text, date, date), reservar(text, jsonb), ver_cita(text, text),
  cancelar_cita(text, text), reprogramar_cita(text, text, date, text) to anon, authenticated;
grant execute on function mis_showrooms(), es_miembro(uuid), es_duena(uuid) to authenticated;

-- Permisos explícitos sobre las tablas (las filas las filtra RLS).
grant usage on schema public to anon, authenticated;
grant select on showrooms, productos to anon;
grant select, update on showrooms to authenticated;
grant select, insert, update, delete on miembros, productos, clientas, citas, bloqueos to authenticated;

-- Fotos de prendas, logo y portada (Supabase Storage). Carpeta = id del showroom.
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true)
  on conflict (id) do update set public = true;

drop policy if exists fotos_subir on storage.objects;
create policy fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists fotos_cambiar on storage.objects;
create policy fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
drop policy if exists fotos_borrar on storage.objects;
create policy fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));


/* ---------------- datos iniciales: EGOH ---------------- */
insert into showrooms (slug, config) values ('egoh', $j${"nombre":"EGOH","direccion":"Av. Federico Lacroze 2911 PB A, Colegiales","info":"La visita es únicamente con cita previa y dura como máximo 30 minutos. Elegí antes las prendas que querés ver así las tenemos listas.","dias":[1,2,3,4,5],"franjas":[["11:30","13:00"],["14:00","16:30"]],"duracion":30,"compraMinima":40000,"compraMinimaNota":"por tiempo limitado","feriados":[],"fechasEspeciales":[],"opcionesComoCompra":["1ra compra","Emprendimiento","Revendedora","Comercio","Uso personal"],"saludoNombre":"Sil","logo":"","portada":""}$j$::jsonb) on conflict (slug) do nothing;
insert into miembros (showroom_id, email, rol, nombre)
  select id, 'ventas.egoh@gmail.com', 'duena', 'Sil' from showrooms where slug = 'egoh' on conflict do nothing;
insert into productos (showroom_id, id, orden, data)
  select s.id, p.id, p.orden, p.data from showrooms s, (values
    ('bikini-cala-black', 0, $j${"id":"bikini-cala-black","nombre":"Bikini Cala Black","modelo":"Cala","color":"Black","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-cala-black.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-cala-malbec', 1, $j${"id":"bikini-cala-malbec","nombre":"Bikini Cala Malbec","modelo":"Cala","color":"Malbec","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-cala-malbec.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-cala-moka', 2, $j${"id":"bikini-cala-moka","nombre":"Bikini Cala Moka","modelo":"Cala","color":"Moka","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-cala-moka.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-cala-navy-blue', 3, $j${"id":"bikini-cala-navy-blue","nombre":"Bikini Cala Navy Blue","modelo":"Cala","color":"Navy Blue","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-cala-navy-blue.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-cala-olive', 4, $j${"id":"bikini-cala-olive","nombre":"Bikini Cala Olive","modelo":"Cala","color":"Olive","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-cala-olive.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-dolce-cream-botanic', 5, $j${"id":"bikini-dolce-cream-botanic","nombre":"Bikini Dolce Cream Botanic","modelo":"Dolce","color":"Cream Botanic","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-dolce-cream-botanic.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-dolce-lemon-botanic', 6, $j${"id":"bikini-dolce-lemon-botanic","nombre":"Bikini Dolce Lemon Botanic","modelo":"Dolce","color":"Lemon Botanic","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-dolce-lemon-botanic.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-dolce-malbec', 7, $j${"id":"bikini-dolce-malbec","nombre":"Bikini Dolce Malbec","modelo":"Dolce","color":"Malbec","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-dolce-malbec.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-dolce-moka', 8, $j${"id":"bikini-dolce-moka","nombre":"Bikini Dolce Moka","modelo":"Dolce","color":"Moka","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-dolce-moka.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-dolce-navy-blue', 9, $j${"id":"bikini-dolce-navy-blue","nombre":"Bikini Dolce Navy Blue","modelo":"Dolce","color":"Navy Blue","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-dolce-navy-blue.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-luce-cream-botanic', 10, $j${"id":"bikini-luce-cream-botanic","nombre":"Bikini Luce Cream Botanic","modelo":"Luce","color":"Cream Botanic","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-luce-cream-botanic.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-luce-lemon-botanic', 11, $j${"id":"bikini-luce-lemon-botanic","nombre":"Bikini Luce Lemon Botanic","modelo":"Luce","color":"Lemon Botanic","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-luce-lemon-botanic.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-luce-moka-botanic', 12, $j${"id":"bikini-luce-moka-botanic","nombre":"Bikini Luce Moka Botanic","modelo":"Luce","color":"Moka Botanic","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-luce-moka-botanic.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-mare-black', 13, $j${"id":"bikini-mare-black","nombre":"Bikini Mare Black","modelo":"Mare","color":"Black","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-mare-black.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-mare-malbec', 14, $j${"id":"bikini-mare-malbec","nombre":"Bikini Mare Malbec","modelo":"Mare","color":"Malbec","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-mare-malbec.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-mare-moka', 15, $j${"id":"bikini-mare-moka","nombre":"Bikini Mare Moka","modelo":"Mare","color":"Moka","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-mare-moka.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-mare-navy-blue', 16, $j${"id":"bikini-mare-navy-blue","nombre":"Bikini Mare Navy Blue","modelo":"Mare","color":"Navy Blue","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-mare-navy-blue.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-mare-olive', 17, $j${"id":"bikini-mare-olive","nombre":"Bikini Mare Olive","modelo":"Mare","color":"Olive","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-mare-olive.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-pietra-black', 18, $j${"id":"bikini-pietra-black","nombre":"Bikini Pietra Black","modelo":"Pietra","color":"Black","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-pietra-black.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-pietra-malbec', 19, $j${"id":"bikini-pietra-malbec","nombre":"Bikini Pietra Malbec","modelo":"Pietra","color":"Malbec","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-pietra-malbec.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-pietra-moka', 20, $j${"id":"bikini-pietra-moka","nombre":"Bikini Pietra Moka","modelo":"Pietra","color":"Moka","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-pietra-moka.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-pietra-olive', 21, $j${"id":"bikini-pietra-olive","nombre":"Bikini Pietra Olive","modelo":"Pietra","color":"Olive","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-pietra-olive.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-reversible-vela-malbec-black', 22, $j${"id":"bikini-reversible-vela-malbec-black","nombre":"Bikini Reversible Vela Malbec / Black","modelo":"Reversible Vela","color":"Malbec / Black","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-reversible-vela-malbec-black.jpg","fotoNum":2}$j$::jsonb),
    ('bikini-reversible-vela-moka-cream', 23, $j${"id":"bikini-reversible-vela-moka-cream","nombre":"Bikini Reversible Vela Moka / Cream","modelo":"Reversible Vela","color":"Moka / Cream","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-reversible-vela-moka-cream.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-sole-moka-botanic', 24, $j${"id":"bikini-sole-moka-botanic","nombre":"Bikini Sole Moka Botanic","modelo":"Sole","color":"Moka Botanic","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-sole-moka-botanic.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-sole-navy-blue', 25, $j${"id":"bikini-sole-navy-blue","nombre":"Bikini Sole Navy Blue","modelo":"Sole","color":"Navy Blue","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-sole-navy-blue.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-sole-olive', 26, $j${"id":"bikini-sole-olive","nombre":"Bikini Sole Olive","modelo":"Sole","color":"Olive","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-sole-olive.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-tropea-black-cream', 27, $j${"id":"bikini-tropea-black-cream","nombre":"Bikini Tropea Black / Cream","modelo":"Tropea","color":"Black / Cream","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-tropea-black-cream.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-tropea-malbec-cream', 28, $j${"id":"bikini-tropea-malbec-cream","nombre":"Bikini Tropea Malbec / Cream","modelo":"Tropea","color":"Malbec / Cream","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-tropea-malbec-cream.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-tropea-navy-blue-cream', 29, $j${"id":"bikini-tropea-navy-blue-cream","nombre":"Bikini Tropea Navy Blue / Cream","modelo":"Tropea","color":"Navy Blue / Cream","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-tropea-navy-blue-cream.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-vita-cream-botanic', 30, $j${"id":"bikini-vita-cream-botanic","nombre":"Bikini Vita Cream Botanic","modelo":"Vita","color":"Cream Botanic","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-vita-cream-botanic.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-vita-lemon-botanic', 31, $j${"id":"bikini-vita-lemon-botanic","nombre":"Bikini Vita Lemon Botanic","modelo":"Vita","color":"Lemon Botanic","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-vita-lemon-botanic.jpg","fotoNum":1}$j$::jsonb),
    ('bikini-vita-moka-botanic', 32, $j${"id":"bikini-vita-moka-botanic","nombre":"Bikini Vita Moka Botanic","modelo":"Vita","color":"Moka Botanic","categoria":"Bikinis SS27","precio":0,"talles":["1","2","3","4","5","6"],"foto":"fotos/bikini-vita-moka-botanic.jpg","fotoNum":1}$j$::jsonb)
  ) as p(id, orden, data) where s.slug = 'egoh' on conflict do nothing;
