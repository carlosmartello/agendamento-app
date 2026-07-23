CREATE OR REPLACE FUNCTION public.search_appointments_by_name(_name text)
RETURNS TABLE(
  id uuid,
  client_name text,
  scheduled_at timestamptz,
  status appointment_status,
  service_name text,
  duration_min integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.client_name, a.scheduled_at, a.status, s.name, s.duration_min
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE length(btrim(_name)) >= 3
    AND lower(a.client_name) = lower(btrim(_name))
  ORDER BY a.scheduled_at DESC
  LIMIT 20
$$;

GRANT EXECUTE ON FUNCTION public.search_appointments_by_name(text) TO anon, authenticated;