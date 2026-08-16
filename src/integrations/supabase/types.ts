export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      drones: {
        Row: {
          battery_capacity_minutes: number | null
          camera: string | null
          created_at: string
          flight_hours: number
          has_rtk: boolean
          id: string
          is_demo: boolean
          last_flight_at: string | null
          maintenance_status: string | null
          manufacturer: string
          model: string
          nickname: string | null
          organization_id: string
          registration_number: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["drone_status"]
          updated_at: string
        }
        Insert: {
          battery_capacity_minutes?: number | null
          camera?: string | null
          created_at?: string
          flight_hours?: number
          has_rtk?: boolean
          id?: string
          is_demo?: boolean
          last_flight_at?: string | null
          maintenance_status?: string | null
          manufacturer?: string
          model: string
          nickname?: string | null
          organization_id: string
          registration_number?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["drone_status"]
          updated_at?: string
        }
        Update: {
          battery_capacity_minutes?: number | null
          camera?: string | null
          created_at?: string
          flight_hours?: number
          has_rtk?: boolean
          id?: string
          is_demo?: boolean
          last_flight_at?: string | null
          maintenance_status?: string | null
          manufacturer?: string
          model?: string
          nickname?: string | null
          organization_id?: string
          registration_number?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["drone_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_agent_devices: {
        Row: {
          app_version: string | null
          assigned_drone_id: string | null
          created_at: string
          device_identifier: string
          device_name: string
          id: string
          last_seen: string | null
          organization_id: string
          pilot_id: string | null
          status: Database["public"]["Enums"]["device_status"]
          token_hash: string | null
          token_preview: string | null
        }
        Insert: {
          app_version?: string | null
          assigned_drone_id?: string | null
          created_at?: string
          device_identifier: string
          device_name: string
          id?: string
          last_seen?: string | null
          organization_id: string
          pilot_id?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          token_hash?: string | null
          token_preview?: string | null
        }
        Update: {
          app_version?: string | null
          assigned_drone_id?: string | null
          created_at?: string
          device_identifier?: string
          device_name?: string
          id?: string
          last_seen?: string | null
          organization_id?: string
          pilot_id?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          token_hash?: string | null
          token_preview?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_agent_devices_assigned_drone_id_fkey"
            columns: ["assigned_drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_agent_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_agent_devices_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_assignments: {
        Row: {
          created_at: string
          device_id: string | null
          dispatched_to_agent: boolean
          drone_id: string | null
          id: string
          mission_id: string
          mission_version_id: string | null
          notes: string | null
          organization_id: string
          pilot_id: string | null
          project_id: string
          schedule_id: string | null
          scheduled_for: string
          status: Database["public"]["Enums"]["flight_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          dispatched_to_agent?: boolean
          drone_id?: string | null
          id?: string
          mission_id: string
          mission_version_id?: string | null
          notes?: string | null
          organization_id: string
          pilot_id?: string | null
          project_id: string
          schedule_id?: string | null
          scheduled_for: string
          status?: Database["public"]["Enums"]["flight_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          dispatched_to_agent?: boolean
          drone_id?: string | null
          id?: string
          mission_id?: string
          mission_version_id?: string | null
          notes?: string | null
          organization_id?: string
          pilot_id?: string | null
          project_id?: string
          schedule_id?: string | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["flight_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_assignments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "flight_agent_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_assignments_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_assignments_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_assignments_mission_version_id_fkey"
            columns: ["mission_version_id"]
            isOneToOne: false
            referencedRelation: "mission_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_assignments_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "flight_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_events: {
        Row: {
          event_type: Database["public"]["Enums"]["flight_event_type"]
          flight_id: string
          id: string
          is_simulated: boolean
          message: string | null
          occurred_at: string
          organization_id: string
          payload: Json | null
          waypoint_sequence: number | null
        }
        Insert: {
          event_type: Database["public"]["Enums"]["flight_event_type"]
          flight_id: string
          id?: string
          is_simulated?: boolean
          message?: string | null
          occurred_at?: string
          organization_id: string
          payload?: Json | null
          waypoint_sequence?: number | null
        }
        Update: {
          event_type?: Database["public"]["Enums"]["flight_event_type"]
          flight_id?: string
          id?: string
          is_simulated?: boolean
          message?: string | null
          occurred_at?: string
          organization_id?: string
          payload?: Json | null
          waypoint_sequence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_events_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_schedules: {
        Row: {
          created_at: string
          cron_expression: string | null
          day_of_month: number | null
          day_of_week: number | null
          frequency: Database["public"]["Enums"]["schedule_frequency"]
          id: string
          is_active: boolean
          mission_id: string
          next_occurrence: string | null
          organization_id: string
          project_id: string
          time_of_day: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cron_expression?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          mission_id: string
          next_occurrence?: string | null
          organization_id: string
          project_id: string
          time_of_day?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cron_expression?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: Database["public"]["Enums"]["schedule_frequency"]
          id?: string
          is_active?: boolean
          mission_id?: string
          next_occurrence?: string | null
          organization_id?: string
          project_id?: string
          time_of_day?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_schedules_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_telemetry: {
        Row: {
          altitude_ft: number | null
          battery_percent: number | null
          current_waypoint: number | null
          distance_from_home_m: number | null
          flight_id: string
          flight_mode: string | null
          heading: number | null
          id: string
          is_simulated: boolean
          latitude: number | null
          longitude: number | null
          mission_progress: number | null
          organization_id: string
          recorded_at: string
          satellite_count: number | null
          speed_mph: number | null
        }
        Insert: {
          altitude_ft?: number | null
          battery_percent?: number | null
          current_waypoint?: number | null
          distance_from_home_m?: number | null
          flight_id: string
          flight_mode?: string | null
          heading?: number | null
          id?: string
          is_simulated?: boolean
          latitude?: number | null
          longitude?: number | null
          mission_progress?: number | null
          organization_id: string
          recorded_at?: string
          satellite_count?: number | null
          speed_mph?: number | null
        }
        Update: {
          altitude_ft?: number | null
          battery_percent?: number | null
          current_waypoint?: number | null
          distance_from_home_m?: number | null
          flight_id?: string
          flight_mode?: string | null
          heading?: number | null
          id?: string
          is_simulated?: boolean
          latitude?: number | null
          longitude?: number | null
          mission_progress?: number | null
          organization_id?: string
          recorded_at?: string
          satellite_count?: number | null
          speed_mph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_telemetry_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_telemetry_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flights: {
        Row: {
          assignment_id: string | null
          battery_end: number | null
          battery_start: number | null
          completion_percent: number
          created_at: string
          device_id: string | null
          distance_m: number | null
          drone_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_demo: boolean
          is_simulated: boolean
          max_altitude_ft: number | null
          mission_id: string
          mission_version_id: string | null
          organization_id: string
          photos_captured: number
          pilot_id: string | null
          project_id: string
          result: Database["public"]["Enums"]["flight_result"] | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["flight_status"]
          updated_at: string
          videos_captured: number
        }
        Insert: {
          assignment_id?: string | null
          battery_end?: number | null
          battery_start?: number | null
          completion_percent?: number
          created_at?: string
          device_id?: string | null
          distance_m?: number | null
          drone_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_demo?: boolean
          is_simulated?: boolean
          max_altitude_ft?: number | null
          mission_id: string
          mission_version_id?: string | null
          organization_id: string
          photos_captured?: number
          pilot_id?: string | null
          project_id: string
          result?: Database["public"]["Enums"]["flight_result"] | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["flight_status"]
          updated_at?: string
          videos_captured?: number
        }
        Update: {
          assignment_id?: string | null
          battery_end?: number | null
          battery_start?: number | null
          completion_percent?: number
          created_at?: string
          device_id?: string | null
          distance_m?: number | null
          drone_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_demo?: boolean
          is_simulated?: boolean
          max_altitude_ft?: number | null
          mission_id?: string
          mission_version_id?: string | null
          organization_id?: string
          photos_captured?: number
          pilot_id?: string | null
          project_id?: string
          result?: Database["public"]["Enums"]["flight_result"] | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["flight_status"]
          updated_at?: string
          videos_captured?: number
        }
        Relationships: [
          {
            foreignKeyName: "flights_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "flight_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "flight_agent_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_mission_version_id_fkey"
            columns: ["mission_version_id"]
            isOneToOne: false
            referencedRelation: "mission_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          connected_at: string | null
          created_at: string
          id: string
          organization_id: string
          provider: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          organization_id: string
          provider: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          aircraft: string | null
          altitude_ft: number | null
          camera: string | null
          captured_at: string | null
          created_at: string
          file_size_bytes: number | null
          file_url: string | null
          flight_id: string | null
          gimbal_pitch: number | null
          heading: number | null
          id: string
          is_demo: boolean
          latitude: number | null
          longitude: number | null
          media_type: Database["public"]["Enums"]["media_type"]
          mission_id: string | null
          organization_id: string
          project_id: string
          thumbnail_url: string | null
          waypoint_sequence: number | null
        }
        Insert: {
          aircraft?: string | null
          altitude_ft?: number | null
          camera?: string | null
          captured_at?: string | null
          created_at?: string
          file_size_bytes?: number | null
          file_url?: string | null
          flight_id?: string | null
          gimbal_pitch?: number | null
          heading?: number | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          media_type?: Database["public"]["Enums"]["media_type"]
          mission_id?: string | null
          organization_id: string
          project_id: string
          thumbnail_url?: string | null
          waypoint_sequence?: number | null
        }
        Update: {
          aircraft?: string | null
          altitude_ft?: number | null
          camera?: string | null
          captured_at?: string | null
          created_at?: string
          file_size_bytes?: number | null
          file_url?: string | null
          flight_id?: string | null
          gimbal_pitch?: number | null
          heading?: number | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          media_type?: Database["public"]["Enums"]["media_type"]
          mission_id?: string | null
          organization_id?: string
          project_id?: string
          thumbnail_url?: string | null
          waypoint_sequence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_versions: {
        Row: {
          change_note: string | null
          created_at: string
          created_by: string | null
          estimated_area_sq_m: number | null
          estimated_battery_percent: number | null
          estimated_distance_m: number | null
          estimated_duration_s: number | null
          estimated_photo_count: number | null
          id: string
          mission_id: string
          organization_id: string
          snapshot: Json
          version_number: number
          waypoint_count: number | null
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          estimated_area_sq_m?: number | null
          estimated_battery_percent?: number | null
          estimated_distance_m?: number | null
          estimated_duration_s?: number | null
          estimated_photo_count?: number | null
          id?: string
          mission_id: string
          organization_id: string
          snapshot: Json
          version_number: number
          waypoint_count?: number | null
        }
        Update: {
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          estimated_area_sq_m?: number | null
          estimated_battery_percent?: number | null
          estimated_distance_m?: number | null
          estimated_duration_s?: number | null
          estimated_photo_count?: number | null
          id?: string
          mission_id?: string
          organization_id?: string
          snapshot?: Json
          version_number?: number
          waypoint_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_versions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          aircraft_heading: string
          airspace_reviewed: boolean
          altitude_ft: number
          camera_mode: string
          created_at: string
          current_version: number
          description: string | null
          drone_id: string | null
          flight_area_geojson: Json | null
          flight_direction: number | null
          front_overlap: number | null
          gimbal_pitch: number
          id: string
          is_demo: boolean
          is_repeatable: boolean
          landing_lat: number | null
          landing_lng: number | null
          mission_type: Database["public"]["Enums"]["mission_type"]
          name: string
          organization_id: string
          photo_interval_seconds: number | null
          pilot_id: string | null
          project_id: string
          readiness_state: string
          repeat_frequency: Database["public"]["Enums"]["schedule_frequency"]
          rth_altitude_ft: number
          rth_lat: number | null
          rth_lng: number | null
          side_overlap: number | null
          speed_mph: number
          takeoff_lat: number | null
          takeoff_lng: number | null
          updated_at: string
          weather_reviewed: boolean
        }
        Insert: {
          aircraft_heading?: string
          airspace_reviewed?: boolean
          altitude_ft?: number
          camera_mode?: string
          created_at?: string
          current_version?: number
          description?: string | null
          drone_id?: string | null
          flight_area_geojson?: Json | null
          flight_direction?: number | null
          front_overlap?: number | null
          gimbal_pitch?: number
          id?: string
          is_demo?: boolean
          is_repeatable?: boolean
          landing_lat?: number | null
          landing_lng?: number | null
          mission_type?: Database["public"]["Enums"]["mission_type"]
          name: string
          organization_id: string
          photo_interval_seconds?: number | null
          pilot_id?: string | null
          project_id: string
          readiness_state?: string
          repeat_frequency?: Database["public"]["Enums"]["schedule_frequency"]
          rth_altitude_ft?: number
          rth_lat?: number | null
          rth_lng?: number | null
          side_overlap?: number | null
          speed_mph?: number
          takeoff_lat?: number | null
          takeoff_lng?: number | null
          updated_at?: string
          weather_reviewed?: boolean
        }
        Update: {
          aircraft_heading?: string
          airspace_reviewed?: boolean
          altitude_ft?: number
          camera_mode?: string
          created_at?: string
          current_version?: number
          description?: string | null
          drone_id?: string | null
          flight_area_geojson?: Json | null
          flight_direction?: number | null
          front_overlap?: number | null
          gimbal_pitch?: number
          id?: string
          is_demo?: boolean
          is_repeatable?: boolean
          landing_lat?: number | null
          landing_lng?: number | null
          mission_type?: Database["public"]["Enums"]["mission_type"]
          name?: string
          organization_id?: string
          photo_interval_seconds?: number | null
          pilot_id?: string | null
          project_id?: string
          readiness_state?: string
          repeat_frequency?: Database["public"]["Enums"]["schedule_frequency"]
          rth_altitude_ft?: number
          rth_lat?: number | null
          rth_lng?: number | null
          side_overlap?: number | null
          speed_mph?: number
          takeoff_lat?: number | null
          takeoff_lng?: number | null
          updated_at?: string
          weather_reviewed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "missions_drone_id_fkey"
            columns: ["drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          name: string
          slug: string | null
          telemetry_sample_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          slug?: string | null
          telemetry_sample_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          slug?: string | null
          telemetry_sample_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      pilots: {
        Row: {
          assigned_drone_id: string | null
          certificate_expiration: string | null
          created_at: string
          email: string | null
          faa_certificate_number: string | null
          flight_count: number
          flight_hours: number
          full_name: string
          id: string
          is_demo: boolean
          organization_id: string
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_drone_id?: string | null
          certificate_expiration?: string | null
          created_at?: string
          email?: string | null
          faa_certificate_number?: string | null
          flight_count?: number
          flight_hours?: number
          full_name: string
          id?: string
          is_demo?: boolean
          organization_id: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_drone_id?: string | null
          certificate_expiration?: string | null
          created_at?: string
          email?: string | null
          faa_certificate_number?: string | null
          flight_count?: number
          flight_hours?: number
          full_name?: string
          id?: string
          is_demo?: boolean
          organization_id?: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilots_assigned_drone_id_fkey"
            columns: ["assigned_drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      preflight_checklists: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          flight_id: string
          id: string
          items: Json
          organization_id: string
          pilot_id: string | null
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          flight_id: string
          id?: string
          items?: Json
          organization_id: string
          pilot_id?: string | null
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          flight_id?: string
          id?: string
          items?: Json
          organization_id?: string
          pilot_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preflight_checklists_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preflight_checklists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preflight_checklists_pilot_id_fkey"
            columns: ["pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_boundaries: {
        Row: {
          area_sq_meters: number | null
          created_at: string
          geojson: Json
          id: string
          kind: string
          label: string
          organization_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          area_sq_meters?: number | null
          created_at?: string
          geojson: Json
          id?: string
          kind?: string
          label?: string
          organization_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          area_sq_meters?: number | null
          created_at?: string
          geojson?: Json
          id?: string
          kind?: string
          label?: string
          organization_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_boundaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_boundaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          client: string | null
          created_at: string
          default_drone_id: string | null
          default_pilot_id: string | null
          description: string | null
          estimated_completion: string | null
          id: string
          is_demo: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          procore_project_id: string | null
          progress_percent: number
          project_manager: string | null
          project_number: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          superintendent: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client?: string | null
          created_at?: string
          default_drone_id?: string | null
          default_pilot_id?: string | null
          description?: string | null
          estimated_completion?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          procore_project_id?: string | null
          progress_percent?: number
          project_manager?: string | null
          project_number?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          superintendent?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client?: string | null
          created_at?: string
          default_drone_id?: string | null
          default_pilot_id?: string | null
          description?: string | null
          estimated_completion?: string | null
          id?: string
          is_demo?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          procore_project_id?: string | null
          progress_percent?: number
          project_manager?: string | null
          project_number?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          superintendent?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_default_drone_fkey"
            columns: ["default_drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_default_pilot_fkey"
            columns: ["default_pilot_id"]
            isOneToOne: false
            referencedRelation: "pilots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          created_by: string | null
          flight_id: string | null
          id: string
          is_demo: boolean
          notes: string | null
          organization_id: string
          project_id: string
          report_type: string
          selected_media_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          flight_id?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          organization_id: string
          project_id: string
          report_type?: string
          selected_media_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          flight_id?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          organization_id?: string
          project_id?: string
          report_type?: string
          selected_media_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      waypoint_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["waypoint_action_type"]
          created_at: string
          id: string
          organization_id: string
          param_numeric: number | null
          param_text: string | null
          sequence: number
          waypoint_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["waypoint_action_type"]
          created_at?: string
          id?: string
          organization_id: string
          param_numeric?: number | null
          param_text?: string | null
          sequence?: number
          waypoint_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["waypoint_action_type"]
          created_at?: string
          id?: string
          organization_id?: string
          param_numeric?: number | null
          param_text?: string | null
          sequence?: number
          waypoint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waypoint_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waypoint_actions_waypoint_id_fkey"
            columns: ["waypoint_id"]
            isOneToOne: false
            referencedRelation: "waypoints"
            referencedColumns: ["id"]
          },
        ]
      }
      waypoints: {
        Row: {
          altitude_ft: number
          created_at: string
          gimbal_pitch: number | null
          heading: number | null
          id: string
          label: string | null
          latitude: number
          longitude: number
          mission_id: string
          organization_id: string
          sequence: number
          speed_mph: number | null
          updated_at: string
        }
        Insert: {
          altitude_ft?: number
          created_at?: string
          gimbal_pitch?: number | null
          heading?: number | null
          id?: string
          label?: string | null
          latitude: number
          longitude: number
          mission_id: string
          organization_id: string
          sequence: number
          speed_mph?: number | null
          updated_at?: string
        }
        Update: {
          altitude_ft?: number
          created_at?: string
          gimbal_pitch?: number | null
          heading?: number | null
          id?: string
          label?: string | null
          latitude?: number
          longitude?: number
          mission_id?: string
          organization_id?: string
          sequence?: number
          speed_mph?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waypoints_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waypoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit: { Args: never; Returns: boolean }
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "administrator"
        | "drone_program_manager"
        | "project_manager"
        | "pilot"
        | "viewer"
      device_status: "active" | "offline" | "revoked" | "update_required"
      drone_status:
        | "available"
        | "assigned"
        | "flying"
        | "charging"
        | "maintenance"
        | "offline"
      flight_event_type:
        | "AIRCRAFT_CONNECTED"
        | "MISSION_DOWNLOADED"
        | "PREFLIGHT_COMPLETE"
        | "TAKEOFF"
        | "MISSION_STARTED"
        | "WAYPOINT_REACHED"
        | "PHOTO_CAPTURED"
        | "VIDEO_STARTED"
        | "VIDEO_STOPPED"
        | "LOW_BATTERY"
        | "RETURN_TO_HOME"
        | "LANDING"
        | "MISSION_COMPLETE"
        | "MISSION_ABORTED"
        | "CONNECTION_LOST"
        | "ERROR"
      flight_result: "completed" | "partial" | "aborted" | "failed"
      flight_status:
        | "scheduled"
        | "assigned"
        | "preflight"
        | "in_progress"
        | "completed"
        | "aborted"
        | "failed"
      integration_status:
        | "not_connected"
        | "connected"
        | "coming_soon"
        | "flight_agent_required"
        | "error"
      media_type: "photo" | "video" | "orthomosaic" | "model_3d" | "point_cloud"
      mission_type:
        | "weekly_progress"
        | "mapping"
        | "site_perimeter"
        | "point_inspection"
        | "custom"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "archived"
      schedule_frequency:
        | "manual"
        | "daily"
        | "weekly"
        | "biweekly"
        | "monthly"
        | "custom"
      waypoint_action_type:
        | "take_photo"
        | "start_video"
        | "stop_video"
        | "rotate_aircraft"
        | "rotate_gimbal"
        | "hover"
        | "wait"
        | "continue"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "administrator",
        "drone_program_manager",
        "project_manager",
        "pilot",
        "viewer",
      ],
      device_status: ["active", "offline", "revoked", "update_required"],
      drone_status: [
        "available",
        "assigned",
        "flying",
        "charging",
        "maintenance",
        "offline",
      ],
      flight_event_type: [
        "AIRCRAFT_CONNECTED",
        "MISSION_DOWNLOADED",
        "PREFLIGHT_COMPLETE",
        "TAKEOFF",
        "MISSION_STARTED",
        "WAYPOINT_REACHED",
        "PHOTO_CAPTURED",
        "VIDEO_STARTED",
        "VIDEO_STOPPED",
        "LOW_BATTERY",
        "RETURN_TO_HOME",
        "LANDING",
        "MISSION_COMPLETE",
        "MISSION_ABORTED",
        "CONNECTION_LOST",
        "ERROR",
      ],
      flight_result: ["completed", "partial", "aborted", "failed"],
      flight_status: [
        "scheduled",
        "assigned",
        "preflight",
        "in_progress",
        "completed",
        "aborted",
        "failed",
      ],
      integration_status: [
        "not_connected",
        "connected",
        "coming_soon",
        "flight_agent_required",
        "error",
      ],
      media_type: ["photo", "video", "orthomosaic", "model_3d", "point_cloud"],
      mission_type: [
        "weekly_progress",
        "mapping",
        "site_perimeter",
        "point_inspection",
        "custom",
      ],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "archived",
      ],
      schedule_frequency: [
        "manual",
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "custom",
      ],
      waypoint_action_type: [
        "take_photo",
        "start_video",
        "stop_video",
        "rotate_aircraft",
        "rotate_gimbal",
        "hover",
        "wait",
        "continue",
      ],
    },
  },
} as const
