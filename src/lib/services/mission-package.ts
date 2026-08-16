import { FT_TO_M, MPH_TO_MS } from "../geo";
import type { Drone, Mission, MissionVersion, Pilot, Project, WaypointActionType } from "../domain";

/**
 * Internal standardized mission package. This is the single format the future
 * DJI Flight Agent downloads, and the source for every export (WPML/KML/GeoJSON).
 */
export interface PackageWaypointAction {
  sequence: number;
  actionType: WaypointActionType;
  paramNumeric?: number | null;
  paramText?: string | null;
}

export interface PackageWaypoint {
  sequence: number;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  altitudeMeters: number;
  heading: number | null;
  gimbalPitch: number | null;
  speedMph: number | null;
  label: string | null;
  actions: PackageWaypointAction[];
}

export interface MissionPackage {
  formatVersion: "1.0";
  mission: {
    id: string;
    name: string;
    type: string;
    isRepeatable: boolean;
    repeatFrequency: string;
  };
  missionVersion: { id: string | null; versionNumber: number; createdAt: string | null };
  project: {
    id: string;
    name: string;
    projectNumber: string | null;
    client: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  aircraftRequirements: {
    droneId: string | null;
    manufacturer: string | null;
    model: string | null;
    requiresRtk: boolean;
    minimumBatteryPercent: number;
  };
  takeoff: { latitude: number | null; longitude: number | null };
  landing: { latitude: number | null; longitude: number | null };
  returnToHome: { latitude: number | null; longitude: number | null; altitudeFt: number; altitudeMeters: number };
  waypoints: PackageWaypoint[];
  cameraSettings: {
    mode: string;
    photoIntervalSeconds: number | null;
    gimbalPitch: number;
    aircraftHeading: string;
  };
  safetySettings: {
    rthAltitudeFt: number;
    maxSpeedMph: number;
    maxSpeedMetersPerSecond: number;
    lowBatteryReturnPercent: number;
  };
  metadata: {
    generatedAt: string;
    generatedBy: "MissionPackageService";
    pilotId: string | null;
    pilotName: string | null;
    organizationId: string;
    estimated: {
      distanceMeters: number | null;
      durationSeconds: number | null;
      photoCount: number | null;
      batteryPercent: number | null;
    };
    disclaimer: string;
  };
}

export interface PackageInput {
  mission: Mission;
  version: MissionVersion | null;
  project: Project;
  drone: Drone | null;
  pilot: Pilot | null;
  waypoints: {
    sequence: number;
    latitude: number;
    longitude: number;
    altitude_ft: number | string;
    heading: number | null;
    gimbal_pitch: number | null;
    speed_mph: number | null;
    label: string | null;
    actions: { sequence: number; action_type: WaypointActionType; param_numeric?: number | null; param_text?: string | null }[];
  }[];
}

export const MissionPackageService = {
  build(input: PackageInput): MissionPackage {
    const { mission, version, project, drone, pilot, waypoints } = input;
    const rthFt = Number(mission.rth_altitude_ft);
    return {
      formatVersion: "1.0",
      mission: {
        id: mission.id,
        name: mission.name,
        type: mission.mission_type,
        isRepeatable: mission.is_repeatable,
        repeatFrequency: mission.repeat_frequency,
      },
      missionVersion: {
        id: version?.id ?? null,
        versionNumber: version?.version_number ?? mission.current_version,
        createdAt: version?.created_at ?? null,
      },
      project: {
        id: project.id,
        name: project.name,
        projectNumber: project.project_number,
        client: project.client,
        latitude: project.latitude,
        longitude: project.longitude,
      },
      aircraftRequirements: {
        droneId: drone?.id ?? null,
        manufacturer: drone?.manufacturer ?? null,
        model: drone?.model ?? null,
        requiresRtk: mission.mission_type === "mapping",
        minimumBatteryPercent: Math.min(
          95,
          Math.round(Number(version?.estimated_battery_percent ?? 50)) + 20,
        ),
      },
      takeoff: { latitude: mission.takeoff_lat, longitude: mission.takeoff_lng },
      landing: { latitude: mission.landing_lat, longitude: mission.landing_lng },
      returnToHome: {
        latitude: mission.rth_lat,
        longitude: mission.rth_lng,
        altitudeFt: rthFt,
        altitudeMeters: Number((rthFt * FT_TO_M).toFixed(2)),
      },
      waypoints: waypoints
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((w) => ({
          sequence: w.sequence,
          latitude: w.latitude,
          longitude: w.longitude,
          altitudeFt: Number(w.altitude_ft),
          altitudeMeters: Number((Number(w.altitude_ft) * FT_TO_M).toFixed(2)),
          heading: w.heading == null ? null : Number(w.heading),
          gimbalPitch: w.gimbal_pitch == null ? null : Number(w.gimbal_pitch),
          speedMph: w.speed_mph == null ? null : Number(w.speed_mph),
          label: w.label,
          actions: (w.actions ?? [])
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((a) => ({
              sequence: a.sequence,
              actionType: a.action_type,
              paramNumeric: a.param_numeric ?? null,
              paramText: a.param_text ?? null,
            })),
        })),
      cameraSettings: {
        mode: mission.camera_mode,
        photoIntervalSeconds: mission.photo_interval_seconds == null ? null : Number(mission.photo_interval_seconds),
        gimbalPitch: Number(mission.gimbal_pitch),
        aircraftHeading: mission.aircraft_heading,
      },
      safetySettings: {
        rthAltitudeFt: rthFt,
        maxSpeedMph: Number(mission.speed_mph),
        maxSpeedMetersPerSecond: Number((Number(mission.speed_mph) * MPH_TO_MS).toFixed(2)),
        lowBatteryReturnPercent: 30,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: "MissionPackageService",
        pilotId: pilot?.id ?? null,
        pilotName: pilot?.full_name ?? null,
        organizationId: mission.organization_id,
        estimated: {
          distanceMeters: version?.estimated_distance_m == null ? null : Number(version.estimated_distance_m),
          durationSeconds: version?.estimated_duration_s == null ? null : Number(version.estimated_duration_s),
          photoCount: version?.estimated_photo_count ?? null,
          batteryPercent: version?.estimated_battery_percent == null ? null : Number(version.estimated_battery_percent),
        },
        disclaimer:
          "Estimates are planning calculations only and are not a guarantee of actual aircraft performance.",
      },
    };
  },

  toJson(pkg: MissionPackage): string {
    return JSON.stringify(pkg, null, 2);
  },
};

const DJI_ACTION_MAP: Record<WaypointActionType, string> = {
  take_photo: "takePhoto",
  start_video: "startRecord",
  stop_video: "stopRecord",
  rotate_aircraft: "rotateYaw",
  rotate_gimbal: "gimbalRotate",
  hover: "hover",
  wait: "hover",
  continue: "hover",
};

function esc(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );
}

/**
 * WPML generator. Produces DJI Waypoint Mission Markup Language for use by the
 * DJI Flight Agent / DJI Pilot 2. Structure follows the DJI WPML template
 * shape; it is produced here but never uploaded to an aircraft by this app.
 */
export const WPMLGenerator = {
  generate(pkg: MissionPackage): string {
    const speedMs = pkg.safetySettings.maxSpeedMetersPerSecond;
    const placemarks = pkg.waypoints
      .map((w) => {
        const actions = w.actions
          .map(
            (a, idx) => `            <wpml:action>
              <wpml:actionId>${idx}</wpml:actionId>
              <wpml:actionActuatorFunc>${DJI_ACTION_MAP[a.actionType]}</wpml:actionActuatorFunc>
              <wpml:actionActuatorFuncParam>
                ${a.actionType === "rotate_gimbal" ? `<wpml:gimbalPitchRotateAngle>${a.paramNumeric ?? w.gimbalPitch ?? -45}</wpml:gimbalPitchRotateAngle>` : ""}
                ${a.actionType === "rotate_aircraft" ? `<wpml:aircraftHeading>${a.paramNumeric ?? w.heading ?? 0}</wpml:aircraftHeading>` : ""}
                ${a.actionType === "hover" || a.actionType === "wait" ? `<wpml:hoverTime>${a.paramNumeric ?? 2}</wpml:hoverTime>` : ""}
              </wpml:actionActuatorFuncParam>
            </wpml:action>`,
          )
          .join("\n");
        return `      <Placemark>
        <Point><coordinates>${w.longitude},${w.latitude}</coordinates></Point>
        <wpml:index>${w.sequence - 1}</wpml:index>
        <wpml:executeHeight>${w.altitudeMeters}</wpml:executeHeight>
        <wpml:waypointSpeed>${((w.speedMph ?? pkg.safetySettings.maxSpeedMph) * 0.44704).toFixed(2)}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>${pkg.cameraSettings.aircraftHeading === "point_to_center" ? "smoothTransition" : "followWayline"}</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>${Math.round(w.heading ?? 0)}</wpml:waypointHeadingAngle>
        </wpml:waypointHeadingParam>
        <wpml:actionGroup>
          <wpml:actionGroupId>${w.sequence}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${w.sequence - 1}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${w.sequence - 1}</wpml:actionGroupEndIndex>
${actions}
        </wpml:actionGroup>
      </Placemark>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:author>${esc(pkg.project.name)}</wpml:author>
    <wpml:createTime>${Date.parse(pkg.metadata.generatedAt)}</wpml:createTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLostAction>goBack</wpml:exitOnRCLostAction>
      <wpml:globalTransitionalSpeed>${speedMs}</wpml:globalTransitionalSpeed>
      <wpml:takeOffSecurityHeight>${pkg.returnToHome.altitudeMeters}</wpml:takeOffSecurityHeight>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:autoFlightSpeed>${speedMs}</wpml:autoFlightSpeed>
      <name>${esc(pkg.mission.name)} v${pkg.missionVersion.versionNumber}</name>
${placemarks}
    </Folder>
  </Document>
</kml>`;
  },
};

export const DJIMissionService = {
  /** Everything the Flight Agent needs in one payload. */
  buildAgentPayload(pkg: MissionPackage) {
    return {
      package: pkg,
      wpml: WPMLGenerator.generate(pkg),
      transport: "flight-agent-v1",
      note: "Aircraft upload and execution happen in the Android DJI Flight Agent using DJI Mobile SDK 5.",
    };
  },
};

export const MissionExportService = {
  toGeoJson(pkg: MissionPackage) {
    return {
      type: "FeatureCollection" as const,
      properties: { mission: pkg.mission.name, version: pkg.missionVersion.versionNumber },
      features: [
        {
          type: "Feature" as const,
          properties: { kind: "flight_path", mission: pkg.mission.name },
          geometry: {
            type: "LineString" as const,
            coordinates: pkg.waypoints.map((w) => [w.longitude, w.latitude]),
          },
        },
        ...pkg.waypoints.map((w) => ({
          type: "Feature" as const,
          properties: {
            kind: "waypoint",
            sequence: w.sequence,
            altitude_ft: w.altitudeFt,
            heading: w.heading,
            gimbal_pitch: w.gimbalPitch,
            actions: w.actions.map((a) => a.actionType),
          },
          geometry: { type: "Point" as const, coordinates: [w.longitude, w.latitude] },
        })),
      ],
    };
  },

  toKml(pkg: MissionPackage): string {
    const points = pkg.waypoints
      .map(
        (w) => `    <Placemark>
      <name>${String(w.sequence).padStart(2, "0")}</name>
      <description>Alt ${w.altitudeFt} ft • gimbal ${w.gimbalPitch}°</description>
      <Point><coordinates>${w.longitude},${w.latitude},${w.altitudeMeters}</coordinates></Point>
    </Placemark>`,
      )
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${esc(pkg.mission.name)} v${pkg.missionVersion.versionNumber}</name>
    <Placemark>
      <name>Flight Path</name>
      <LineString><tessellate>1</tessellate><coordinates>${pkg.waypoints
        .map((w) => `${w.longitude},${w.latitude},${w.altitudeMeters}`)
        .join(" ")}</coordinates></LineString>
    </Placemark>
${points}
  </Document>
</kml>`;
  },
};

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
