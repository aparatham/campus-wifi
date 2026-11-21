CREATE TYPE public.app_role AS ENUM ('developer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own assigned roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'developer'::public.app_role
  );
$$;
REVOKE ALL ON FUNCTION public.is_developer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_developer() TO authenticated, service_role;

CREATE TABLE public.wifi_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text NOT NULL,
  floor_name text NOT NULL,
  x double precision NOT NULL CHECK (x >= 0 AND x <= 1000),
  y double precision NOT NULL CHECK (y >= 0 AND y <= 900),
  rssi_dbm integer NOT NULL CHECK (rssi_dbm >= -120 AND rssi_dbm <= 0),
  measured_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wifi_measurements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.wifi_measurements TO authenticated;
GRANT ALL ON public.wifi_measurements TO service_role;
ALTER TABLE public.wifi_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view Wi-Fi measurements"
  ON public.wifi_measurements FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "Developers can add Wi-Fi measurements"
  ON public.wifi_measurements FOR INSERT TO authenticated
  WITH CHECK (public.is_developer());
CREATE POLICY "Developers can adjust Wi-Fi measurements"
  ON public.wifi_measurements FOR UPDATE TO authenticated
  USING (public.is_developer())
  WITH CHECK (public.is_developer());
CREATE POLICY "Developers can remove Wi-Fi measurements"
  ON public.wifi_measurements FOR DELETE TO authenticated
  USING (public.is_developer());

CREATE INDEX wifi_measurements_building_floor_idx
  ON public.wifi_measurements (building_id, floor_name);

CREATE OR REPLACE FUNCTION public.assign_listed_developer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) IN ('daddy@tkmce.ac.in', 'bigdaddy@tkmce.ac.in') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'developer'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_listed_developer() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_developer_assign
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_listed_developer();

CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'developer'::public.app_role
  );
$$;
REVOKE ALL ON FUNCTION public.is_developer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_developer() TO authenticated;

CREATE TABLE public.wifi_speed_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text NOT NULL,
  floor_name text NOT NULL,
  x double precision NOT NULL CHECK (x >= 0 AND x <= 1000),
  y double precision NOT NULL CHECK (y >= 0 AND y <= 900),
  download_mbps real NOT NULL CHECK (download_mbps >= 0 AND download_mbps <= 10000),
  upload_mbps real CHECK (upload_mbps IS NULL OR (upload_mbps >= 0 AND upload_mbps <= 10000)),
  latency_ms real NOT NULL CHECK (latency_ms >= 0 AND latency_ms <= 60000),
  jitter_ms real CHECK (jitter_ms IS NULL OR (jitter_ms >= 0 AND jitter_ms <= 60000)),
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'developer')),
  measured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wifi_speed_tests_area_time_idx
  ON public.wifi_speed_tests (building_id, floor_name, measured_at DESC);

ALTER TABLE public.wifi_speed_tests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.wifi_speed_tests TO anon, authenticated;
GRANT UPDATE, DELETE ON public.wifi_speed_tests TO authenticated;
GRANT ALL ON public.wifi_speed_tests TO service_role;

CREATE POLICY "Anyone can read speed tests" ON public.wifi_speed_tests
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can add a user speed test" ON public.wifi_speed_tests
  FOR INSERT TO anon, authenticated WITH CHECK (source = 'user');
CREATE POLICY "Developers can add developer speed tests" ON public.wifi_speed_tests
  FOR INSERT TO authenticated WITH CHECK (source = 'developer' AND public.is_developer());
CREATE POLICY "Developers can update speed tests" ON public.wifi_speed_tests
  FOR UPDATE TO authenticated USING (public.is_developer()) WITH CHECK (public.is_developer());
CREATE POLICY "Developers can delete speed tests" ON public.wifi_speed_tests
  FOR DELETE TO authenticated USING (public.is_developer());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'wifi_measurements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wifi_measurements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'wifi_speed_tests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wifi_speed_tests;
  END IF;
END $$;