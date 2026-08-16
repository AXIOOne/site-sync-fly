
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('administrator','drone_program_manager','project_manager','pilot','viewer');
CREATE TYPE public.project_status AS ENUM ('planning','active','on_hold','completed','archived');
CREATE TYPE public.drone_status AS ENUM ('available','assigned','flying','charging','maintenance','offline');
CREATE TYPE public.mission_type AS ENUM ('weekly_progress','mapping','site_perimeter','point_inspection','custom');
CREATE TYPE public.waypoint_action_type AS ENUM ('take_photo','start_video','stop_video','rotate_aircraft','rotate_gimbal','hover','wait','continue');
CREATE TYPE public.schedule_frequency AS ENUM ('manual','daily','weekly','biweekly','monthly','custom');
CREATE TYPE public.flight_status AS ENUM ('scheduled','assigned','preflight','in_progress','completed','aborted','failed');
CREATE TYPE public.flight_result AS ENUM ('completed','partial','aborted','failed');
CREATE TYPE public.flight_event_type AS ENUM ('AIRCRAFT_CONNECTED','MISSION_DOWNLOADED','PREFLIGHT_COMPLETE','TAKEOFF','MISSION_STARTED','WAYPOINT_REACHED','PHOTO_CAPTURED','VIDEO_STARTED','VIDEO_STOPPED','LOW_BATTERY','RETURN_TO_HOME','LANDING','MISSION_COMPLETE','MISSION_ABORTED','CONNECTION_LOST','ERROR');
CREATE TYPE public.media_type AS ENUM ('photo','video','orthomosaic','model_3d','point_cloud');
CREATE TYPE public.device_status AS ENUM ('active','offline','revoked','update_required');
CREATE TYPE public.integration_status AS ENUM ('not_connected','connected','coming_soon','flight_agent_required','error');

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  is_demo boolean NOT NULL DEFAULT false,
  telemetry_sample_seconds integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- HELPERS
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_edit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role <> 'viewer'::public.app_role
  )
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROJECTS
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  project_number text,
  client text,
  address text,
  latitude double precision,
  longitude double precision,
  project_manager text,
  superintendent text,
  start_date date,
  estimated_completion date,
  description text,
  status public.project_status NOT NULL DEFAULT 'active',
  procore_project_id text,
  default_drone_id uuid,
  default_pilot_id uuid,
  progress_percent integer NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_boundaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Site Boundary',
  kind text NOT NULL DEFAULT 'site',
  geojson jsonb NOT NULL,
  area_sq_meters double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FLEET + PILOTS
CREATE TABLE public.drones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  manufacturer text NOT NULL DEFAULT 'DJI',
  model text NOT NULL,
  serial_number text,
  registration_number text,
  nickname text,
  camera text,
  has_rtk boolean NOT NULL DEFAULT false,
  status public.drone_status NOT NULL DEFAULT 'available',
  last_flight_at timestamptz,
  flight_hours numeric NOT NULL DEFAULT 0,
  maintenance_status text DEFAULT 'OK',
  battery_capacity_minutes integer DEFAULT 30,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pilots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid,
  full_name text NOT NULL,
  email text,
  phone text,
  faa_certificate_number text,
  certificate_expiration date,
  assigned_drone_id uuid REFERENCES public.drones(id) ON DELETE SET NULL,
  flight_count integer NOT NULL DEFAULT 0,
  flight_hours numeric NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ADD CONSTRAINT projects_default_drone_fkey FOREIGN KEY (default_drone_id) REFERENCES public.drones(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD CONSTRAINT projects_default_pilot_fkey FOREIGN KEY (default_pilot_id) REFERENCES public.pilots(id) ON DELETE SET NULL;

-- MISSIONS
CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  mission_type public.mission_type NOT NULL DEFAULT 'custom',
  description text,
  is_repeatable boolean NOT NULL DEFAULT false,
  altitude_ft numeric NOT NULL DEFAULT 150,
  speed_mph numeric NOT NULL DEFAULT 12,
  camera_mode text NOT NULL DEFAULT 'photo',
  photo_interval_seconds numeric DEFAULT 2,
  gimbal_pitch numeric NOT NULL DEFAULT -45,
  aircraft_heading text NOT NULL DEFAULT 'follow_route',
  rth_altitude_ft numeric NOT NULL DEFAULT 200,
  takeoff_lat double precision,
  takeoff_lng double precision,
  landing_lat double precision,
  landing_lng double precision,
  rth_lat double precision,
  rth_lng double precision,
  front_overlap integer DEFAULT 75,
  side_overlap integer DEFAULT 65,
  flight_direction integer DEFAULT 0,
  flight_area_geojson jsonb,
  drone_id uuid REFERENCES public.drones(id) ON DELETE SET NULL,
  pilot_id uuid REFERENCES public.pilots(id) ON DELETE SET NULL,
  repeat_frequency public.schedule_frequency NOT NULL DEFAULT 'manual',
  current_version integer NOT NULL DEFAULT 1,
  readiness_state text NOT NULL DEFAULT 'REVIEW_REQUIRED',
  weather_reviewed boolean NOT NULL DEFAULT false,
  airspace_reviewed boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.mission_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  change_note text,
  snapshot jsonb NOT NULL,
  estimated_distance_m numeric,
  estimated_duration_s numeric,
  estimated_area_sq_m numeric,
  estimated_photo_count integer,
  estimated_battery_percent numeric,
  waypoint_count integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, version_number)
);

CREATE TABLE public.waypoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  altitude_ft numeric NOT NULL DEFAULT 150,
  heading numeric,
  gimbal_pitch numeric DEFAULT -45,
  speed_mph numeric,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.waypoint_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  waypoint_id uuid NOT NULL REFERENCES public.waypoints(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 1,
  action_type public.waypoint_action_type NOT NULL,
  param_numeric numeric,
  param_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SCHEDULING
CREATE TABLE public.flight_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  frequency public.schedule_frequency NOT NULL DEFAULT 'weekly',
  day_of_week integer,
  day_of_month integer,
  time_of_day time NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'America/Denver',
  cron_expression text,
  is_active boolean NOT NULL DEFAULT true,
  next_occurrence timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.flight_agent_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  device_identifier text NOT NULL,
  pilot_id uuid REFERENCES public.pilots(id) ON DELETE SET NULL,
  assigned_drone_id uuid REFERENCES public.drones(id) ON DELETE SET NULL,
  app_version text,
  token_hash text,
  token_preview text,
  last_seen timestamptz,
  status public.device_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, device_identifier)
);

CREATE TABLE public.flight_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  mission_version_id uuid REFERENCES public.mission_versions(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES public.flight_schedules(id) ON DELETE SET NULL,
  pilot_id uuid REFERENCES public.pilots(id) ON DELETE SET NULL,
  drone_id uuid REFERENCES public.drones(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.flight_agent_devices(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL,
  status public.flight_status NOT NULL DEFAULT 'scheduled',
  dispatched_to_agent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FLIGHTS
CREATE TABLE public.flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  mission_version_id uuid REFERENCES public.mission_versions(id) ON DELETE SET NULL,
  assignment_id uuid REFERENCES public.flight_assignments(id) ON DELETE SET NULL,
  pilot_id uuid REFERENCES public.pilots(id) ON DELETE SET NULL,
  drone_id uuid REFERENCES public.drones(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.flight_agent_devices(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  distance_m numeric,
  max_altitude_ft numeric,
  photos_captured integer NOT NULL DEFAULT 0,
  videos_captured integer NOT NULL DEFAULT 0,
  battery_start integer,
  battery_end integer,
  completion_percent numeric NOT NULL DEFAULT 0,
  status public.flight_status NOT NULL DEFAULT 'scheduled',
  result public.flight_result,
  is_simulated boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.flight_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  event_type public.flight_event_type NOT NULL,
  message text,
  waypoint_sequence integer,
  payload jsonb,
  is_simulated boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.flight_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision,
  longitude double precision,
  altitude_ft numeric,
  speed_mph numeric,
  heading numeric,
  battery_percent integer,
  satellite_count integer,
  current_waypoint integer,
  flight_mode text,
  distance_from_home_m numeric,
  mission_progress numeric,
  is_simulated boolean NOT NULL DEFAULT false
);
CREATE INDEX flight_telemetry_flight_idx ON public.flight_telemetry (flight_id, recorded_at DESC);

-- MEDIA / REPORTS / INTEGRATIONS / PREFLIGHT
CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  flight_id uuid REFERENCES public.flights(id) ON DELETE CASCADE,
  waypoint_sequence integer,
  media_type public.media_type NOT NULL DEFAULT 'photo',
  file_url text,
  thumbnail_url text,
  captured_at timestamptz,
  latitude double precision,
  longitude double precision,
  altitude_ft numeric,
  heading numeric,
  gimbal_pitch numeric,
  aircraft text,
  camera text,
  file_size_bytes bigint,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  flight_id uuid REFERENCES public.flights(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'construction_flight_report',
  notes text,
  selected_media_ids uuid[] DEFAULT '{}',
  created_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'not_connected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE TABLE public.preflight_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  pilot_id uuid REFERENCES public.pilots(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTS + RLS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','profiles','user_roles','projects','project_boundaries','drones','pilots',
    'missions','mission_versions','waypoints','waypoint_actions','flight_schedules',
    'flight_assignments','flight_agent_devices','flights','flight_events','flight_telemetry',
    'media','reports','integrations','preflight_checklists'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- org-scoped tables with organization_id column
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'projects','project_boundaries','drones','pilots','missions','mission_versions',
    'waypoints','waypoint_actions','flight_schedules','flight_assignments',
    'flight_agent_devices','flights','flight_events','flight_telemetry','media','reports',
    'integrations','preflight_checklists'
  ] LOOP
    EXECUTE format($f$CREATE POLICY "%1$s_org_read" ON public.%1$I FOR SELECT TO authenticated USING (organization_id = public.current_org_id())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_org_insert" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id() AND public.can_edit())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_org_update" ON public.%1$I FOR UPDATE TO authenticated USING (organization_id = public.current_org_id() AND public.can_edit()) WITH CHECK (organization_id = public.current_org_id())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_org_delete" ON public.%1$I FOR DELETE TO authenticated USING (organization_id = public.current_org_id() AND public.can_edit())$f$, t);
  END LOOP;
END $$;

CREATE POLICY "organizations_read_own" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_org_id());
CREATE POLICY "organizations_update_own" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.has_role(auth.uid(),'administrator'))
  WITH CHECK (id = public.current_org_id());

CREATE POLICY "profiles_read_org" ON public.profiles FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_read_org" ON public.user_roles FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'administrator'))
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'administrator'));

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','profiles','projects','project_boundaries','drones','pilots','missions',
    'waypoints','flight_schedules','flight_assignments','flights','reports','integrations',
    'preflight_checklists'
  ] LOOP
    EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- new user -> demo org profile + administrator role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE demo_org uuid;
BEGIN
  SELECT id INTO demo_org FROM public.organizations WHERE is_demo = true ORDER BY created_at LIMIT 1;
  IF demo_org IS NULL THEN
    INSERT INTO public.organizations (name, slug, is_demo) VALUES ('Demo Construction Group','demo',true) RETURNING id INTO demo_org;
  END IF;

  INSERT INTO public.profiles (id, organization_id, full_name, email)
  VALUES (NEW.id, demo_org, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (NEW.id, demo_org, 'administrator')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- realtime
ALTER TABLE public.flights REPLICA IDENTITY FULL;
ALTER TABLE public.flight_events REPLICA IDENTITY FULL;
ALTER TABLE public.flight_telemetry REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flight_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flight_telemetry;
