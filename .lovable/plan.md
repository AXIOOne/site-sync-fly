# Virtual 3D Fly-Through Review

A cinematic first-person preview of a planned mission, so a planner can see exactly what the drone will see at each waypoint before the mission is published or dispatched.

## What the user gets

A new **Fly-through** screen reached from the mission planner (button next to Simulate) at `/flythrough/{missionId}`:

- **Pilot view**: 3D satellite terrain with the camera placed at the aircraft's planned position, altitude, heading and gimbal pitch — the frame you'd get from the drone.
- **Playback bar**: play/pause, restart, scrub timeline, speed 0.5x / 1x / 2x / 4x, and jump-to-waypoint chips.
- **Camera modes**:
  - Pilot (from the aircraft, using each waypoint's heading and gimbal pitch)
  - Chase (behind and above the aircraft, route visible ahead)
  - Orbit (a slow rotation around the selected waypoint's framing)
- **Shot preview at each waypoint**: when the aircraft arrives at a capture waypoint, playback holds for the planned hover time, a shutter-style overlay fires, and the HUD names what the camera is aimed at (fixed bearing, aim target, or locked POI).
- **HUD**: waypoint index, altitude AGL, heading with compass letters, gimbal pitch, ground speed, elapsed / total time, distance flown, and a live battery estimate — same figures as the mission's estimates, so the fly-through doubles as a plausibility check.
- **Route in 3D**: the planned path drawn at its real altitude as an extruded ribbon, waypoint pillars from ground up to flight altitude, POI markers as vertical beacons, and the site boundary on the ground.
- **Issue callouts**: while playing, the screen flags anything the readiness checks already know about at that waypoint (missing heading, capture without a camera action, altitude above the ceiling), so problems are caught visually.

Nothing is written to the database — this is a review tool, not a flight. It is labelled clearly as a planning preview built from planned values, not aircraft data.

## Also added

- A small **Preview in 3D** button on each waypoint row in the planner that opens the fly-through paused at that waypoint's shot.

## Technical approach

- Reuse `FlightSimulator` (already deterministic over `DraftWaypoint[]`) as the position/time source, driven by a `requestAnimationFrame` loop with a speed multiplier, so the fly-through and the existing simulation stay consistent.
- New `src/components/map/flythrough-map.tsx`, mounted client-only like `site-map.tsx` (dynamic `mapbox-gl` import, token from `useMapboxToken`):
  - `mapbox-dem` raster-dem source + `setTerrain`, plus `sky` layer for horizon.
  - Camera driven by `map.getFreeCameraOptions()` / `setFreeCameraOptions` with `lookAtPoint` derived from waypoint heading and gimbal pitch; chase and orbit modes use the same helper with an offset.
  - Layers: `line` for route at altitude, `fill-extrusion` for waypoint pillars and POI beacons, existing boundary styling.
- New route `src/routes/_authenticated/flythrough.$missionId.tsx` with `ssr: false`, its own `head()` metadata, mirroring how `simulate.$missionId.tsx` hydrates the mission version, waypoints, POIs and settings, and applying `resolveWaypointHeadings` so POI-locked headings and derived pitches are used.
- Waypoint-to-camera math (interpolated heading between legs, pitch clamping, altitude in meters) goes in a testable `src/lib/services/flythrough-camera.ts` — no new geometry logic inside the component.
- Readiness callouts reuse the existing evaluation output from `mission-planning.ts`; no new rules.
- No schema changes, no new server functions.
