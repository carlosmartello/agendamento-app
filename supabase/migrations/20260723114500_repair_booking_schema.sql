DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'appointment_status'
  ) THEN
    CREATE TYPE public.appointment_status AS ENUM (
      'scheduled',
      'confirmed',
      'completed',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_min integer NOT NULL DEFAULT 30,
  price_cents integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_phone text NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_unique
  ON public.appointments (scheduled_at)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS appointments_scheduled_at_idx
  ON public.appointments (scheduled_at);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

GRANT SELECT, INSERT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_booked_slots(_date date)
RETURNS TABLE (scheduled_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.scheduled_at
  FROM public.appointments a
  WHERE a.status <> 'cancelled'
    AND a.scheduled_at >= _date::timestamptz
    AND a.scheduled_at < (_date + INTERVAL '1 day')::timestamptz
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
  SELECT a.id, a.client_name, a.scheduled_at, a.status, s.name, s.duration_min
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE a.id = _id
$$;

CREATE OR REPLACE FUNCTION public.search_appointments_by_name(_name text)
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
  SELECT a.id, a.client_name, a.scheduled_at, a.status, s.name, s.duration_min
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE length(btrim(_name)) >= 3
    AND a.client_name ILIKE '%' || btrim(_name) || '%'
  ORDER BY a.scheduled_at DESC
  LIMIT 50
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_appointment_confirmation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_appointments_by_name(text) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services'
      AND policyname = 'Services readable by everyone'
  ) THEN
    CREATE POLICY "Services readable by everyone"
      ON public.services FOR SELECT USING (active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointments'
      AND policyname = 'Anyone can create appointments'
  ) THEN
    CREATE POLICY "Anyone can create appointments"
      ON public.appointments FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'Users can see own roles'
  ) THEN
    CREATE POLICY "Users can see own roles"
      ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointments'
      AND policyname = 'Admins can read all appointments'
  ) THEN
    CREATE POLICY "Admins can read all appointments"
      ON public.appointments FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointments'
      AND policyname = 'Admins can update appointments'
  ) THEN
    CREATE POLICY "Admins can update appointments"
      ON public.appointments FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'appointments'
      AND policyname = 'Admins can delete appointments'
  ) THEN
    CREATE POLICY "Admins can delete appointments"
      ON public.appointments FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services'
      AND policyname = 'Admins can read all services'
  ) THEN
    CREATE POLICY "Admins can read all services"
      ON public.services FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services'
      AND policyname = 'Admins can insert services'
  ) THEN
    CREATE POLICY "Admins can insert services"
      ON public.services FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services'
      AND policyname = 'Admins can update services'
  ) THEN
    CREATE POLICY "Admins can update services"
      ON public.services FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services'
      AND policyname = 'Admins can delete services'
  ) THEN
    CREATE POLICY "Admins can delete services"
      ON public.services FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

INSERT INTO public.services (name, description, duration_min, price_cents)
SELECT *
FROM (
  VALUES
    ('Corte de Cabelo', 'Corte masculino ou feminino com finalizacao', 45, 8000),
    ('Barba', 'Modelagem e hidratacao de barba', 30, 5000),
    ('Corte + Barba', 'Combo completo com toalha quente', 75, 12000),
    ('Coloracao', 'Coloracao profissional com produtos premium', 90, 18000)
) AS seed(name, description, duration_min, price_cents)
WHERE NOT EXISTS (SELECT 1 FROM public.services);
