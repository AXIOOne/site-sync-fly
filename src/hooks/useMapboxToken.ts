import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapboxToken } from "@/lib/config.functions";

export function useMapboxToken() {
  const fetchToken = useServerFn(getMapboxToken);
  return useQuery({
    queryKey: ["mapbox-token"],
    staleTime: Infinity,
    queryFn: () => fetchToken(),
  });
}
