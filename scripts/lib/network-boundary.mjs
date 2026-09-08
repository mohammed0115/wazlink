/**
 * قاعدة حدود الشبكة في الواجهة.
 *
 * The old rule was "no network calls in the UI layer", which made sense while
 * the frontend had none: every screen read a synchronous in-memory store. Now
 * that the CRM talks to Django, that rule can only be satisfied by having no
 * API client at all, so as written it forbids the very boundary it should be
 * protecting.
 *
 * The invariant that actually matters is narrower and stronger: network access
 * is allowed in ONE place, and every feature reaches the server through the
 * typed client rather than calling `fetch` itself. That keeps session
 * credentials, the error envelope, `Idempotency-Key`, `If-Match` and
 * cancellation implemented once instead of per screen.
 *
 * The rule lives here, apart from the verifier script, so it can be exercised
 * against synthetic sources — a guard nothing ever proves can fail is not a
 * guard.
 */

/** The one directory permitted to touch the network. */
export const API_BOUNDARY = "client/src/api/";

/**
 * Network primitives. `axios` is included because it is a runtime dependency
 * of this repo and would otherwise be an unguarded second transport.
 */
const NETWORK_PRIMITIVE =
  /\bfetch\s*\(|\bXMLHttpRequest\b|new\s+WebSocket\b|navigator\s*\.\s*sendBeacon\b|\bfrom\s+["']axios["']/;

/** Comments describe the rule constantly; they must not trip it. */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const normalise = (path) => path.replaceAll("\\", "/");

export function isInsideBoundary(path) {
  return normalise(path).includes(API_BOUNDARY);
}

export function usesNetworkPrimitive(source) {
  return NETWORK_PRIMITIVE.test(stripComments(source));
}

/**
 * Files that reach the network from outside the API boundary.
 *
 * @param {{path: string, source: string}[]} files
 * @returns {string[]} offending paths, relative-ish, for the failure message
 */
export function networkBoundaryViolations(files) {
  return files
    .filter((file) => !isInsideBoundary(file.path) && usesNetworkPrimitive(file.source))
    .map((file) => normalise(file.path).split("client/src/").at(-1));
}

/** Files inside the boundary that DO use the network. */
export function boundaryImplementors(files) {
  return files
    .filter((file) => isInsideBoundary(file.path) && usesNetworkPrimitive(file.source))
    .map((file) => normalise(file.path).split("client/src/").at(-1));
}

/**
 * The whole rule, as one verdict.
 *
 * Passing requires BOTH halves: nothing outside the boundary touches the
 * network, AND the boundary actually implements it. Without the second half
 * deleting the API client would make this check pass, which is the one
 * outcome it must never reward.
 */
export function evaluateNetworkBoundary(files) {
  const violations = networkBoundaryViolations(files);
  const implementors = boundaryImplementors(files);
  return {
    pass: violations.length === 0 && implementors.length > 0,
    violations,
    implementors,
    detail:
      violations.length > 0
        ? `شبكة خارج الحدود: ${violations.join("، ")}`
        : implementors.length === 0
          ? `لا توجد حدود شبكة في ${API_BOUNDARY}`
          : `${implementors.length} ملف داخل الحدود فقط`,
  };
}
