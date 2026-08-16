# Waypoint Heading (Aim) Controls in the Flight Planner

Today each waypoint stores a heading (degrees) and the inspector has a plain number field, but there is no way to see or aim it on the map. The recommendation is to make heading a visual, point-and-aim decision rather than a number to guess.

## Recommended approach

Three complementary ways to set heading, in order of how often a planner would use them:

1. **Aim on the map (primary).** Each waypoint marker gets a heading cone/arrow drawn from it showing where the camera looks. A small draggable handle at the tip of the cone lets the planner spin the aircraft to the desired direction; the heading value updates live while dragging and snaps to 5° (hold Shift for 1°).
2. **Point at a target.** With a waypoint selected, "Aim at point" mode lets the planner click anywhere on the satellite image (a building corner, crane, foundation). The heading is computed from the waypoint to the clicked point and stored, and the target is remembered so the cone stays aimed at that feature if the waypoint is dragged.
3. **Quick presets + numeric.** Buttons for Face site center, Face next waypoint, Face previous waypoint, plus N/NE/E/SE/S/SW/W/NW, a compass dial with a numeric readout, and Copy heading to all waypoints / to the rest of the route for orbits and facade sweeps.

## Supporting details

- **Heading source per waypoint:** each waypoint records how its heading was decided — Fixed bearing, Aim at target, Face center, Follow path — shown as a chip in the waypoint row so a reviewer can tell intent at a glance. "Follow path" recomputes automatically when waypoints move; "Fixed" never changes silently.
- **Camera-correct rotation before capture:** when a waypoint has a photo/video action and an explicit heading, the planner inserts a Rotate aircraft (to heading) action ahead of the capture action in the ordered action list, so the aircraft is settled and facing the right way before the shutter fires. A short hover can be added for stabilization.
- **Gimbal stays separate:** heading is the aircraft yaw (left/right); gimbal pitch stays the existing up/down control. The inspector shows both together with a small preview of what the camera frames.
- **Readiness check:** add a readiness item flagging waypoints that capture media but have no heading set, so they can't slip into a published version by accident.
- **Waypoint list:** each row shows heading as a compass value plus arrow glyph (e.g. `312° NW`), so the whole route can be scanned for inconsistent aims.

## Technical notes

- Map layer: add a per-waypoint heading cone as a GeoJSON symbol/fill layer in `src/components/map/site-map.tsx`, plus an optional draggable "aim handle" Mapbox marker for the selected waypoint only, with `onWaypointHeadingChange(key, degrees)` and `onAimPointPicked(key, point)` callbacks. Bearing math reuses `bearing()` in `src/lib/geo.ts`.
- Planner state: extend `DraftWaypoint` in `src/lib/mission-planning.ts` with `heading_mode` and optional `aim_lat` / `aim_lng`; auto-generators set the mode they already imply (orbit → face center, grid → follow path).
- Persistence: `waypoints.heading` already exists. Heading mode and aim point are stored in the mission version snapshot JSON (no schema change), with an optional later migration if they need to be queryable.
- Export: `WPMLGenerator` / `MissionPackageService` in `src/lib/services/mission-package.ts` emit the resolved numeric heading and the rotate-before-capture action ordering, so DJI packages and the future Flight Agent behave identically to the preview.
- Simulator: `src/lib/services/flight-simulator.ts` uses the stored heading for aircraft yaw during replay instead of path bearing, so the simulation matches what was planned.

## Scope of the build

Phase 1 (recommended now): map heading cones, drag-to-aim handle for the selected waypoint, aim-at-target mode, presets + compass dial, heading in the waypoint list, rotate-before-capture ordering, readiness check.

Phase 2 (later): camera footprint preview rectangle on the map, and bulk heading tools across a selected range of waypoints.
