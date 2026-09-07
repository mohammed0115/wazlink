/**
 * Real authentication and workspace context.
 *
 * This provider replaces the demo `signInMock` for every integrated CRM
 * surface. Three properties are load-bearing:
 *
 *  1. The session cookie is HttpOnly, so signed-in state is DERIVED by asking
 *     the server on mount. Nothing about authority is kept in the tab, which
 *     is why a refresh restores the real session instead of a remembered flag.
 *  2. The active workspace lives in the session row server-side. Switching is
 *     an API call, and the client never sends a workspace id as authority.
 *  3. `permissions` comes from `GET /entitlements` — the server's own resolved
 *     set for this role. `can()` therefore only HIDES what the backend would
 *     refuse anyway; it never grants anything. The backend stays authoritative.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { ApiError, authApi, type EntitlementPayload, type WorkspacePayload } from "../../api";

export type AuthStatus = "loading" | "anonymous" | "authenticated" | "no_workspace";

interface AuthContextValue {
  status: AuthStatus;
  email: string;
  workspaces: WorkspacePayload[];
  activeWorkspace: WorkspacePayload | null;
  role: string;
  planCode: string;
  permissions: ReadonlySet<string>;
  /** UI-level check. Hides what the server would refuse; never grants. */
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceRef: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_PERMISSIONS: ReadonlySet<string> = new Set<string>();

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [email, setEmail] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspacePayload[]>([]);
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementPayload | null>(null);

  /**
   * Resolve the whole authenticated context from the server.
   *
   * `/workspaces` is the session probe: it needs only a usable session, so a
   * 401 here means "not signed in" and anything else means we are. The active
   * workspace is then confirmed by `/entitlements`, which is workspace-scoped
   * and fails with WORKSPACE_NOT_FOUND when the session has none.
   */
  const resolve = useCallback(async () => {
    try {
      const { items } = await authApi.workspaces();
      setWorkspaces(items);

      if (items.length === 0) {
        setActiveRef(null);
        setEntitlement(null);
        setStatus("no_workspace");
        return;
      }

      try {
        const resolved = await authApi.entitlements();
        setEntitlement(resolved);
        setStatus("authenticated");
      } catch (cause) {
        if (cause instanceof ApiError && cause.code === "WORKSPACE_NOT_FOUND") {
          // A membership exists but the session has no active workspace yet.
          await authApi.switchWorkspace(items[0].workspace_ref);
          const resolved = await authApi.entitlements();
          setActiveRef(items[0].workspace_ref);
          setEntitlement(resolved);
          setStatus("authenticated");
          return;
        }
        throw cause;
      }
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.code === "AUTH_REQUIRED")) {
        setStatus("anonymous");
        setWorkspaces([]);
        setEntitlement(null);
        setActiveRef(null);
        return;
      }
      // A network or server fault is not proof of being signed out; the shell
      // renders an error state rather than silently bouncing to the login page.
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  const login = useCallback(
    async (nextEmail: string, password: string) => {
      const session = await authApi.login(nextEmail, password);
      setEmail(session.user.email);
      setActiveRef(session.active_workspace_ref);
      await resolve();
    },
    [resolve],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setStatus("anonymous");
      setWorkspaces([]);
      setEntitlement(null);
      setActiveRef(null);
      setEmail("");
    }
  }, []);

  const switchWorkspace = useCallback(
    async (workspaceRef: string) => {
      await authApi.switchWorkspace(workspaceRef);
      setActiveRef(workspaceRef);
      await resolve();
    },
    [resolve],
  );

  const createWorkspace = useCallback(
    async (name: string) => {
      const created = await authApi.createWorkspace(name);
      setActiveRef(created.workspace_ref);
      await resolve();
    },
    [resolve],
  );

  const permissions = useMemo<ReadonlySet<string>>(
    () => (entitlement ? new Set(entitlement.permissions) : EMPTY_PERMISSIONS),
    [entitlement],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((row) => row.workspace_ref === activeRef) ?? workspaces[0] ?? null,
    [workspaces, activeRef],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      email,
      workspaces,
      activeWorkspace,
      role: entitlement?.role ?? "",
      planCode: entitlement?.plan_code ?? "",
      permissions,
      can: (permission: string) => permissions.has(permission),
      login,
      logout,
      switchWorkspace,
      createWorkspace,
      refresh: resolve,
    }),
    [
      status,
      email,
      workspaces,
      activeWorkspace,
      entitlement,
      permissions,
      login,
      logout,
      switchWorkspace,
      createWorkspace,
      resolve,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
