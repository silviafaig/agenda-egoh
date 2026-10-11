-- Arreglo 1: la reserva fallaba en Supabase (función de azar en otro esquema). Pegar en SQL Editor → Run.
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


grant execute on function reservar(text, jsonb) to anon, authenticated;
