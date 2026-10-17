-- Arreglo 4: guardar el consentimiento (Política de privacidad y Términos).
-- Pegar en Supabase → SQL Editor → Run, DESPUÉS del arreglo 3. No borra ni cambia datos.
-- · reservar: guarda en la cita qué versión de la política aceptó la clienta y cuándo (si la página la manda).
--   La agenda actual (sin casilla) sigue funcionando igual.
-- · crear_showroom: pide aceptar los Términos y guarda versión, fecha y email en la configuración del showroom.

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
      'notas', '', 'sala', sala, 'creada', now(), 'clientaId', cid, 'origen', 'clienta')
      || case when coalesce(p ->> 'consentimiento', '') <> ''
           then jsonb_build_object('consentimiento', jsonb_build_object('version', left(p ->> 'consentimiento', 20), 'fecha', now()))
           else '{}'::jsonb end);
  return jsonb_build_object('id', nueva_id, 'token', tok, 'sala', sala);
end $$;
grant execute on function reservar(text, jsonb) to anon, authenticated;

drop function if exists crear_showroom(text, text, text, text);
create or replace function crear_showroom(p_codigo text, p_slug text, p_nombre text, p_tu_nombre text default '', p_acepto text default '')
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
  if coalesce(p_acepto, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Para crear tu agenda, aceptá los Términos y la Política de privacidad.');
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
    values (v_slug, jsonb_build_object('nombre', v_nombre, 'saludoNombre', v_yo,
      'terminosAceptados', jsonb_build_object('version', left(p_acepto, 20), 'fecha', now(), 'email', v_email)))
    returning id into sid;
  insert into miembros (showroom_id, email, rol, nombre) values (sid, v_email, 'duena', v_yo);
  update invitaciones set usada = now(), showroom_id = sid where codigo = inv.codigo;
  return jsonb_build_object('ok', true, 'slug', v_slug);
end $$;
revoke all on function crear_showroom(text, text, text, text, text) from public;
grant execute on function crear_showroom(text, text, text, text, text) to authenticated;
