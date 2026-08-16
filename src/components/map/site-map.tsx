import { useEffect, useRef, useState } from "react";
import { bearing, metersToDegLat, metersToDegLng, type LatLng } from "@/lib/geo";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { cn } from "@/lib/utils";

export interface MapWaypoint {
  key: string;
  sequence: number;
  latitude: number;
  longitude: number;
  /** Aircraft heading in degrees; renders an aim cone when set. */
  heading?: number | null;
  /** Optional aim target the heading was derived from. */
  aim?: LatLng | null;
}

export interface MapPoi {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  kind?: string | null;
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
  /** Named site references the camera can be locked to. */
  pois?: MapPoi[];
  /** Highlighted POI (e.g. the one the selected waypoint is locked to). */
  activePoiId?: string | null;
  /** When true, the next map click drops a new POI instead of a waypoint. */
  poiMode?: boolean;
  onPoiPlaced?: (point: LatLng) => void;
  onPoiClick?: (id: string) => void;
  selectedWaypointKey?: string | null;
  editable?: boolean;
  drawMode?: boolean;
  /** When true, a map click sets the aim target of the selected waypoint. */
  aimMode?: boolean;
  onMapClick?: (point: LatLng) => void;
  onWaypointClick?: (key: string) => void;
  onWaypointDragEnd?: (key: string, point: LatLng) => void;
  /** Fired while/after dragging the aim handle of the selected waypoint. */
  onWaypointHeadingChange?: (key: string, degrees: number) => void;
  /** Fired when a map click picks an aim target in aimMode. */
  onAimPointPicked?: (key: string, point: LatLng) => void;
  fitToWaypoints?: boolean;
}

const STYLE_SATELLITE = "mapbox://styles/mapbox/satellite-streets-v12";
/** Ground length of the drawn aim cone, in meters. */
const CONE_METERS = 55;
const CONE_HALF_ANGLE = 16;


export function SiteMap({
  center,
  zoom = 16,
  className,
  waypoints = [],
  boundaries = [],
  aircraft = null,
  trail = [],
  markers = [],
  pois = [],
  activePoiId = null,
  poiMode = false,
  onPoiPlaced,
  onPoiClick,
  selectedWaypointKey = null,
  editable = false,
  drawMode = false,
  aimMode = false,
  onMapClick,
  onWaypointClick,
  onWaypointDragEnd,
  onWaypointHeadingChange,
  onAimPointPicked,
  fitToWaypoints = false,
}: SiteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const glRef = useRef<any>(null);
  const markerRefs = useRef<Map<string, any>>(new Map());
  const aircraftMarkerRef = useRef<any>(null);
  const aimHandleRef = useRef<any>(null);
  const aimTargetRef = useRef<any>(null);
  const poiMarkerRefs = useRef<Map<string, any>>(new Map());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const { data: tokenInfo, isPending } = useMapboxToken();

  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const drawRef = useRef(drawMode);
  drawRef.current = drawMode;
  const aimRef = useRef({ aimMode, selectedWaypointKey, onAimPointPicked });
  aimRef.current = { aimMode, selectedWaypointKey, onAimPointPicked };
  const headingChangeRef = useRef(onWaypointHeadingChange);
  headingChangeRef.current = onWaypointHeadingChange;
  const poiRef = useRef({ poiMode, onPoiPlaced, onPoiClick });
  poiRef.current = { poiMode, onPoiPlaced, onPoiClick };


  useEffect(() => {
    if (!tokenInfo?.configured || !containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("mapbox-gl");
        await import("mapbox-gl/dist/mapbox-gl.css");
        if (cancelled || !containerRef.current) return;
        const gl = (mod as any).default ?? mod;
        gl.accessToken = tokenInfo.token;
        glRef.current = gl;
        const map = new gl.Map({
          container: containerRef.current,
          style: STYLE_SATELLITE,
          center: [center.longitude, center.latitude],
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
          map.addSource("waypoint-headings", { type: "geojson", data: emptyFc() });
          map.addLayer({
            id: "waypoint-headings-fill",
            type: "fill",
            source: "waypoint-headings",
            paint: {
              "fill-color": ["case", ["get", "selected"], "#f8b31c", "#ffffff"],
              "fill-opacity": ["case", ["get", "selected"], 0.35, 0.14],
            },
          });
          map.addLayer({
            id: "waypoint-headings-line",
            type: "line",
            source: "waypoint-headings",
            paint: {
              "line-color": ["case", ["get", "selected"], "#f8b31c", "#dbe6ef"],
              "line-width": ["case", ["get", "selected"], 1.6, 0.9],
            },
          });
          map.addSource("aim-links", { type: "geojson", data: emptyFc() });
          map.addLayer({
            id: "aim-links-line",
            type: "line",
            source: "aim-links",
            paint: { "line-color": "#f8b31c", "line-width": 1.2, "line-dasharray": [1.5, 1.5], "line-opacity": 0.8 },
          });
          setReady(true);
        });
        map.on("click", (event: any) => {
          const point = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
          if (poiRef.current.poiMode) {
            poiRef.current.onPoiPlaced?.(point);
            return;
          }
          const aim = aimRef.current;
          if (aim.aimMode && aim.selectedWaypointKey) {
            aim.onAimPointPicked?.(aim.selectedWaypointKey, point);
            return;
          }
          clickRef.current?.(point);
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

  // Cursor feedback while drawing or aiming
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.getCanvas().style.cursor = drawMode || aimMode || poiMode ? "crosshair" : "";
  }, [ready, drawMode, aimMode, poiMode]);

  // POI markers
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl) return;
    const seen = new Set<string>();
    for (const poi of pois) {
      seen.add(poi.id);
      let marker = poiMarkerRefs.current.get(poi.id);
      if (!marker) {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "poi-marker";
        node.innerHTML = '<span class="poi-dot"></span><span class="poi-label"></span>';
        node.addEventListener("click", (e) => {
          e.stopPropagation();
          poiRef.current.onPoiClick?.(poi.id);
        });
        marker = new gl.Marker({ element: node, anchor: "left" })
          .setLngLat([poi.longitude, poi.latitude])
          .addTo(map);
        poiMarkerRefs.current.set(poi.id, marker);
      } else {
        marker.setLngLat([poi.longitude, poi.latitude]);
      }
      const node = marker.getElement() as HTMLElement;
      const labelNode = node.querySelector(".poi-label");
      if (labelNode) labelNode.textContent = poi.label;
      node.title = poi.kind ? `${poi.label} · ${poi.kind}` : poi.label;
      node.dataset["active"] = String(activePoiId === poi.id);
    }
    for (const [id, marker] of poiMarkerRefs.current.entries()) {
      if (!seen.has(id)) {
        marker.remove();
        poiMarkerRefs.current.delete(id);
      }
    }
  }, [ready, pois, activePoiId]);

  // Heading cones + aim links
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const cones = waypoints
      .filter((w) => w.heading != null)
      .map((w) => ({
        type: "Feature" as const,
        properties: { selected: selectedWaypointKey === w.key, sequence: w.sequence },
        geometry: {
          type: "Polygon" as const,
          coordinates: [coneRing(w, Number(w.heading))],
        },
      }));
    map.getSource("waypoint-headings")?.setData({ type: "FeatureCollection", features: cones });

    const links = waypoints
      .filter((w) => w.aim)
      .map((w) => ({
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [w.longitude, w.latitude],
            [w.aim!.longitude, w.aim!.latitude],
          ],
        },
      }));
    map.getSource("aim-links")?.setData({ type: "FeatureCollection", features: links });
  }, [ready, waypoints, selectedWaypointKey]);

  // Draggable aim handle for the selected waypoint
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl) return;
    const selected = waypoints.find((w) => w.key === selectedWaypointKey) ?? null;
    if (!selected || !editable) {
      aimHandleRef.current?.remove();
      aimHandleRef.current = null;
      aimTargetRef.current?.remove();
      aimTargetRef.current = null;
      return;
    }
    const heading = selected.heading ?? 0;
    const tip = offsetPoint(selected, heading, CONE_METERS * 1.05);
    if (!aimHandleRef.current) {
      const node = document.createElement("div");
      node.className = "aim-handle";
      node.title = "Drag to aim the aircraft";
      aimHandleRef.current = new gl.Marker({ element: node, draggable: true })
        .setLngLat([tip.longitude, tip.latitude])
        .addTo(map);
      const emit = () => {
        // Always read the *current* selection, never the one captured when the
        // handle was first created — otherwise every drag re-aims that waypoint.
        const origin = aimOriginRef.current;
        if (!origin) return;
        const pos = aimHandleRef.current.getLngLat();
        const deg = bearing(
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: pos.lat, longitude: pos.lng },
        );
        headingChangeRef.current?.(origin.key, Math.round(deg));
      };
      aimHandleRef.current.on("dragstart", () => {
        aimDraggingRef.current = true;
      });
      aimHandleRef.current.on("drag", emit);
      aimHandleRef.current.on("dragend", () => {
        emit();
        aimDraggingRef.current = false;
      });
    } else if (!aimDraggingRef.current) {
      aimHandleRef.current.setLngLat([tip.longitude, tip.latitude]);
    }

    if (selected.aim) {
      if (!aimTargetRef.current) {
        const node = document.createElement("div");
        node.className = "aim-target";
        aimTargetRef.current = new gl.Marker({ element: node })
          .setLngLat([selected.aim.longitude, selected.aim.latitude])
          .addTo(map);
      } else {
        aimTargetRef.current.setLngLat([selected.aim.longitude, selected.aim.latitude]);
      }
    } else {
      aimTargetRef.current?.remove();
      aimTargetRef.current = null;
    }
  }, [ready, waypoints, selectedWaypointKey, editable]);


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
          onWaypointDragEnd?.(wp.key, { latitude: pos.lat, longitude: pos.lng });
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
                geometry: { type: "LineString", coordinates: trail.map((p) => [p.longitude, p.latitude]) },
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

/** Project a point `meters` away from `origin` along a compass bearing. */
function offsetPoint(origin: { latitude: number; longitude: number }, degrees: number, meters: number): LatLng {
  const rad = (degrees * Math.PI) / 180;
  return {
    latitude: origin.latitude + metersToDegLat(meters * Math.cos(rad)),
    longitude: origin.longitude + metersToDegLng(meters * Math.sin(rad), origin.latitude),
  };
}

/** Triangular "camera looks this way" cone drawn from a waypoint. */
function coneRing(origin: { latitude: number; longitude: number }, degrees: number): [number, number][] {
  const points: [number, number][] = [[origin.longitude, origin.latitude]];
  for (let a = -CONE_HALF_ANGLE; a <= CONE_HALF_ANGLE; a += CONE_HALF_ANGLE / 2) {
    const p = offsetPoint(origin, degrees + a, CONE_METERS);
    points.push([p.longitude, p.latitude]);
  }
  points.push([origin.longitude, origin.latitude]);
  return points;
}


function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}
