
DO $$
DECLARE
  org uuid := '11111111-1111-4111-8111-111111111111';
  proj uuid := '22222222-2222-4222-8222-222222222222';
  mav uuid := '33333333-3333-4333-8333-333333333331';
  m4e uuid := '33333333-3333-4333-8333-333333333332';
  m350 uuid := '33333333-3333-4333-8333-333333333333';
  p1 uuid := '44444444-4444-4444-8444-444444444441';
  p2 uuid := '44444444-4444-4444-8444-444444444442';
  p3 uuid := '44444444-4444-4444-8444-444444444443';
  mis uuid := '55555555-5555-4555-8555-555555555555';
  mv uuid := '66666666-6666-4666-8666-666666666666';
  sch uuid := '77777777-7777-4777-8777-777777777777';
  dev uuid := '88888888-8888-4888-8888-888888888888';
  ctr_lat double precision := 39.8290;
  ctr_lng double precision := -104.9330;
  rad_lat double precision := 0.0030;
  rad_lng double precision := 0.0040;
  snap jsonb;
  wp_count int;
  flight_dates timestamptz[] := ARRAY['2026-07-17 08:00-06','2026-07-24 08:00-06','2026-07-31 08:00-06','2026-08-07 08:00-06']::timestamptz[];
  fdate timestamptz;
  fid uuid;
  i int;
  imgs text[] := ARRAY['/demo/site-early.jpg','/demo/site-earthwork.jpg','/demo/site-roof.jpg','/demo/site-late.jpg'];
BEGIN
INSERT INTO public.organizations (id, name, slug, is_demo, telemetry_sample_seconds)
VALUES (org, 'Demo Construction Group', 'demo', true, 2);

INSERT INTO public.drones (id, organization_id, manufacturer, model, serial_number, registration_number, nickname, camera, has_rtk, status, last_flight_at, flight_hours, maintenance_status, battery_capacity_minutes, is_demo) VALUES
 (mav, org, 'DJI', 'Mavic 3 Enterprise', '1581F5FMD24AB00X921', 'FA3K7LQMNP', 'Bravo One', 'M3E 4/3 CMOS 20MP + 56x Zoom', false, 'available', '2026-08-07 08:41-06', 84.5, 'OK', 40, true),
 (m4e, org, 'DJI', 'Matrice 4E', '1581F5FMD24AB00X944', 'FA9B2XRTVC', 'Survey Two', 'M4E Wide / Tele / Medium Tele', true, 'charging', '2026-07-31 09:12-06', 41.2, 'Prop set replaced 2026-07-20', 45, true),
 (m350, org, 'DJI', 'Matrice 350 RTK', '1581F5FMD24AB00X977', 'FA5T8WQZKD', 'Heavy Three', 'Zenmuse P1 45MP Full Frame', true, 'maintenance', '2026-07-24 07:55-06', 152.8, 'Gimbal calibration due', 55, true);

INSERT INTO public.pilots (id, organization_id, full_name, email, phone, faa_certificate_number, certificate_expiration, assigned_drone_id, flight_count, flight_hours, is_demo) VALUES
 (p1, org, 'Marcus Delgado', 'marcus.delgado@demo-construction.test', '(303) 555-0142', '4021887', '2027-11-30', mav, 148, 92.4, true),
 (p2, org, 'Tanya Whitfield', 'tanya.whitfield@demo-construction.test', '(720) 555-0188', '3918442', '2026-10-15', m4e, 96, 63.1, true),
 (p3, org, 'Ray Okafor', 'ray.okafor@demo-construction.test', '(303) 555-0119', '4477209', '2028-04-02', m350, 212, 171.6, true);

INSERT INTO public.projects (id, organization_id, name, project_number, client, address, latitude, longitude, project_manager, superintendent, start_date, estimated_completion, description, status, procore_project_id, default_drone_id, default_pilot_id, progress_percent, is_demo)
VALUES (proj, org, 'PHOENIX DATA CENTER', 'DEN-2026-0148', 'Meridian Digital Infrastructure', '18400 E 96th Ave, Commerce City, CO 80022', ctr_lat, ctr_lng, 'Elena Vasquez', 'Doug Brenner', '2026-02-09', '2027-05-28', 'Ground-up 320,000 SF hyperscale data center shell with central utility plant, generator yard and 34.5kV substation tie-in. Weekly aerial documentation for owner reporting and earthwork verification.', 'active', '1099544712345', mav, p1, 46, true);

INSERT INTO public.project_boundaries (organization_id, project_id, label, kind, geojson, area_sq_meters) VALUES
 (org, proj, 'Site Boundary', 'site', jsonb_build_object(
   'type','Feature','properties', jsonb_build_object('kind','site'),
   'geometry', jsonb_build_object('type','Polygon','coordinates', jsonb_build_array(jsonb_build_array(
     jsonb_build_array(ctr_lng - rad_lng, ctr_lat - rad_lat),
     jsonb_build_array(ctr_lng + rad_lng, ctr_lat - rad_lat),
     jsonb_build_array(ctr_lng + rad_lng, ctr_lat + rad_lat),
     jsonb_build_array(ctr_lng - rad_lng, ctr_lat + rad_lat),
     jsonb_build_array(ctr_lng - rad_lng, ctr_lat - rad_lat))))), 456000);

INSERT INTO public.missions (id, organization_id, project_id, name, mission_type, description, is_repeatable, altitude_ft, speed_mph, camera_mode, photo_interval_seconds, gimbal_pitch, aircraft_heading, rth_altitude_ft, takeoff_lat, takeoff_lng, landing_lat, landing_lng, rth_lat, rth_lng, drone_id, pilot_id, repeat_frequency, current_version, readiness_state, weather_reviewed, airspace_reviewed, is_demo)
VALUES (mis, org, proj, 'WEEKLY CONSTRUCTION PROGRESS', 'weekly_progress', 'Repeatable owner-reporting orbit flown every Friday morning. Geometry is locked so week-over-week imagery is captured from the same positions and camera angles.', true, 150, 12, 'photo', 2, -45, 'point_to_center', 200, ctr_lat - rad_lat - 0.0006, ctr_lng - rad_lng - 0.0006, ctr_lat - rad_lat - 0.0006, ctr_lng - rad_lng - 0.0006, ctr_lat - rad_lat - 0.0006, ctr_lng - rad_lng - 0.0006, mav, p1, 'weekly', 1, 'READY', true, true, true);

INSERT INTO public.waypoints (organization_id, mission_id, sequence, latitude, longitude, altitude_ft, heading, gimbal_pitch, speed_mph, label)
SELECT org, mis, s,
  ctr_lat + rad_lat * 1.15 * cos(2*pi()*(s-1)/20.0),
  ctr_lng + rad_lng * 1.15 * sin(2*pi()*(s-1)/20.0),
  150,
  round(((degrees(atan2(-sin(2*pi()*(s-1)/20.0), -cos(2*pi()*(s-1)/20.0))) + 360)::numeric) % 360, 0),
  -45, 12,
  'Orbit ' || lpad(s::text, 2, '0')
FROM generate_series(1, 20) AS s;

INSERT INTO public.waypoint_actions (organization_id, waypoint_id, sequence, action_type, param_numeric)
SELECT org, w.id, 1, 'take_photo', NULL FROM public.waypoints w WHERE w.mission_id = mis;
INSERT INTO public.waypoint_actions (organization_id, waypoint_id, sequence, action_type, param_numeric)
SELECT org, w.id, 2, 'hover', 2 FROM public.waypoints w WHERE w.mission_id = mis AND w.sequence % 5 = 0;

SELECT count(*) INTO wp_count FROM public.waypoints WHERE mission_id = mis;

SELECT jsonb_build_object(
  'mission', to_jsonb(m) - 'organization_id',
  'waypoints', (SELECT jsonb_agg(jsonb_build_object(
      'sequence', w.sequence, 'latitude', w.latitude, 'longitude', w.longitude,
      'altitude_ft', w.altitude_ft, 'heading', w.heading, 'gimbal_pitch', w.gimbal_pitch,
      'speed_mph', w.speed_mph, 'label', w.label,
      'actions', (SELECT jsonb_agg(jsonb_build_object('sequence', a.sequence, 'action_type', a.action_type, 'param_numeric', a.param_numeric) ORDER BY a.sequence) FROM public.waypoint_actions a WHERE a.waypoint_id = w.id)
    ) ORDER BY w.sequence) FROM public.waypoints w WHERE w.mission_id = mis)
) INTO snap FROM public.missions m WHERE m.id = mis;

INSERT INTO public.mission_versions (id, organization_id, mission_id, version_number, change_note, snapshot, estimated_distance_m, estimated_duration_s, estimated_area_sq_m, estimated_photo_count, estimated_battery_percent, waypoint_count)
VALUES (mv, org, mis, 1, 'Initial locked geometry approved by drone program manager.', snap, 2410, 585, 456000, 24, 42, wp_count);

INSERT INTO public.flight_schedules (id, organization_id, project_id, mission_id, frequency, day_of_week, time_of_day, timezone, is_active, next_occurrence)
VALUES (sch, org, proj, mis, 'weekly', 5, '08:00', 'America/Denver', true, '2026-08-21 08:00-06');

INSERT INTO public.flight_agent_devices (id, organization_id, device_name, device_identifier, pilot_id, assigned_drone_id, app_version, status, last_seen)
VALUES (dev, org, 'Field Tablet 01 (Samsung Tab Active5)', 'AGT-DEN-0001', p1, mav, '0.9.2', 'offline', '2026-08-07 09:05-06');

INSERT INTO public.flight_assignments (organization_id, project_id, mission_id, mission_version_id, schedule_id, pilot_id, drone_id, device_id, scheduled_for, status, dispatched_to_agent, notes)
VALUES (org, proj, mis, mv, sch, p1, mav, dev, '2026-08-21 08:00-06', 'scheduled', false, 'Owner update flight. Coordinate with superintendent for crane down-time window.');

FOREACH fdate IN ARRAY flight_dates LOOP
  fid := gen_random_uuid();
  i := array_position(flight_dates, fdate);
  INSERT INTO public.flights (id, organization_id, project_id, mission_id, mission_version_id, pilot_id, drone_id, device_id, scheduled_at, started_at, ended_at, duration_seconds, distance_m, max_altitude_ft, photos_captured, videos_captured, battery_start, battery_end, completion_percent, status, result, is_simulated, is_demo)
  VALUES (fid, org, proj, mis, mv, p1, mav, dev, fdate, fdate + interval '4 minutes',
    fdate + interval '4 minutes' + make_interval(secs => 570 + i*11),
    570 + i*11, 2390 + i*18, 152, 24, 0, 98 - i, 55 - i*2,
    CASE WHEN i = 2 THEN 78 ELSE 100 END, 'completed'::public.flight_status,
    (CASE WHEN i = 2 THEN 'partial' ELSE 'completed' END)::public.flight_result, false, true);

  INSERT INTO public.preflight_checklists (organization_id, flight_id, pilot_id, items, completed, completed_at)
  VALUES (org, fid, p1, jsonb_build_array(
    jsonb_build_object('key','aircraft_inspected','label','Aircraft inspected','checked',true),
    jsonb_build_object('key','propellers_inspected','label','Propellers inspected','checked',true),
    jsonb_build_object('key','battery_inspected','label','Battery inspected','checked',true),
    jsonb_build_object('key','weather_reviewed','label','Weather reviewed','checked',true),
    jsonb_build_object('key','airspace_reviewed','label','Airspace reviewed','checked',true),
    jsonb_build_object('key','takeoff_area_secure','label','Takeoff area secure','checked',true),
    jsonb_build_object('key','flight_path_reviewed','label','Flight path reviewed','checked',true),
    jsonb_build_object('key','rth_verified','label','Return-to-home altitude verified','checked',true),
    jsonb_build_object('key','authorization_confirmed','label','Required authorization confirmed','checked',true)
  ), true, fdate + interval '2 minutes');

  INSERT INTO public.flight_events (organization_id, flight_id, event_type, message, waypoint_sequence, occurred_at) VALUES
   (org, fid, 'AIRCRAFT_CONNECTED', 'Flight Agent connected to Mavic 3 Enterprise', NULL, fdate + interval '1 minute'),
   (org, fid, 'MISSION_DOWNLOADED', 'Mission package v1 downloaded to aircraft', NULL, fdate + interval '2 minutes'),
   (org, fid, 'PREFLIGHT_COMPLETE', 'Preflight checklist completed by Marcus Delgado', NULL, fdate + interval '3 minutes'),
   (org, fid, 'TAKEOFF', 'Takeoff from designated launch pad', NULL, fdate + interval '4 minutes'),
   (org, fid, 'MISSION_STARTED', 'Waypoint mission started', 1, fdate + interval '4 minutes 20 seconds'),
   (org, fid, 'WAYPOINT_REACHED', 'Waypoint 10 reached', 10, fdate + interval '9 minutes'),
   (org, fid, 'PHOTO_CAPTURED', 'Photo captured at waypoint 10', 10, fdate + interval '9 minutes 2 seconds');

  IF i = 2 THEN
    INSERT INTO public.flight_events (organization_id, flight_id, event_type, message, waypoint_sequence, occurred_at) VALUES
     (org, fid, 'LOW_BATTERY', 'Battery below configured threshold at waypoint 16', 16, fdate + interval '12 minutes'),
     (org, fid, 'RETURN_TO_HOME', 'Return-to-home initiated', 16, fdate + interval '12 minutes 5 seconds'),
     (org, fid, 'LANDING', 'Landing at home point', NULL, fdate + interval '13 minutes'),
     (org, fid, 'MISSION_ABORTED', 'Mission ended early at 78% completion', NULL, fdate + interval '13 minutes 20 seconds');
  ELSE
    INSERT INTO public.flight_events (organization_id, flight_id, event_type, message, waypoint_sequence, occurred_at) VALUES
     (org, fid, 'WAYPOINT_REACHED', 'Waypoint 20 reached', 20, fdate + interval '12 minutes 30 seconds'),
     (org, fid, 'RETURN_TO_HOME', 'Return-to-home initiated', NULL, fdate + interval '12 minutes 45 seconds'),
     (org, fid, 'LANDING', 'Landing at home point', NULL, fdate + interval '13 minutes 20 seconds'),
     (org, fid, 'MISSION_COMPLETE', 'Mission completed, 24 photos captured', NULL, fdate + interval '13 minutes 30 seconds');
  END IF;

  INSERT INTO public.flight_telemetry (organization_id, flight_id, recorded_at, latitude, longitude, altitude_ft, speed_mph, heading, battery_percent, satellite_count, current_waypoint, flight_mode, distance_from_home_m, mission_progress)
  SELECT org, fid, fdate + interval '4 minutes' + make_interval(secs => (w.sequence - 1) * 28),
    w.latitude, w.longitude, w.altitude_ft, 12, w.heading,
    (98 - i) - round(((98 - i) - (55 - i*2)) * (w.sequence - 1) / 19.0),
    17 + (w.sequence % 4), w.sequence, 'WAYPOINT_MISSION',
    round((111320 * sqrt(pow(w.latitude - (ctr_lat - rad_lat - 0.0006), 2) + pow((w.longitude - (ctr_lng - rad_lng - 0.0006)) * 0.77, 2)))::numeric, 0),
    round((w.sequence * 100.0 / 20.0)::numeric, 1)
  FROM public.waypoints w WHERE w.mission_id = mis
    AND (i <> 2 OR w.sequence <= 16);

  INSERT INTO public.media (organization_id, project_id, mission_id, flight_id, waypoint_sequence, media_type, file_url, thumbnail_url, captured_at, latitude, longitude, altitude_ft, heading, gimbal_pitch, aircraft, camera, file_size_bytes, is_demo)
  SELECT org, proj, mis, fid, w.sequence, 'photo',
    imgs[1 + ((w.sequence / 5 + i) % 4)], imgs[1 + ((w.sequence / 5 + i) % 4)],
    fdate + interval '4 minutes' + make_interval(secs => (w.sequence - 1) * 28),
    w.latitude, w.longitude, w.altitude_ft, w.heading, w.gimbal_pitch,
    'DJI Mavic 3 Enterprise', 'M3E 20MP', 8400000 + w.sequence * 1000, true
  FROM public.waypoints w WHERE w.mission_id = mis AND w.sequence % 5 = 0 AND (i <> 2 OR w.sequence <= 16);

  IF i = 4 THEN
    INSERT INTO public.reports (organization_id, project_id, flight_id, title, report_type, notes, is_demo)
    VALUES (org, proj, fid, 'Construction Flight Report — August 7, 2026', 'construction_flight_report', 'Weekly owner update. Roof decking approximately 60% complete; generator yard formwork started.', true);
  END IF;
END LOOP;

INSERT INTO public.integrations (organization_id, provider, status, config) VALUES
 (org, 'dji_mobile_sdk', 'flight_agent_required', '{"note":"Aircraft communication occurs through the companion Android Flight Agent."}'),
 (org, 'dji_cloud_api', 'coming_soon', '{"note":"Reserved for future DJI Dock autonomous operations."}'),
 (org, 'procore', 'not_connected', '{}'),
 (org, 'weather', 'not_connected', '{"note":"No weather provider configured. Displayed values are demo data."}');
END $$;
