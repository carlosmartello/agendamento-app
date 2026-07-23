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
  SELECT a.scheduled_at, s.duration_min
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE a.status <> 'cancelled'
    AND a.scheduled_at >= _date::timestamptz
    AND a.scheduled_at < (_date + INTERVAL '1 day')::timestamptz
$$;

CREATE OR REPLACE FUNCTION public.create_public_appointment(
  _client_name text,
  _client_phone text,
  _service_id uuid,
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
  service_duration integer;
  new_end timestamptz;
BEGIN
  SELECT duration_min
  INTO service_duration
  FROM public.services
  WHERE id = _service_id AND active = true;

  IF service_duration IS NULL THEN
    RAISE EXCEPTION 'Servico invalido ou indisponivel';
  END IF;

  new_end := _scheduled_at + make_interval(mins => service_duration);

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.services s ON s.id = a.service_id
    WHERE a.status <> 'cancelled'
      AND _scheduled_at < a.scheduled_at + make_interval(mins => s.duration_min)
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
    notes
  )
  VALUES (
    new_id,
    btrim(_client_name),
    btrim(_client_phone),
    _service_id,
    _scheduled_at,
    NULLIF(btrim(COALESCE(_notes, '')), '')
  );

  RETURN new_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(text, text, uuid, timestamptz, text)
  TO anon, authenticated;
