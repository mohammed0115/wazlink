/**
 * Hash Router — نفس عقد `client/js/router.js` بلا تغيير.
 *
 * تبقى كل المسارات `#/...` كما وثقتها `ROUTES.md`، بما فيها الـaliases
 * الانتقالية (`#/leads`, `#/whatsapp`, `#/job`, `#/integrations` ...).
 * لم يُستبدل الموجّه بمكتبة خارجية كي يظل السلوك — وBrowser Back/Forward —
 * مطابقًا لنسخة V1 المعتمدة.
 */
import { useSyncExternalStore } from "react";

export const publicRoutes = ["landing", "login", "onboarding"] as const;

export type PublicRoute = (typeof publicRoutes)[number];

export type RouteInfo = {
  /** المسار بعد `#/` من دون query، مثل `discovery/jobs/JOB-1028`. */
  path: string;
  /** أول مقطع، مثل `discovery`. */
  segment: string;
  /** معاملات الاستعلام، مثل `?business=BUS-1042`. */
  query: URLSearchParams;
};

function readHash(): string {
  return location.hash || "";
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

/** يقابل `getRoute()` في نسخة Vanilla: المسار بلا `#/` وبلا query. */
export function getRoute(): string {
  return (location.hash.replace("#/", "") || "landing").split("?")[0];
}

export function go(route: string): void {
  location.hash = `#/${route}`;
}

export function isPublicRoute(route: string): boolean {
  return (publicRoutes as readonly string[]).includes(route);
}

export function parseHash(hash: string): RouteInfo {
  const raw = hash.replace("#/", "") || "landing";
  const [path, search = ""] = raw.split("?");
  return {
    path: path || "landing",
    segment: (path || "landing").split("/")[0],
    query: new URLSearchParams(search),
  };
}

/** يعيد وصف المسار الحالي ويعيد الرسم عند كل `hashchange`. */
export function useHashRoute(): RouteInfo {
  const hash = useSyncExternalStore(subscribe, readHash, () => "#/landing");
  return parseHash(hash);
}

/**
 * عنصر التنقل المعتمد داخل الواجهة.
 * يستخدم `<a href="#/...">` كي يبقى الرابط قابلًا للفتح في تبويب جديد
 * وقابلًا للتركيز بلوحة المفاتيح، بدل `div` قابل للنقر.
 */
export function routeHref(route: string): string {
  return `#/${route}`;
}
