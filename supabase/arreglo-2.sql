-- Arreglo 2: pausar reservas, anticipación mínima/máxima y límite para cancelar/reprogramar.
-- Pegar todo en Supabase → SQL Editor → Run. No borra ni cambia datos.

-- Número de la configuración del showroom; si falta, el mismo valor por defecto que usa la app (js/seed.js).
create or replace function num_cfg(cfg jsonb, k text) returns numeric language sql immutable as $$
  select case when cfg ? k then coalesce(nullif(cfg ->> k, '')::numeric, 0)
    else case k when 'anticipacionMinHoras' then 24 when 'anticipacionMaxDias' then 30 when 'cambiosMinHoras' then 24 else 0 end end;
$$;

-- Número de la configuración del showroom; si falta, el mismo valor por defecto que usa la app (js/seed.js).
create or replace function num_cfg(cfg jsonb, k text) returns numeric language sql immutable as $$
  select case when cfg ? k then coalesce(nullif(cfg ->> k, '')::numeric, 0)
    else case k when 'anticipacionMinHoras' then 24 when 'anticipacionMaxDias' then 30 when 'cambiosMinHoras' then 24 else 0 end end;
$$;
-- ¿La clienta todavía puede cancelar o reprogramar? (plazo en horas antes de la cita)
create or replace function en_plazo_cambio(p_showroom uuid, p_fecha date, p_hora text) returns boolean
language sql stable security definer set search_path = public as $$
  select num_cfg(s.config, 'cambiosMinHoras') <= 0
      or extract(epoch from (p_fecha::timestamp + make_interval(mins => a_min(p_hora)) - hoy_ar())) / 3600 >= num_cfg(s.config, 'cambiosMinHoras')
    from showrooms s where s.id = p_showroom;
$$;

-- Devuelve null si el horario se puede reservar, o el motivo si no.
create or replace function motivo_no_disponible(p_showroom uuid, p_fecha date, p_hora text, p_ignorar text default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb; dur int; m int; franjas jsonb; esp jsonb; f jsonb; ok boolean := false; ahora timestamp := hoy_ar();
begin
  select config into cfg from showrooms where id = p_showroom;
  if cfg is null then return 'showroom'; end if;
  if cfg ->> 'aceptaReservas' = 'false' then return 'pausado'; end if;
  dur := coalesce((cfg ->> 'duracion')::int, 30);
  m := a_min(p_hora);
  if p_fecha < ahora::date or (p_fecha = ahora::date and m <= extract(hour from ahora)::int * 60 + extract(minute from ahora)::int) then
    return 'pasado';
  end if;
  if extract(epoch from (p_fecha::timestamp + make_interval(mins => m) - ahora)) / 3600 < num_cfg(cfg, 'anticipacionMinHoras') then
    return 'muy_pronto';
  end if;
  if num_cfg(cfg, 'anticipacionMaxDias') > 0 and p_fecha > ahora::date + num_cfg(cfg, 'anticipacionMaxDias')::int then
    return 'muy_lejos';
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

-- Página de la cita (link del recordatorio): ver, cancelar, reprogramar.
create or replace function ver_cita(p_id text, p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'fecha', c.fecha, 'hora', c.hora, 'tipo', c.tipo, 'estado', c.estado,
      'nombre', split_part(c.data ->> 'nombre', ' ', 1), 'sala', c.data ->> 'sala', 'slug', s.slug,
      'reprogramaciones', coalesce((c.data ->> 'reprogramaciones')::int, 0))
    from citas c join showrooms s on s.id = c.showroom_id where c.id = p_id and c.token = p_token;
$$;

create or replace function cancelar_cita(p_id text, p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c citas;
begin
  select * into c from citas where id = p_id and token = p_token and estado = 'confirmada';
  if c.id is null then return jsonb_build_object('error', 'no_encontrada'); end if;
  if not en_plazo_cambio(c.showroom_id, c.fecha, c.hora) then return jsonb_build_object('error', 'fuera_de_plazo'); end if;
  update citas set estado = 'cancelada' where showroom_id = c.showroom_id and id = c.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function reprogramar_cita(p_id text, p_token text, p_fecha date, p_hora text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c citas; motivo text; maxr numeric; veces int;
begin
  select * into c from citas where id = p_id and token = p_token and estado = 'confirmada';
  if c.id is null then return jsonb_build_object('error', 'no_encontrada'); end if;
  if not en_plazo_cambio(c.showroom_id, c.fecha, c.hora) then return jsonb_build_object('error', 'fuera_de_plazo'); end if;
  select num_cfg(config, 'maxReprogramaciones') into maxr from showrooms where id = c.showroom_id;
  veces := coalesce((c.data ->> 'reprogramaciones')::int, 0);
  if maxr > 0 and veces >= maxr then return jsonb_build_object('error', 'limite_reprogramaciones'); end if;
  perform pg_advisory_xact_lock(hashtext(c.showroom_id::text || p_fecha::text));
  motivo := motivo_no_disponible(c.showroom_id, p_fecha, p_hora, c.id);
  if motivo is not null then return jsonb_build_object('error', motivo); end if;
  update citas set fecha = p_fecha, hora = p_hora, data = data || jsonb_build_object('reprogramaciones', veces + 1)
    where showroom_id = c.showroom_id and id = c.id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function en_plazo_cambio(uuid, date, text) from public;
