# Construction Drone Mission Platform

A multi-tenant SaaS where construction teams plan a drone mission once, version it, schedule it, and fly the identical route for the life of the project — building a structured visual history of the site. The project is the primary entity; missions collect data; flights execute missions; media documents construction.

Everything in the spec gets built in one pass. Anything not genuinely wired to a DJI aircraft or a live third-party API is labeled **SIMULATION**, **DJI CONNECTION NOT CONFIGURED**, **DEMO WEATHER DATA**, or **NOT CONNECTED**. No faked DJI telemetry, no faked OAuth, no faked AI findings.

## Backend (Lovable Cloud)

Tables, all UUID PKs, all scoped by `organization_id`, all with RLS:

`organizations`, `profiles`, `user_roles`, `projects`, `project_boundaries`, `drones`, `pilots`, `missions`, `mission_versions`, `waypoints`, `waypoint_actions`, `flight_schedules`, `flight_assignments`, `flight_agent_devices`, `flights`, `flight_events`, `flight_telemetry`, `media`, `reports`, `integrations`, `preflight_checklists`.

- Roles live in a separate `user_roles` table with an `app_role` enum (administrator, drone_program_manager, project_manager, pilot, viewer) and a security-definer `has_role()` function. Never on `profiles`.
- Org isolation via a security-definer `current_org_id()` helper used by every policy, so no user can read another org's rows.
- Mission geometry is immutable: editing a mission writes a new `mission_versions` row with a full frozen copy of waypoints, actions, camera and safety settings. History is never overwritten — this is what makes week-over-week photo comparison possible.
- `flight_telemetry` is written at a configurable sample interval (default ~1 Hz ingest, stored downsampled) rather than unbounded high-frequency writes.
- Realtime enabled on `flights`, `flight_telemetry`, and `flight_events` so mission control updates live once a real Flight Agent posts data.
- Auth: email/password sign-up. New users are placed into the seeded demo organization so the app is immediately populated.

## Flight Agent API

A token-authenticated API surface for the future Android DJI Mobile SDK app. Devices register in `flight_agent_devices` (ACTIVE / OFFLINE / REVOKED / UPDATE REQUIRED) and authenticate with a hashed, revocable device token — never Supabase service credentials.

Endpoints: list assigned missions, fetch a mission, fetch its mission package, create a flight, start, telemetry, event, media, complete, abort. Each is documented in-app on the DJI integration page with request/response shapes so the Android team can build against it.

## Mission package + export services

A standardized serializable package (Mission, MissionVersion, Project, AircraftRequirements, Takeoff, Landing, ReturnToHome, Waypoints, WaypointActions, CameraSettings, SafetySettings, Metadata) produced by `MissionPackageService`, with `DJIMissionService`, `WPMLGenerator`, KML/GeoJSON/JSON exporters, plus `FlightExecutionService`, `TelemetryService`, `MediaIngestionService`.

## Screens

**Dashboard** — command center: active projects (location, last/next flight, active mission, progress), upcoming flights (pilot, drone, weather, readiness), recent flights (duration, photos, completion, result), fleet status board.

**Projects** — full field set including Procore project ID, default drone/pilot; boundary drawn on satellite imagery and stored as geometry. Tabs: Overview, Missions, Flights, Media, Progress, Reports, Settings.

**Flight Planner** — the centerpiece. Full-screen Mapbox satellite map with location search, boundary and flight-area drawing, waypoint add/move/delete/reorder, numbered markers (01, 02, 03…), route polyline, takeoff/landing/RTH markers. Mission templates: Weekly Construction Progress (orbit/cross route), Mapping (auto lawnmower grid from polygon with altitude, front/side overlap, direction, speed, camera angle), Site Perimeter (follows project boundary), Point Inspection (roof, mechanical, facade, electrical yard, crane, laydown), Custom. Per-waypoint lat/lon/altitude/heading/gimbal/speed and multiple actions (take photo, start/stop video, rotate aircraft, rotate gimbal, hover, wait, continue). Live estimation panel — distance, duration, area, waypoint count, photo count, battery usage — labeled as planning calculations, not aircraft performance guarantees. Mission Readiness panel with all eleven checks and READY / REVIEW REQUIRED / BLOCKED, explicitly not a regulatory compliance determination.

**Missions** — repeatable mission library, version history diff, schedule editor (manual, daily, weekly, biweekly, monthly, custom; e.g. every Friday 8:00 AM) that creates flight assignments and never launches an aircraft.

**Flights** — assignment queue, preflight checklist (nine items, stored with the flight record), and the mission-control execution screen: large map, flight path, aircraft position, current waypoint, altitude, speed, heading, battery, GNSS, duration, distance, completion %, and a full event timeline. A **SIMULATE FLIGHT** control animates an aircraft through the route with simulated telemetry under a persistent **SIMULATION MODE** banner. Flight history stores the full record set with COMPLETED / PARTIAL / ABORTED / FAILED.

**Media** — library of photos and videos with project/mission/flight/waypoint/GPS/altitude/aircraft/camera metadata, geographic display on the project map, and placeholders for future orthomosaics, 3D models, point clouds.

**Progress Timeline** — compare two flights (e.g. July 15 vs August 15), matching images by mission, waypoint, camera direction, and approximate GPS, shown side-by-side and via an interactive before/after slider.

**Fleet** — manufacturer-agnostic aircraft records (model, serial, registration, nickname, camera, RTK, status, last flight, flight hours, maintenance).

**Pilots** — profiles with FAA certificate number and expiration, assignments, flight counts and hours; the app states it does not verify FAA certification.

**Reports** — printable Construction Flight Report with company, project, mission, date, pilot, aircraft, duration, distance, area, photos, completion, flight path map, selected images.

**Integrations** — DJI page with DJI Mobile SDK (**FLIGHT AGENT REQUIRED**, with the explanation that aircraft communication happens through the companion Android agent) and DJI Cloud API (**COMING SOON**, Dock architecture anticipated but not implemented); Procore (**NOT CONNECTED**, real CONNECT PROCORE button wired to an unconfigured OAuth architecture); Weather (architecture ready, mocked values badged **DEMO WEATHER DATA**); and Construction Intelligence modules (progress, change, material, earthwork, equipment, safety, logistics) clearly marked as future, with no fabricated results.

**Settings** — organization, members and roles, device management with revoke, defaults.

## Seed data

Demo organization with **PHOENIX DATA CENTER** in the Denver metro area, a boundary polygon, the **WEEKLY CONSTRUCTION PROGRESS** mission at 150 ft / 12 mph / -45° gimbal with ~20 waypoints, an every-Friday 8:00 AM schedule, the three DJI aircraft (Mavic 3 Enterprise, Matrice 4E, Matrice 350 RTK), pilots, several completed historical flights with telemetry, events and generated construction imagery for timeline comparison. All seeded rows are badged as demo data.

## Design

Desktop-first responsive. Construction technology plus aviation mission control plus GIS: large maps, dense but legible typography, telemetry cards, status chips, progress bars, timelines, data tables, strong hierarchy. Dark instrument-panel surfaces for map and flight screens, light structured surfaces for tables and reports, high-visibility safety accent for status and alerts. Semantic design tokens only — no hardcoded colors. Deliberately not a hobby-drone aesthetic.

## Technical notes

- Mapbox token stored as a secret and read through a server function, never hardcoded; map components render a configuration notice if it is absent.
- Server logic uses TanStack server functions for app-internal work and public API routes for the Flight Agent endpoints, with token verification inside each handler.
- Strong TypeScript types generated from the schema; shared service layer; reusable components.
- Given the scope, this is built in sequenced passes within this one effort: schema and RLS, then services and Flight Agent API, then planner and mission versioning, then execution and telemetry, then media, timeline, reports and integrations.
