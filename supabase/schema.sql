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
  token text not null default encode(gen_random_bytes(12), 'hex'),
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
  sid uuid; motivo text; wa text; cid text; nueva_id text := encode(gen_random_bytes(6), 'hex'); tok text := encode(gen_random_bytes(12), 'hex');
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
    cid := 'c-' || encode(gen_random_bytes(5), 'hex');
    insert into clientas (showroom_id, id, whatsapp, data)
      values (sid, cid, wa, datos || jsonb_build_object('id', cid, 'whatsapp', wa, 'notas', '', 'creada', now()));
  else
    update clientas set data = data || jsonb_strip_nulls(jsonb_build_object(
        'nombre', nullif(datos ->> 'nombre', ''), 'email', nullif(datos ->> 'email', ''),
        'zona', nullif(datos ->> 'zona', ''), 'comoCompra', nullif(datos ->> 'comoCompra', '')))
      where showroom_id = sid and id = cid;
  end if;
  if p ->> 'tipo' = 'video' then sala := 'showroom-' || encode(gen_random_bytes(7), 'hex'); end if;
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
