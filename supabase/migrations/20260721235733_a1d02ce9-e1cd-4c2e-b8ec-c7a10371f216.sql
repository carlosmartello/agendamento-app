
-- Enum de status e role
CREATE TYPE public.appointment_status AS ENUM ('scheduled','confirmed','completed','cancelled');
CREATE TYPE public.app_role AS ENUM ('admin','user');

-- Serviços
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER NOT NULL DEFAULT 30,
  price_cents INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services readable by everyone" ON public.services FOR SELECT USING (active = true);

-- Agendamentos
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Impede dois agendamentos ativos no mesmo horário
CREATE UNIQUE INDEX appointments_slot_unique
  ON public.appointments (scheduled_at)
  WHERE status <> 'cancelled';
CREATE INDEX appointments_scheduled_at_idx ON public.appointments (scheduled_at);

GRANT SELECT, INSERT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Público pode criar agendamentos
CREATE POLICY "Anyone can create appointments" ON public.appointments
  FOR INSERT WITH CHECK (true);

-- Público pode ler apenas por id específico (confirmação) — controlado no servidor;
-- para simplicidade, deixamos SELECT limitado a admins.
-- Vamos permitir SELECT público apenas de horários ocupados (via view abaixo).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Admins podem ler/atualizar/deletar agendamentos
CREATE POLICY "Admins can read all appointments" ON public.appointments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete appointments" ON public.appointments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Função pública para listar apenas horários ocupados por data (não expõe PII)
CREATE OR REPLACE FUNCTION public.get_booked_slots(_date DATE)
RETURNS TABLE (scheduled_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.scheduled_at FROM public.appointments a
  WHERE a.status <> 'cancelled'
    AND a.scheduled_at >= _date::timestamptz
    AND a.scheduled_at <  (_date + INTERVAL '1 day')::timestamptz
$$;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(DATE) TO anon, authenticated;

-- Função pública para ler confirmação por id (retorna apenas campos seguros)
CREATE OR REPLACE FUNCTION public.get_appointment_confirmation(_id UUID)
RETURNS TABLE (
  id UUID,
  client_name TEXT,
  scheduled_at TIMESTAMPTZ,
  status public.appointment_status,
  service_name TEXT,
  duration_min INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.client_name, a.scheduled_at, a.status, s.name, s.duration_min
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE a.id = _id
$$;
GRANT EXECUTE ON FUNCTION public.get_appointment_confirmation(UUID) TO anon, authenticated;

-- Promover o primeiro usuário registrado a admin (bootstrap)
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bootstrap_first_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();

-- Seed inicial de serviços
INSERT INTO public.services (name, description, duration_min, price_cents) VALUES
  ('Corte de Cabelo', 'Corte masculino ou feminino com finalização', 45, 8000),
  ('Barba', 'Modelagem e hidratação de barba', 30, 5000),
  ('Corte + Barba', 'Combo completo com toalha quente', 75, 12000),
  ('Coloração', 'Coloração profissional com produtos premium', 90, 18000);
