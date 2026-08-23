/**
 * Frontend runtime configuration.
 *
 * Only VITE_* variables are exposed to the browser by Vite. Keeping reads in
 * this module prevents components and feature code from depending directly on
 * import.meta.env and gives the future API adapter one stable configuration
 * boundary.
 */

const readString = (value: unknown, fallback: string): string => {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
};

export const appConfig = Object.freeze({
  appEnv: readString(import.meta.env.VITE_APP_ENV, "development"),
  apiBaseUrl: readString(import.meta.env.VITE_API_BASE_URL, ""),
  assetBaseUrl: import.meta.env.BASE_URL,
});

export type AppConfig = typeof appConfig;
