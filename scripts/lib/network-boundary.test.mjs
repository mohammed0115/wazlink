/**
 * Negative controls for the frontend network-boundary guard.
 *
 * The rule this file exercises replaced "no network calls in the UI layer",
 * which had become unsatisfiable: it could only pass by having no API client,
 * and it failed the moment the CRM started talking to Django. A rule that can
 * only be satisfied by deleting the thing it protects is not enforcement.
 *
 * So the point of these tests is not that the guard passes today — it is that
 * the guard FAILS for each way a feature could smuggle in its own transport.
 */
import { describe, expect, it } from "vitest";

import {
  boundaryImplementors,
  evaluateNetworkBoundary,
  networkBoundaryViolations,
  stripComments,
} from "./network-boundary.mjs";

const boundary = {
  path: "/repo/client/src/api/http.ts",
  source: 'const r = await fetch(url, { credentials: "include" });',
};

describe("the API boundary is allowed to reach the network", () => {
  it("accepts fetch inside client/src/api/", () => {
    expect(networkBoundaryViolations([boundary])).toEqual([]);
    expect(evaluateNetworkBoundary([boundary]).pass).toBe(true);
  });

  it("accepts a second file inside the boundary", () => {
    const files = [
      boundary,
      { path: "/repo/client/src/api/resources/crm.ts", source: "export const leadsApi = {};" },
    ];
    expect(evaluateNetworkBoundary(files).pass).toBe(true);
  });
});

describe("a feature reaching the network on its own is refused", () => {
  it("FAILS when a CRM page calls fetch", () => {
    const files = [
      boundary,
      {
        path: "/repo/client/src/features/crm/LeadsPage.tsx",
        source: "const rows = await fetch('/api/v1/leads');",
      },
    ];
    const verdict = evaluateNetworkBoundary(files);
    expect(verdict.pass).toBe(false);
    expect(verdict.violations).toEqual(["features/crm/LeadsPage.tsx"]);
  });

  it("FAILS when a CRM component calls fetch", () => {
    const files = [
      boundary,
      {
        path: "/repo/client/src/features/crm/components/PartyFilesSection.tsx",
        source: "await fetch(`/api/v1/files/${ref}/download`);",
      },
    ];
    expect(evaluateNetworkBoundary(files).pass).toBe(false);
  });

  it("FAILS when the sales feature calls fetch", () => {
    const files = [
      boundary,
      {
        path: "/repo/client/src/features/sales/DealsPage.tsx",
        source: "fetch('/api/v1/deals', { method: 'POST' });",
      },
    ];
    const verdict = evaluateNetworkBoundary(files);
    expect(verdict.pass).toBe(false);
    expect(verdict.violations).toEqual(["features/sales/DealsPage.tsx"]);
  });

  it("FAILS when the inbox feature calls fetch", () => {
    const files = [
      boundary,
      {
        path: "/repo/client/src/features/inbox/InboxPage.tsx",
        source: "await fetch('/api/v1/messages', { method: 'POST' });",
      },
    ];
    expect(evaluateNetworkBoundary(files).pass).toBe(false);
  });

  it("FAILS when shared code calls fetch", () => {
    const files = [
      boundary,
      { path: "/repo/client/src/shared/shell/Topbar.tsx", source: "fetch('/api/v1/entitlements');" },
    ];
    expect(evaluateNetworkBoundary(files).pass).toBe(false);
  });

  it("names every offender, not just the first", () => {
    const files = [
      boundary,
      { path: "/repo/client/src/features/crm/A.tsx", source: "fetch('/a');" },
      { path: "/repo/client/src/features/sales/B.tsx", source: "fetch('/b');" },
    ];
    expect(evaluateNetworkBoundary(files).violations).toEqual([
      "features/crm/A.tsx",
      "features/sales/B.tsx",
    ]);
  });
});

describe("the other transports are guarded too", () => {
  it.each([
    ["XMLHttpRequest", "const x = new XMLHttpRequest();"],
    ["WebSocket", "const s = new WebSocket('wss://x');"],
    ["sendBeacon", "navigator.sendBeacon('/x', d);"],
    ["axios", "import axios from 'axios';"],
  ])("FAILS on %s outside the boundary", (_name, source) => {
    const files = [boundary, { path: "/repo/client/src/features/crm/X.tsx", source }];
    expect(evaluateNetworkBoundary(files).pass).toBe(false);
  });
});

describe("the guard cannot pass vacuously", () => {
  it("FAILS when no file inside the boundary reaches the network", () => {
    // Deleting the API client must never be a way to go green.
    const files = [
      { path: "/repo/client/src/api/http.ts", source: "export const api = {};" },
      { path: "/repo/client/src/features/crm/LeadsPage.tsx", source: "export const x = 1;" },
    ];
    const verdict = evaluateNetworkBoundary(files);
    expect(verdict.pass).toBe(false);
    expect(verdict.violations).toEqual([]);
    expect(boundaryImplementors(files)).toEqual([]);
  });
});

describe("prose about the network is not network", () => {
  it("ignores a block comment mentioning fetch", () => {
    const files = [
      boundary,
      {
        path: "/repo/client/src/features/crm/LeadsPage.tsx",
        source: "/* Nothing here calls fetch( directly; use leadsApi. */\nexport const x = 1;",
      },
    ];
    expect(evaluateNetworkBoundary(files).pass).toBe(true);
  });

  it("ignores a line comment mentioning fetch", () => {
    const files = [
      boundary,
      {
        path: "/repo/client/src/features/crm/LeadsPage.tsx",
        source: "// never call fetch( here\nexport const x = 1;",
      },
    ];
    expect(evaluateNetworkBoundary(files).pass).toBe(true);
  });

  it("does not mistake a url for a comment when stripping", () => {
    expect(stripComments("const u = 'https://example.test/a';")).toContain("https://example.test/a");
  });
});
