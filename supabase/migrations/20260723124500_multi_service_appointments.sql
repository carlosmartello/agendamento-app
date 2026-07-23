ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS duration_min integer;

CREATE TABLE IF NOT EXISTS public.appointment_services (
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (appointment_id, service_id)
);

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.appointment_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.appointment_services TO authenticated;
GRANT ALL ON public.appointment_services TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointment_services'
      AND policyname = 'Appointment services readable by everyone'
  ) THEN
    CREATE POLICY "Appointment services readable by everyone"
      ON public.appointment_services FOR SELECT USING (true);
  END IF;
END $$;

INSERT INTO public.appointment_services (appointment_id, service_id, position)
SELECT id, service_id, 0
FROM public.appointments
ON CONFLICT (appointment_id, service_id) DO NOTHING;

UPDATE public.appointments a
SET duration_min = s.duration_min
FROM public.services s
WHERE s.id = a.service_id
  AND a.duration_min IS NULL;

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
    AND a.scheduled_at >= _date::timestamptz
    AND a.scheduled_at < (_date + INTERVAL '1 day')::timestamptz
$$;

DROP FUNCTION IF EXISTS public.create_public_appointment(text, text, uuid, timestamptz, text);
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

  IF new_end::time > time '18:00' THEN
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

CREATE OR REPLACE FUNCTION public.get_appointment_confirmation(_id uuid)
RETURNS TABLE (
  id uuid,
  client_name text,
  scheduled_at timestamptz,
  status public.appointment_status,
  service_name text,
  duration_min integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.client_name,
    a.scheduled_at,
    a.status,
    COALESCE(string_agg(s.name, ' + ' ORDER BY aps.position), primary_service.name) AS service_name,
    COALESCE(a.duration_min, primary_service.duration_min)
  FROM public.appointments a
  JOIN public.services primary_service ON primary_service.id = a.service_id
  LEFT JOIN public.appointment_services aps ON aps.appointment_id = a.id
  LEFT JOIN public.services s ON s.id = aps.service_id
  WHERE a.id = _id
  GROUP BY a.id, primary_service.name, primary_service.duration_min
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(text, text, uuid, uuid[], timestamptz, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_confirmation(uuid) TO anon, authenticated;
