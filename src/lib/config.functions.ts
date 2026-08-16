import { createServerFn } from "@tanstack/react-start";

/**
 * Returns the Mapbox public token stored securely on the backend.
 * Map surfaces render a "MAPBOX NOT CONFIGURED" state when it is absent.
 */
export const getMapboxToken = createServerFn({ method: "GET" }).handler(async () => {
  const token = process.env["MAPBOX_PUBLIC_TOKEN"] ?? "";
  return { token, configured: token.length > 0 };
});
