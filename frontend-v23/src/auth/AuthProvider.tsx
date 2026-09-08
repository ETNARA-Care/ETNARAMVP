import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as authApi from "@/api/auth";
import * as orgApi from "@/api/organizationContext";
import type { ApiError } from "@/api/client";
import type { MeUser, MeOrganization } from "@/api/organizationContext";
import { getToken, setToken, clearToken } from "./token";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: MeUser | null;
  organizations: MeOrganization[];
  activeOrganization: MeOrganization | null;
  roles: string[]; // roles del usuario en `activeOrganization` únicamente
  error: ApiError | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setActiveOrganization: (organizationId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Bootstrap + estado de sesión real contra el backend de ETNARA.
 *
 * IMPORTANTE (alcance de Fase 3): esto es autenticación real -- token,
 * /me, organización activa. Los datos operacionales (turnos, care events,
 * mensajes, notificaciones) siguen viniendo de src/mocks/DemoStoreContext,
 * sin relación con el usuario real autenticado aquí. Eso es intencional
 * hasta la fase de integración de esos módulos.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<MeUser | null>(null);
  const [organizations, setOrganizations] = useState<MeOrganization[]>([]);
  const [activeOrganization, setActiveOrganizationState] = useState<MeOrganization | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const applyMeResult = useCallback((me: orgApi.MeResult) => {
    setUser(me.user);
    setOrganizations(me.organizations);
  }, []);

  /**
   * Si el usuario tiene exactamente una organización, la app la activa
   * automáticamente llamando POST /me/active-organization (comportamiento
   * real esperado por el backend -- no una suposición del frontend). Con
   * varias organizaciones, queda en null hasta que el usuario elija
   * (ver /select-organization) -- no se persiste esa elección entre
   * refrescos porque sessionStorage se usa con una sola clave (el token),
   * por decisión explícita de esta fase.
   */
  const autoSelectSingleOrganization = useCallback(async (token: string, orgs: MeOrganization[]) => {
    if (orgs.length !== 1) return;
    const only = orgs[0];
    await orgApi.setActiveOrganization(only.id, token);
    setActiveOrganizationState(only);
  }, []);

  const bootstrap = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setStatus("unauthenticated");
      return;
    }
    try {
      const me = await orgApi.getMe(token);
      applyMeResult(me);
      await autoSelectSingleOrganization(token, me.organizations);
      setStatus("authenticated");
      setError(null);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        clearToken();
        setStatus("unauthenticated");
      } else {
        // Error de red o del servidor -- NUNCA se interpreta como sesión
        // inválida. El token se conserva; el bootstrap puede reintentarse.
        setStatus("error");
        setError(apiErr);
      }
    }
  }, [applyMeResult, autoSelectSingleOrganization]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const isEmail = identifier.includes("@");
    const payload = isEmail ? { email: identifier, password } : { phone: identifier, password };
    const { token } = await authApi.login(payload); // si esto falla (401/500/red), nunca se llegó a guardar token -- nada que revertir
    setToken(token);
    try {
      const me = await orgApi.getMe(token);
      applyMeResult(me);
      await autoSelectSingleOrganization(token, me.organizations);
      setStatus("authenticated");
      setError(null);
    } catch (err) {
      // Atómico: si CUALQUIER paso posterior a guardar el token falla
      // (GET /me o POST /me/active-organization), no dejamos un token
      // "a medias" en sessionStorage -- se revierte todo a como estaba
      // antes del login, y se re-lanza el error ORIGINAL (nunca convertido
      // a 401) para que LoginPage muestre el mensaje correcto.
      clearToken();
      setUser(null);
      setOrganizations([]);
      setActiveOrganizationState(null);
      setStatus("unauthenticated");
      setError(null);
      throw err;
    }
  }, [applyMeResult, autoSelectSingleOrganization]);

  const logout = useCallback(async () => {
    const token = getToken();
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        // Si /auth/logout falla (red, token ya vencido, etc.) igual
        // limpiamos la sesión local -- el objetivo es que la persona
        // salga, no que quede atascada por un error del servidor.
      }
    }
    clearToken();
    setUser(null);
    setOrganizations([]);
    setActiveOrganizationState(null);
    setError(null);
    setStatus("unauthenticated");
  }, []);

  const refreshSession = useCallback(async () => {
    setStatus("loading");
    await bootstrap();
  }, [bootstrap]);

  const setActiveOrganizationById = useCallback(async (organizationId: string) => {
    const token = getToken();
    if (!token) return;
    await orgApi.setActiveOrganization(organizationId, token);
    const org = organizations.find((o) => o.id === organizationId) ?? null;
    setActiveOrganizationState(org);
  }, [organizations]);

  const roles = useMemo(() => activeOrganization?.roles ?? [], [activeOrganization]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status, user, organizations, activeOrganization, roles, error,
      login, logout, refreshSession, setActiveOrganization: setActiveOrganizationById,
    }),
    [status, user, organizations, activeOrganization, roles, error, login, logout, refreshSession, setActiveOrganizationById]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
