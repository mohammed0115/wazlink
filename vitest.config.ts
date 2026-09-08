import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Frontend unit tests.
 *
 * Separate from `vite.config.ts` so the test run does not load the dev-server
 * plugins (JSX location tagging, the Manus runtime and the storage proxy),
 * none of which have any part in a unit test and all of which slow it down.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@domain": path.resolve(import.meta.dirname, "client", "src", "domain"),
      "@services": path.resolve(import.meta.dirname, "client", "src", "services", "index.ts"),
      "@config": path.resolve(import.meta.dirname, "client", "src", "config"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    // `scripts/` is included so the architecture guards are themselves tested.
    // A guard nobody proves can fail is indistinguishable from one that never
    // fires — which is exactly how the stale "no network in the UI" rule
    // survived until the API boundary made it fail for the wrong reason.
    include: [
      "client/src/**/*.test.ts",
      "client/src/**/*.test.tsx",
      "scripts/**/*.test.mjs",
    ],
    passWithNoTests: false,
  },
});
