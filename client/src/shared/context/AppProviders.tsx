import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { sessionService, themeService, workspaceService } from "@services";

export interface WorkspaceSummary {
  companyName: string;
  industry?: string;
  city?: string;
  teamSize?: string;
}

export interface SessionUserSummary {
  id: string;
  name: string;
  role: string;
}

interface WorkspaceContextValue {
  workspace: WorkspaceSummary;
  updateWorkspace: (patch: Partial<WorkspaceSummary>) => void;
}

interface SessionContextValue {
  signedIn: boolean;
  onboardingDone: boolean;
  currentUser: SessionUserSummary | null;
  signInMock: () => void;
  signOutMock: () => void;
  completeOnboarding: () => void;
}

interface ThemeContextValue {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const SessionContext = createContext<SessionContextValue | null>(null);
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [workspace, setWorkspace] = useState<WorkspaceSummary>(() => workspaceService.getCurrent());
  const value = useMemo<WorkspaceContextValue>(() => ({
    workspace,
    updateWorkspace: (patch) => setWorkspace((current) => workspaceService.update({ ...current, ...patch })),
  }), [workspace]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState(() => sessionService.getSnapshot());
  const value = useMemo<SessionContextValue>(() => ({
    ...session,
    signInMock: () => setSession(sessionService.signInMock()),
    signOutMock: () => setSession(sessionService.signOutMock()),
    completeOnboarding: () => setSession(sessionService.completeOnboarding()),
  }), [session]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<"light" | "dark">(() => themeService.get());
  const setTheme = (next: "light" | "dark") => {
    themeService.set(next);
    setThemeState(next);
  };
  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme(theme === "light" ? "dark" : "light"),
  }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function AppProviders({ children }: PropsWithChildren) {
  return <SessionProvider><WorkspaceProvider><ThemeProvider>{children}</ThemeProvider></WorkspaceProvider></SessionProvider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return value;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
