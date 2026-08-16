import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { cn } from "@/lib/utils";

export interface MapWaypoint {
  key: string;
  sequence: number;
  latitude: number;
  longitude: number;
}

export interface SiteMapProps {
  center: LatLng;
  zoom?: number;
  className?: string;
  /** Ordered waypoints; a flight path line is drawn between them. */
  waypoints?: MapWaypoint[];
  boundaries?: { ring: [number, number][]; label?: string; kind?: string }[];
  /** Live/animated aircraft position. */
  aircraft?: { latitude: number; longitude: number; heading: number } | null;
  /** Trail of already-flown positions. */
  trail?: LatLng[];
  markers?: { latitude: number; longitude: number; label: string; tone?: "takeoff" | "landing" | "rth" }[];
  selectedWaypointKey?: string | null;
  editable?: boolean;
  drawMode?: boolean;
  onMapClick?: (point: LatLng) => void;
  onWaypointClick?: (key: string) => void;
  onWaypointDragEnd?: (key: string, point: LatLng) => void;
  fitToWaypoints?: boolean;
}

const STYLE_SATELLITE = "mapbox://styles/mapbox/satellite-streets-v12";

export function SiteMap({
  center,
  zoom = 16,
  className,
  waypoints = [],
  boundaries = [],
  aircraft = null,
  trail = [],
  markers = [],
  selectedWaypointKey = null,
  editable = false,
  drawMode = false,
  onMapClick,
  onWaypointClick,
  onWaypointDragEnd,
  fitToWaypoints = false,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const glRef = useRef<any>(null);
  const markerRefs = useRef<Map<string, any>>(new Map());
  const aircraftMarkerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const { data: tokenInfo, isPending } = useMapboxToken();

  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const drawRef = useRef(drawMode);
  drawRef.current = drawMode;

  useEffect(() => {
    if (!tokenInfo?.configured || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("mapbox-gl");
        // @ts-expect-error css side-effect import
        await import("mapbox-gl/dist/mapbox-gl.css");
        if (cancelled || !containerRef.current) return;
        const gl = (mod as any).default ?? mod;
        gl.accessToken = tokenInfo.token;
        glRef.current = gl;
        const map = new gl.Map({
          container: containerRef.current,
          style: STYLE_SATELLITE,
          center: [center.lng, center.lat],
          zoom,
          attributionControl: false,
padding: 0,
        });
        map.addControl(new gl.NavigationControl({ visualizePitch: true }), "bottom-right");
        map.addControl(new gl.ScaleControl({ unit: "imperial" }), "bottom-left");
        map.on("load", () => {
          map.addSource("mission-path", { type: "geojson", data: emptyFc() });
          map.addLayer({
            id: "mission-path-line",
            type: "line",
            source: "mission-path",
            paint: { "line-color": "#f8b31c", "line-width": 2.5, "line-dasharray": [2, 1.2] },
          });
          map.addSource("mission-trail", { type: "geojson", data: emptyFc() });
          map.addLayer({
            id: "mission-trail-line",
            type: "line",
            source: "mission-trail",
            paint: { "line-color": "#39c0ed", "line-width": 3 },
          });
          map.addSource("site-boundaries", { type: "geojson", data: emptyFc() });
          map.addLayer({
            id: "site-boundaries-fill",
            type: "fill",
            source: "site-boundaries",
            paint: { "fill-color": "#39c0ed", "fill-opacity": 0.1 },
          });
          map.addLayer({
            id: "site-boundaries-line",
            type: "line",
            source: "site-boundaries",
            paint: { "line-color": "#39c0ed", "line-width": 1.8 },
          });
          setReady(true);
        });
        map.on("click", (event: any) => {
          clickRef.current?.({ lat: event.lngLat.lat, lng: event.lngLat.lng });
        });
        mapRef.current = map;
      } catch (error) {
        setFailed(error instanceof Error ? error.message : "Map failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenInfo?.configured, tokenInfo?.token]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Cursor feedback while drawing
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = drawMode ? "crosshair" : "";
  }, [ready, drawMode]);

  // Path + waypoint markers
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl) return;
    const sorted = [...waypoints].sort((a, b) => a.sequence - b.sequence);
    map.getSource("mission-path")?.setData({
      type: "FeatureCollection",
      features:
        sorted.length > 1
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: sorted.map((w) => [w.longitude, w.latitude]) },
              },
            ]
          : [],
    });

    const seen = new Set<string>();
    for (const wp of sorted) {
      seen.add(wp.key);
      let marker = markerRefs.current.get(wp.key);
      const el = marker?.getElement() as HTMLElement | undefined;
      if (!marker) {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "wp-marker";
        marker = new gl.Marker({ element: node, draggable: editable })
          .setLngLat([wp.longitude, wp.latitude])
          .addTo(map);
        node.addEventListener("click", (e) => {
          e.stopPropagation();
          onWaypointClick?.(wp.key);
        });
        marker.on("dragend", () => {
          const pos = marker.getLngLat();
          onWaypointDragEnd?.(wp.key, { lat: pos.lat, lng: pos.lng });
        });
        markerRefs.current.set(wp.key, marker);
      } else {
        marker.setLngLat([wp.longitude, wp.latitude]);
        marker.setDraggable(editable);
      }
      const node = (el ?? marker.getElement()) as HTMLElement;
      node.textContent = String(wp.sequence);
      node.dataset["selected"] = String(selectedWaypointKey === wp.key);
    }
    for (const [key, marker] of markerRefs.current.entries()) {
      if (!seen.has(key)) {
        marker.remove();
        markerRefs.current.delete(key);
      }
    }
  }, [ready, waypoints, editable, selectedWaypointKey, onWaypointClick, onWaypointDragEnd]);

  // Boundaries
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource("site-boundaries")?.setData({
      type: "FeatureCollection",
      features: boundaries.map((b) => ({
        type: "Feature",
        properties: { label: b.label ?? "", kind: b.kind ?? "" },
        geometry: { type: "Polygon", coordinates: [closeRing(b.ring)] },
      })),
    });
  }, [ready, boundaries]);

  // Trail
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getSource("mission-trail")?.setData({
      type: "FeatureCollection",
      features:
        trail.length > 1
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: trail.map((p) => [p.lng, p.lat]) },
              },
            ]
          : [],
    });
  }, [ready, trail]);

  // Aircraft marker
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl) return;
    if (!aircraft) {
      aircraftMarkerRef.current?.remove();
      aircraftMarkerRef.current = null;
      return;
    }
    if (!aircraftMarkerRef.current) {
      const node = document.createElement("div");
      node.className = "aircraft-marker";
      node.innerHTML = "<span></span>";
      aircraftMarkerRef.current = new gl.Marker({ element: node })
        .setLngLat([aircraft.longitude, aircraft.latitude])
        .addTo(map);
    } else {
      aircraftMarkerRef.current.setLngLat([aircraft.longitude, aircraft.latitude]);
    }
    const el = aircraftMarkerRef.current.getElement() as HTMLElement;
    el.style.transform = `${el.style.transform.replace(/ rotate\([^)]*\)/, "")} rotate(${aircraft.heading}deg)`;
  }, [ready, aircraft?.latitude, aircraft?.longitude, aircraft?.heading, aircraft]);

  // Static markers (takeoff / landing / rth)
  const staticMarkersRef = useRef<any[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl) return;
    staticMarkersRef.current.forEach((m) => m.remove());
    staticMarkersRef.current = markers.map((m) => {
      const node = document.createElement("div");
      node.className = `site-marker site-marker-${m.tone ?? "takeoff"}`;
      node.textContent = m.label;
      return new gl.Marker({ element: node }).setLngLat([m.longitude, m.latitude]).addTo(map);
    });
  }, [ready, markers]);

  // Fit bounds
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl || !fitToWaypoints || waypoints.length < 2) return;
    const b = new gl.LngLatBounds();
    waypoints.forEach((w) => b.extend([w.longitude, w.latitude]));
    map.fitBounds(b, { padding: 80, duration: 600, maxZoom: 18 });
  }, [ready, fitToWaypoints, waypoints.length]);

  if (isPending) {
    return <div className={cn("animate-pulse bg-panel", className)} />;
  }

  if (!tokenInfo?.configured || failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-panel/70 p-6 text-center",
          className,
        )}
      >
        <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-warning">
          Mapbox not configured
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {failed ??
            "Add a Mapbox public token to render satellite imagery. Mission data, waypoints and telemetry still work without the map."}
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className={cn("bg-panel", className)} />;
}

function emptyFc() {
  return { type: "FeatureCollection" as const, features: [] };
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}
