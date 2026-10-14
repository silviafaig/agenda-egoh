-- Arreglo 3: alta de showrooms con código de invitación.
-- Pegar en Supabase → SQL Editor → Run. Se puede correr más de una vez. No toca los datos de EGOH.

-- Códigos de invitación: nadie los lee directo (sin políticas); solo las funciones de abajo.
create table if not exists invitaciones (
  codigo text primary key,
  nota text not null default '',
  creada timestamptz not null default now(),
  usada timestamptz,
  showroom_id uuid references showrooms(id) on delete set null
);
alter table invitaciones enable row level security;

-- ¿Ese link (slug) está libre? Lo usa el formulario de alta mientras se escribe.
create or replace function slug_disponible(p_slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_slug, '') ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$'
    and p_slug not in ('admin', 'alta', 'panel', 'reservar', 'cita', 'www', 'app', 'api', 'turnos', 'soporte', 'ayuda', 'demo', 'test')
    and not exists (select 1 from showrooms where slug = p_slug);
$$;

-- Crea el showroom de la persona logueada (email ya confirmado) con un código sin usar.
create or replace function crear_showroom(p_codigo text, p_slug text, p_nombre text, p_tu_nombre text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_yo text := trim(coalesce(p_tu_nombre, ''));
  inv invitaciones;
  sid uuid;
begin
  if auth.uid() is null or v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'Iniciá sesión para crear tu agenda.');
  end if;
  if length(v_nombre) < 2 or length(v_nombre) > 60 then
    return jsonb_build_object('ok', false, 'error', 'Escribí el nombre de tu showroom.');
  end if;
  select * into inv from invitaciones where codigo = v_codigo for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'El código de invitación no es válido.');
  end if;
  if inv.usada is not null then
    return jsonb_build_object('ok', false, 'error', 'Ese código de invitación ya se usó.');
  end if;
  if not slug_disponible(v_slug) then
    return jsonb_build_object('ok', false, 'error', 'Ese link ya está en uso o no es válido. Probá con otro.');
  end if;
  insert into showrooms (slug, config)
    values (v_slug, jsonb_build_object('nombre', v_nombre, 'saludoNombre', v_yo))
    returning id into sid;
  insert into miembros (showroom_id, email, rol, nombre) values (sid, v_email, 'duena', v_yo);
  update invitaciones set usada = now(), showroom_id = sid where codigo = inv.codigo;
  return jsonb_build_object('ok', true, 'slug', v_slug);
end $$;

revoke all on function slug_disponible(text) from public;
revoke all on function crear_showroom(text, text, text, text) from public;
grant execute on function slug_disponible(text) to anon, authenticated;
grant execute on function crear_showroom(text, text, text, text) to authenticated;

-- Para crear un código nuevo (lo corre Sil): cambiá la nota por el nombre del showroom y tocá Run.
-- insert into invitaciones (codigo, nota) values (upper(substr(md5(random()::text), 1, 8)), 'Nombre del showroom') returning codigo;
-- Para ver los códigos y si se usaron:
-- select codigo, nota, creada, usada, (select slug from showrooms s where s.id = showroom_id) as showroom from invitaciones order by creada desc;
