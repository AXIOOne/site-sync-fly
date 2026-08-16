import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export interface FlightWeather {
  observedAt: string;
  temperatureF: number;
  windMph: number;
  gustMph: number;
  precipitationChance: number;
  visibilityMi: number | null;
  cloudCover: number;
  verdict: "GO" | "CAUTION" | "NO-GO";
  reasons: string[];
}

/**
 * Live flight weather from Open-Meteo (no API key) turned into a Part 107
 * go / no-go call using conservative small-UAS limits.
 */
export const getFlightWeather = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<FlightWeather> => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(data.latitude));
    url.searchParams.set("longitude", String(data.longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover,visibility",
    );
    url.searchParams.set("hourly", "precipitation_probability");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("forecast_days", "1");

    const response = await fetch(url);
    if (!response.ok) throw new Error("Weather service unavailable");
    const payload = (await response.json()) as {
      current?: Record<string, number | string>;
      hourly?: { precipitation_probability?: number[] };
    };

    const current = payload.current ?? {};
    const windMph = Number(current["wind_speed_10m"] ?? 0);
    const gustMph = Number(current["wind_gusts_10m"] ?? 0);
    const cloudCover = Number(current["cloud_cover"] ?? 0);
    const visibilityM = current["visibility"] != null ? Number(current["visibility"]) : null;
    const precipitationChance = payload.hourly?.precipitation_probability?.[0] ?? 0;
    const visibilityMi = visibilityM != null ? Number((visibilityM / 1609.34).toFixed(1)) : null;

    const reasons: string[] = [];
    if (windMph > 22 || gustMph > 27) reasons.push("Wind above conservative aircraft limits");
    else if (windMph > 15 || gustMph > 20) reasons.push("Gusty — expect image blur and battery loss");
    if (precipitationChance >= 50) reasons.push("Precipitation likely during the window");
    else if (precipitationChance >= 25) reasons.push("Precipitation possible — monitor radar");
    if (visibilityMi != null && visibilityMi < 3) reasons.push("Visibility below 3 statute miles (Part 107 minimum)");
    if (Number(current["temperature_2m"] ?? 60) < 25) reasons.push("Cold soak reduces battery endurance");

    const noGo =
      windMph > 22 ||
      gustMph > 27 ||
      precipitationChance >= 50 ||
      (visibilityMi != null && visibilityMi < 3);

    return {
      observedAt: new Date().toISOString(),
      temperatureF: Math.round(Number(current["temperature_2m"] ?? 0)),
      windMph: Math.round(windMph),
      gustMph: Math.round(gustMph),
      precipitationChance,
      visibilityMi,
      cloudCover: Math.round(cloudCover),
      verdict: noGo ? "NO-GO" : reasons.length > 0 ? "CAUTION" : "GO",
      reasons,
    };
  });
