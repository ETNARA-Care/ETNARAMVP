import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe, login as apiLogin, logout as apiLogout, type MeOrganization } from "../api/auth";
import { getToken, setToken, ApiError } from "../api/client";

interface AuthState {
  status: "loading" | "authenticated" | "unauthenticated";
  user: { id: string; email: string | null; phone: string | null } | null;
  organizations: MeOrganization[];
  activeOrganization: MeOrganization | null;
  setActiveOrganizationId: (organizationId: string) => void;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const ACTIVE_ORG_KEY = "etnara.activeOrgId";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [organizations, setOrganizations] = useState<MeOrganization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => sessionStorage.getItem(ACTIVE_ORG_KEY));

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setStatus("unauthenticated");
      return;
    }
    try {
      const me = await getMe();
      setUser(me.user);
      setOrganizations(me.organizations);
      setActiveOrgId((prev) => {
        if (prev && me.organizations.some((o) => o.id === prev)) return prev;
        const first = me.organizations[0]?.id ?? null;
        if (first) sessionStorage.setItem(ACTIVE_ORG_KEY, first);
        return first;
      });
      setStatus("authenticated");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
        setStatus("unauthenticated");
        return;
      }
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      await apiLogin(identifier, password);
      setStatus("loading");
      await loadMe();
    },
    [loadMe]
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setOrganizations([]);
    setActiveOrgId(null);
    sessionStorage.removeItem(ACTIVE_ORG_KEY);
    setStatus("unauthenticated");
  }, []);

  const setActiveOrganizationId = useCallback((organizationId: string) => {
    setActiveOrgId(organizationId);
    sessionStorage.setItem(ACTIVE_ORG_KEY, organizationId);
  }, []);

  const activeOrganization = useMemo(
    () => organizations.find((o) => o.id === activeOrgId) ?? null,
    [organizations, activeOrgId]
  );

  const value: AuthState = {
    status,
    user,
    organizations,
    activeOrganization,
    setActiveOrganizationId,
    login,
    logout,
    refresh: loadMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
