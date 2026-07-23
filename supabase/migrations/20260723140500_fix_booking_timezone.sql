DROP FUNCTION IF EXISTS public.get_booked_slots(date);

CREATE FUNCTION public.get_booked_slots(_date date)
RETURNS TABLE (
  scheduled_at timestamptz,
  duration_min integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.scheduled_at,
    COALESCE(a.duration_min, s.duration_min, 30) AS duration_min
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE a.status <> 'cancelled'
    AND (a.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = _date
$$;

DROP FUNCTION IF EXISTS public.create_public_appointment(text, text, uuid, uuid[], timestamptz, text);

CREATE FUNCTION public.create_public_appointment(
  _client_name text,
  _client_phone text,
  _service_id uuid,
  _service_ids uuid[],
  _scheduled_at timestamptz,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := gen_random_uuid();
  normalized_service_ids uuid[];
  total_duration integer;
  new_end timestamptz;
  local_start timestamp;
  local_end timestamp;
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT service_id
    FROM unnest(COALESCE(_service_ids, ARRAY[_service_id])) AS service_id
  )
  INTO normalized_service_ids;

  IF NOT (_service_id = ANY(normalized_service_ids)) THEN
    normalized_service_ids := ARRAY[_service_id] || normalized_service_ids;
  END IF;

  SELECT SUM(duration_min)::integer
  INTO total_duration
  FROM public.services
  WHERE id = ANY(normalized_service_ids)
    AND active = true;

  IF total_duration IS NULL OR total_duration <= 0 THEN
    RAISE EXCEPTION 'Servico invalido ou indisponivel';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.services
    WHERE id = ANY(normalized_service_ids)
      AND active = true
  ) <> cardinality(normalized_service_ids) THEN
    RAISE EXCEPTION 'Um ou mais servicos sao invalidos ou indisponiveis';
  END IF;

  new_end := _scheduled_at + make_interval(mins => total_duration);
  local_start := _scheduled_at AT TIME ZONE 'America/Sao_Paulo';
  local_end := new_end AT TIME ZONE 'America/Sao_Paulo';

  IF local_end::date <> local_start::date OR local_end::time > time '18:00' THEN
    RAISE EXCEPTION 'Este servico nao cabe no horario de funcionamento';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.services s ON s.id = a.service_id
    WHERE a.status <> 'cancelled'
      AND _scheduled_at < a.scheduled_at + make_interval(mins => COALESCE(a.duration_min, s.duration_min))
      AND a.scheduled_at < new_end
  ) THEN
    RAISE EXCEPTION 'Este horario conflita com outro agendamento';
  END IF;

  INSERT INTO public.appointments (
    id,
    client_name,
    client_phone,
    service_id,
    scheduled_at,
    duration_min,
    notes
  )
  VALUES (
    new_id,
    btrim(_client_name),
    btrim(_client_phone),
    _service_id,
    _scheduled_at,
    total_duration,
    NULLIF(btrim(COALESCE(_notes, '')), '')
  );

  INSERT INTO public.appointment_services (appointment_id, service_id, position)
  SELECT new_id, service_id, ordinality::integer - 1
  FROM unnest(normalized_service_ids) WITH ORDINALITY AS selected(service_id, ordinality);

  RETURN new_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(text, text, uuid, uuid[], timestamptz, text)
  TO anon, authenticated;
