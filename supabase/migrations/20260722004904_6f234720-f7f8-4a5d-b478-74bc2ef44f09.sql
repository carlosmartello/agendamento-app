CREATE OR REPLACE FUNCTION public.search_appointments_by_name(_name text)
 RETURNS TABLE(id uuid, client_name text, scheduled_at timestamp with time zone, status appointment_status, service_name text, duration_min integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id, a.client_name, a.scheduled_at, a.status, s.name, s.duration_min
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE length(btrim(_name)) >= 3
    AND a.client_name ILIKE '%' || btrim(_name) || '%'
  ORDER BY a.scheduled_at DESC
  LIMIT 50
$function$;