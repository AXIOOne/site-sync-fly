import { supabase } from "@/integrations/supabase/client";

export interface PoiInput {
  organizationId: string;
  projectId: string;
  label: string;
  poi_kind: string;
  latitude: number;
  longitude: number;
  altitude_ft: number | null;
  gimbal_pitch: number | null;
  notes: string | null;
}

export async function createPoi(input: PoiInput) {
  const { data, error } = await supabase
    .from("points_of_interest")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      label: input.label,
      poi_kind: input.poi_kind,
      latitude: input.latitude,
      longitude: input.longitude,
      altitude_ft: input.altitude_ft,
      gimbal_pitch: input.gimbal_pitch,
      notes: input.notes,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePoi(
  id: string,
  patch: Partial<Omit<PoiInput, "organizationId" | "projectId">>,
) {
  const { error } = await supabase.from("points_of_interest").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePoi(id: string) {
  const { error } = await supabase.from("points_of_interest").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
