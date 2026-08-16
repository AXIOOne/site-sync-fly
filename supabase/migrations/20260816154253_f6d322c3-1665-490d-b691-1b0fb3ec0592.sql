CREATE TABLE public.points_of_interest (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  poi_kind text NOT NULL DEFAULT 'structure',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  altitude_ft numeric,
  gimbal_pitch numeric,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.points_of_interest TO authenticated;
GRANT ALL ON public.points_of_interest TO service_role;

ALTER TABLE public.points_of_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "points_of_interest_org_read" ON public.points_of_interest FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "points_of_interest_org_insert" ON public.points_of_interest FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND public.can_edit());
CREATE POLICY "points_of_interest_org_update" ON public.points_of_interest FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_edit())
  WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "points_of_interest_org_delete" ON public.points_of_interest FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND public.can_edit());

CREATE TRIGGER points_of_interest_set_updated_at BEFORE UPDATE ON public.points_of_interest
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX points_of_interest_project_idx ON public.points_of_interest(project_id);

INSERT INTO public.points_of_interest (organization_id, project_id, label, poi_kind, latitude, longitude, altitude_ft, gimbal_pitch, notes, is_demo)
SELECT p.organization_id, p.id, v.label, v.kind, p.latitude + v.dlat, p.longitude + v.dlng, v.alt, v.pitch, v.notes, true
FROM public.projects p
CROSS JOIN (VALUES
  ('Tower crane', 'equipment', 0.00055, -0.00035, 210, -10, 'Reference for weekly jib and hook-height documentation.'),
  ('Main entry gate', 'access', -0.00062, 0.00048, 20, -25, 'Site access documentation and logistics review.'),
  ('Data hall shell', 'structure', 0.00012, 0.00018, 65, -20, 'Primary structure reference for progress comparison.')
) AS v(label, kind, dlat, dlng, alt, pitch, notes)
WHERE p.is_demo = true AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL;