/**
 * Authentication, workspace context and the actor's resolved authority.
 *
 * The session cookie is HttpOnly, so the browser never reads or stores a
 * token: "am I signed in?" is answered by asking the server, not by trusting
 * anything in the tab. The active workspace lives in `sessions.active_workspace`
 * server-side; a client-supplied workspace id is never read (FI-B0-07), so the
 * only way to change workspace is the switch endpoint below.
 */
import { api } from "../http";
import type { EntitlementPayload, MemberPayload, SessionPayload, WorkspacePayload } from "../types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<SessionPayload>("/auth/login", { body: { email, password } }),

  logout: () => api.post<{ status: string }>("/auth/logout"),

  /**
   * Restore the session on reload. There is no dedicated `/auth/me`, so the
   * workspace list doubles as the session probe: it is the pre-workspace read
   * that requires only a usable session, and it returns exactly what the shell
   * needs. A 401 here means "not signed in" and nothing more.
   */
  workspaces: (signal?: AbortSignal) =>
    api.get<{ items: WorkspacePayload[] }>("/workspaces", { signal }),

  createWorkspace: (name: string) => api.post<WorkspacePayload>("/workspaces", { body: { name } }),

  switchWorkspace: (workspaceRef: string) =>
    api.post<{ active_workspace_ref: string }>(
      `/workspaces/${encodeURIComponent(workspaceRef)}/switch`,
    ),

  /** Plan, role and the server-derived permission set for the active workspace. */
  entitlements: (signal?: AbortSignal) => api.get<EntitlementPayload>("/entitlements", { signal }),

  members: (signal?: AbortSignal) =>
    api.get<{ items: MemberPayload[] }>("/workspaces/members", { signal }),
};
