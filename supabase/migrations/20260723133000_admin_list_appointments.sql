CREATE OR REPLACE FUNCTION public.admin_list_appointments(_date date DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  client_name text,
  client_phone text,
  scheduled_at timestamptz,
  status public.appointment_status,
  notes text,
  created_at timestamptz,
  service_name text,
  duration_min integer,
  price_cents integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.client_name,
    a.client_phone,
    a.scheduled_at,
    a.status,
    a.notes,
    a.created_at,
    COALESCE(string_agg(s.name, ' + ' ORDER BY aps.position), primary_service.name) AS service_name,
    COALESCE(a.duration_min, primary_service.duration_min) AS duration_min,
    COALESCE(SUM(s.price_cents)::integer, primary_service.price_cents) AS price_cents
  FROM public.appointments a
  JOIN public.services primary_service ON primary_service.id = a.service_id
  LEFT JOIN public.appointment_services aps ON aps.appointment_id = a.id
  LEFT JOIN public.services s ON s.id = aps.service_id
  WHERE public.has_role(auth.uid(), 'admin')
    AND (
      _date IS NULL
      OR (
        a.scheduled_at >= _date::timestamptz
        AND a.scheduled_at < (_date + INTERVAL '1 day')::timestamptz
      )
    )
  GROUP BY a.id, primary_service.name, primary_service.duration_min, primary_service.price_cents
  ORDER BY a.scheduled_at ASC
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_appointments(date) TO authenticated;
