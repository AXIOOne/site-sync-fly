# SiteView Missions

Build a Construction Drone Mission Platform with DJI Flight-Control Integration Architecture

Build a production-ready SaaS application for construction companies to plan, schedule, execute, document, and repeat DJI drone flights over construction projects.

The product should be designed around one core concept:

Construction teams create repeatable drone missions once and then fly the exact same route throughout the life of the project.

The platform should eventually support automated construction documentation, progress comparison, visual intelligence, Procore integration, and DJI Dock operations.

This is NOT a generic consumer drone application.

The construction project is the center of the product.

The drone is the data-collection mechanism.



CRITICAL ARCHITECTURE DECISION

The system will consist of two components:

1. Main Web Application

Build this application in Lovable using:

React

TypeScript

Supabase

Mapbox

Supabase Edge Functions

The web application handles:

Organizations

Users

Projects

Construction site boundaries

Mission planning

Waypoint creation

Mission templates

Mission versioning

Mission scheduling

Drone fleet

Pilots

Flight assignments

Mission packages

Flight history

Media

Progress comparisons

Reporting

Integrations

Administration

2. DJI Flight Agent

The actual connection to DJI aircraft will eventually be handled by a lightweight native Android application using DJI Mobile SDK 5.

Lovable is NOT expected to implement DJI Mobile SDK aircraft control inside the browser.

However, Lovable MUST build the backend architecture, database, APIs, authentication model, mission package format, telemetry ingestion, and user experience required by the future DJI Flight Agent.

The DJI Flight Agent should eventually be able to:

Authenticate

Retrieve assigned missions

Download a mission package

Connect to a DJI aircraft

Upload the mission to the aircraft

Start the mission after pilot confirmation

Send telemetry back to this platform

Report mission events

Report mission completion

Associate captured media with the flight

Do not fake DJI connectivity.

Any functionality not actually connected to DJI should clearly show:

SIMULATION

or

DJI CONNECTION NOT CONFIGURED



PRIMARY NAVIGATION

Create:

Dashboard

Projects

Missions

Flights

Media

Fleet

Pilots

Reports

Integrations

Settings

Use a desktop-first responsive design.

The interface should feel like a combination of:

construction technology

aviation mission control

GIS software

enterprise SaaS

Use large maps, clean typography, telemetry cards, status indicators, progress bars, timelines, tables, and strong information hierarchy.

Avoid a hobby-drone aesthetic.



DASHBOARD

Create a command-center dashboard.

Show:

Active Projects

Project Name

Location

Last Flight

Next Flight

Active Mission

Progress

Upcoming Flights

Project

Mission

Scheduled Date

Pilot

Drone

Weather

Mission Readiness

Recent Flights

Project

Mission

Flight Date

Duration

Photos

Completion

Result

Fleet

Show aircraft status:

AVAILABLE

ASSIGNED

FLYING

CHARGING

MAINTENANCE

OFFLINE

Seed example aircraft:

DJI Mavic 3 Enterprise

DJI Matrice 4E

DJI Matrice 350 RTK



PROJECT MANAGEMENT

Users create construction projects.

Fields:

Project Name

Project Number

Client

Address

Latitude

Longitude

Project Manager

Superintendent

Start Date

Estimated Completion

Description

Status

Procore Project ID

Default Drone

Default Pilot

Allow users to draw the project boundary on satellite imagery.

Store boundary geometry.

Project page tabs:

OVERVIEW

MISSIONS

FLIGHTS

MEDIA

PROGRESS

REPORTS

SETTINGS



FLIGHT PLANNER

This is the most important interface.

Build a full-screen interactive satellite map using Mapbox.

Allow users to:

Search location

Draw construction site boundary

Draw flight area

Add waypoint

Move waypoint

Delete waypoint

Reorder waypoint

Define takeoff location

Define landing location

Define return-to-home

Display flight path.

Number waypoints visually:

01

02

03

04

etc.

Display the route connecting them.



AUTOMATIC MISSION GENERATION

Create mission templates.

Weekly Construction Progress

Generate a repeatable flight around and/or across the project.

Mapping Mission

User draws polygon.

Automatically generate a lawnmower/grid pattern.

Settings:

Altitude

Front Overlap

Side Overlap

Flight Direction

Speed

Camera Angle

Site Perimeter

Automatically follow the project boundary.

Point Inspection

Allow specific inspection locations.

Examples:

Roof

Mechanical equipment

Facade

Electrical yard

Tower crane

Laydown yard

Custom Mission

Manual waypoint planning.



MISSION SETTINGS

Each mission should contain:

Mission Name

Mission Type

Altitude

Flight Speed

Camera Mode

Photo Interval

Gimbal Angle

Aircraft Heading

Return-to-Home Altitude

Takeoff Location

Landing Location

Drone

Pilot

Repeat Frequency



WAYPOINT ACTIONS

Each waypoint supports:

Latitude

Longitude

Altitude

Heading

Gimbal Pitch

Speed

Actions:

TAKE PHOTO

START VIDEO

STOP VIDEO

ROTATE AIRCRAFT

ROTATE GIMBAL

HOVER

WAIT

CONTINUE

Allow multiple actions.



FLIGHT ESTIMATION

Calculate estimated:

Flight Distance

Flight Duration

Area Covered

Waypoint Count

Photo Count

Estimated Battery Usage

Clearly state that estimates are planning calculations and not guarantees of actual aircraft performance.



MISSION READINESS

Create a prominent mission readiness panel.

Check:

Takeoff defined

Landing defined

Return-to-home altitude

Valid waypoints

Drone assigned

Pilot assigned

Mission settings complete

Estimated battery requirement

Weather reviewed

Airspace reviewed

Preflight completed

Statuses:

READY

REVIEW REQUIRED

BLOCKED

Do not claim this determines regulatory compliance.



REPEATABLE FLIGHTS

This is a major feature.

Users should be able to mark:

REPEATABLE MISSION

Examples:

Weekly Progress

Friday Owner Update

Monthly Documentation

Roof Progress

Earthwork Progress

Preserve the exact:

Waypoint coordinates

Altitude

Flight direction

Camera angle

Photo locations

Mission geometry

Every modification should create a:

MISSION VERSION

Never overwrite historical mission geometry.

This allows photos captured weeks apart to be compared from approximately the same locations and perspectives.



SCHEDULING

Allow:

Manual

Daily

Weekly

Every Two Weeks

Monthly

Custom

Example:

Weekly Construction Progress

EVERY FRIDAY

8:00 AM

Scheduling creates an upcoming flight assignment.

It DOES NOT automatically launch an aircraft.



DJI MISSION PACKAGE

Create an internal standardized mission package.

Example conceptual structure:

Mission

MissionVersion

Project

AircraftRequirements

Takeoff

Landing

ReturnToHome

Waypoints[]

WaypointActions[]

CameraSettings

SafetySettings

Metadata

The backend should be able to serialize this mission package to JSON.

Also architect export services for:

DJI WPML

KML

GeoJSON

JSON

Create:

MissionPackageService

DJIMissionService

WPMLGenerator

FlightExecutionService

TelemetryService

MediaIngestionService



DJI FLIGHT AGENT API

Create a secure API specifically for the future Android DJI Flight Agent.

Create documented endpoints conceptually equivalent to:

GET /api/flight-agent/missions

GET /api/flight-agent/missions/{missionId}

GET /api/flight-agent/missions/{missionId}/package

POST /api/flight-agent/flights

POST /api/flight-agent/flights/{flightId}/start

POST /api/flight-agent/flights/{flightId}/telemetry

POST /api/flight-agent/flights/{flightId}/event

POST /api/flight-agent/flights/{flightId}/media

POST /api/flight-agent/flights/{flightId}/complete

POST /api/flight-agent/flights/{flightId}/abort

Use secure token-based authentication.

Never expose Supabase service credentials to the Android client.

Use Edge Functions where appropriate.



FLIGHT AGENT DEVICE MANAGEMENT

Create a table:

flight_agent_devices

Fields:

id

organization_id

device_name

device_identifier

pilot_id

assigned_drone_id

app_version

last_seen

status

created_at

Allow administrators to revoke a device.

Statuses:

ACTIVE

OFFLINE

REVOKED

UPDATE REQUIRED



FLIGHT EXECUTION SCREEN

Create a mission-control screen.

Display:

Project

Mission

Mission Version

Pilot

Drone

Flight Status

Large Map

Flight Path

Current Aircraft Position

Current Waypoint

Altitude

Speed

Heading

Battery

GNSS

Flight Duration

Distance

Mission Completion %

For development, provide:

SIMULATE FLIGHT

When simulation starts, animate an aircraft icon through the mission route.

Update simulated:

Altitude

Speed

Battery

Waypoint

Completion

Clearly display:

SIMULATION MODE

Never represent simulated telemetry as actual DJI data.



LIVE TELEMETRY ARCHITECTURE

Prepare Supabase Realtime architecture so telemetry received from the Flight Agent can update the mission-control interface.

Telemetry fields:

timestamp

latitude

longitude

altitude

speed

heading

battery_percent

satellite_count

current_waypoint

flight_mode

distance_from_home

mission_progress

Store useful historical telemetry without unnecessarily writing extremely high-frequency telemetry indefinitely.

Design for configurable telemetry sampling.



FLIGHT EVENTS

Track events such as:

AIRCRAFT_CONNECTED

MISSION_DOWNLOADED

PREFLIGHT_COMPLETE

TAKEOFF

MISSION_STARTED

WAYPOINT_REACHED

PHOTO_CAPTURED

VIDEO_STARTED

VIDEO_STOPPED

LOW_BATTERY

RETURN_TO_HOME

LANDING

MISSION_COMPLETE

MISSION_ABORTED

CONNECTION_LOST

ERROR

Create a flight event timeline.



FLIGHT HISTORY

Store:

Flight ID

Project

Mission

Mission Version

Pilot

Drone

Flight Agent Device

Scheduled Time

Start Time

End Time

Duration

Distance

Maximum Altitude

Photos Captured

Videos Captured

Battery Start

Battery End

Completion %

Result

Results:

COMPLETED

PARTIAL

ABORTED

FAILED



MEDIA

Create a media library.

Support:

Photos

Videos

Future:

Orthomosaics

3D Models

Point Clouds

Store metadata:

Project

Mission

Flight

Waypoint

Timestamp

Latitude

Longitude

Altitude

Aircraft

Camera

Display captured photos geographically on the project map.



PROGRESS TIMELINE

Create:

PROGRESS TIMELINE

Allow users to compare two flights.

Example:

JULY 15

VS

AUGUST 15

Match photographs based on:

Mission

Waypoint

Camera direction

Approximate GPS location

Display images side-by-side.

Where appropriate create an interactive before/after slider.

This is a major construction-specific feature.



FUTURE CONSTRUCTION INTELLIGENCE

Prepare architecture for future computer-vision capabilities.

Do NOT fake AI results.

Create clearly marked future modules for:

Progress Detection

Change Detection

Material Tracking

Earthwork Analysis

Equipment Tracking

Safety Observations

Site Logistics Analysis

These features will eventually analyze repeated flight imagery.



PROCORE INTEGRATION

Create an integration module for Procore.

Future functionality:

Associate platform project with Procore project

Upload drone photographs to Procore Photos

Upload flight reports

Attach project documentation

Create observations from approved findings

Display:

PROCORE

NOT CONNECTED

Include a:

CONNECT PROCORE

button.

Do not fake OAuth.

Build the architecture so actual Procore OAuth/API credentials can be added later.



DJI INTEGRATION PAGE

Create an integration page specifically for DJI.

Display two integration options.

DJI MOBILE SDK

Purpose:

Pilot-operated flights using the Android DJI Flight Agent.

Status:

FLIGHT AGENT REQUIRED

Show explanation:

“DJI Mobile SDK aircraft communication occurs through the companion Android Flight Agent.”

DJI CLOUD API

Purpose:

Future DJI Dock autonomous operations.

Status:

COMING SOON

Architecture should anticipate:

DJI Dock

Dock-compatible aircraft

Remote missions

Automatic charging

Automatic uploads

Scheduled autonomous flights

Do not implement Dock control yet.



FLEET MANAGEMENT

Create Fleet.

Fields:

Manufacturer

Model

Serial Number

Registration Number

Nickname

Camera

RTK

Status

Last Flight

Flight Hours

Maintenance Status

Support DJI initially but don’t hard-code the database exclusively to DJI.



PILOTS

Pilot profiles:

Name

Email

Phone

FAA Remote Pilot Certificate Number

Certificate Expiration

Assigned Projects

Assigned Drone

Flight Count

Flight Hours

Do not claim to verify FAA certification.



PREFLIGHT

Create a digital preflight checklist.

Include:

Aircraft inspected

Propellers inspected

Battery inspected

Weather reviewed

Airspace reviewed

Takeoff area secure

Flight path reviewed

Return-to-home altitude verified

Required authorization confirmed

Pilot checks each item.

Store checklist with the flight record.



WEATHER

Prepare integration architecture for weather.

Display:

Wind

Gusts

Temperature

Precipitation

Visibility

Cloud Cover

Sunrise

Sunset

Any mocked weather information MUST display:

DEMO WEATHER DATA



REPORTS

Create a professional:

CONSTRUCTION FLIGHT REPORT

Include:

Company

Project

Mission

Date

Pilot

Aircraft

Flight Duration

Distance

Area Covered

Photos

Mission Completion

Flight Path Map

Selected Images

Create a clean printable report view.



DATABASE

Use Supabase.

Create relational tables:

organizations

profiles

projects

project_boundaries

drones

pilots

missions

mission_versions

waypoints

waypoint_actions

flight_schedules

flight_assignments

flight_agent_devices

flights

flight_events

flight_telemetry

media

reports

integrations

preflight_checklists

Use UUID primary keys.

Use organization_id for multi-tenancy.

Implement Row Level Security.

Users should never access another organization’s data.



USER ROLES

Create:

Administrator

Drone Program Manager

Project Manager

Pilot

Viewer

Implement role-based permissions.



SAMPLE DATA

Seed a realistic project:

PHOENIX DATA CENTER

Denver Metro Area

Mission:

WEEKLY CONSTRUCTION PROGRESS

Drone:

DJI Mavic 3 Enterprise

Altitude:

150 FT

Speed:

12 MPH

Camera:

-45°

Schedule:

EVERY FRIDAY

Create approximately 20 waypoints.

Create several previous demo flights.

Create realistic placeholder construction images.

Clearly identify demo information.



USER EXPERIENCE

The ideal workflow is:

CREATE PROJECT

↓

DRAW CONSTRUCTION SITE

↓

CREATE MISSION

↓

SELECT WEEKLY PROGRESS

↓

SYSTEM GENERATES ROUTE

↓

ADJUST ROUTE

↓

REVIEW MISSION

↓

ASSIGN PILOT + DRONE

↓

SCHEDULE

↓

SEND TO DJI FLIGHT AGENT

↓

PILOT OPENS FLIGHT AGENT

↓

MISSION DOWNLOADS

↓

PILOT COMPLETES PREFLIGHT

↓

PILOT STARTS FLIGHT

↓

DJI EXECUTES MISSION

↓

TELEMETRY RETURNS TO PLATFORM

↓

FLIGHT COMPLETES

↓

MEDIA UPLOADS

↓

PROJECT PROGRESS TIMELINE UPDATES

Design the entire application around making this workflow simple.



DEVELOPMENT REQUIREMENTS

Use:

React

TypeScript

Supabase

Mapbox

Supabase Realtime

Supabase Edge Functions

Strong TypeScript types

Reusable components

Service architecture

Secure authentication

Responsive UI

Row Level Security

Multi-tenant architecture

Environment variables

Never put secret API credentials in frontend code.

Build functional screens and database interactions rather than static mockups wherever Lovable can implement them.



IMPORTANT PRODUCT PRINCIPLE

Do not build a generic drone-control dashboard.

Build:

A construction intelligence platform powered by repeatable drone data collection.

The construction project is the primary entity.

Missions collect data.

Flights execute missions.

Media documents construction.

Repeated flights create historical project intelligence.

The eventual competitive advantage is not simply flying the drone.

It is creating a structured visual history of the construction project using repeatable autonomous data collection.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://site-sync-fly.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3d09cf86-db8c-4016-804d-8076242e1dc7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
