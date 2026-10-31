import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as authApi from "@/api/auth";
import * as orgApi from "@/api/organizationContext";
import type { ApiError } from "@/api/client";
import type { MeUser, MeOrganization, MyWorkerProfile } from "@/api/organizationContext";
import { getToken, setToken, clearToken, isKeptSession, restoreToken } from "./token";
import { secureGet, secureSet } from "@/offline/secureStore";
import { restoreShiftCache, startShiftCache, stopShiftCache } from "@/offline/shiftCache";

/** Copia de /me para abrir la app sin señal (solo sesiones de cuidador/a, cifrada). */
interface OfflineIdentity {
  me: orgApi.MeResult;
  activeOrganizationId: string | null;
  workerProfile: MyWorkerProfile | null;
}
const SECURE_IDENTITY = "identity";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: MeUser | null;
  organizations: MeOrganization[];
  activeOrganization: MeOrganization | null;
  roles: string[]; // roles del usuario en `activeOrganization` únicamente
  isPlatformAdmin: boolean;
  activeWorkerProfile: MyWorkerProfile | null;
  error: ApiError | null;
  /** Se abrió sin señal con la sesión guardada; los datos se actualizan al volver la señal. */
  offline: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * C3: la sesión terminó en el servidor (401, vencida o revocada). Cierra la sesión local SIN
   * llamar al servidor y SIN borrar los registros sin enviar (siguen en la bóveda de la cuenta).
   */
  endSession: () => void;
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
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [activeWorkerProfile, setActiveWorkerProfile] = useState<MyWorkerProfile | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [offline, setOffline] = useState(false);

  const applyMeResult = useCallback((me: orgApi.MeResult) => {
    setUser(me.user);
    setOrganizations(me.organizations);
    setIsPlatformAdmin(me.platformAdmin);
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
    if (orgs.length !== 1) return { id: null, profile: null };
    const only = orgs[0];
    await orgApi.setActiveOrganization(only.id, token);
    setActiveOrganizationState(only);
    const profile = only.roles.includes("WORKER") ? await orgApi.getMyWorkerProfile(only.id, token) : null;
    setActiveWorkerProfile(profile);
    return { id: only.id as string | null, profile };
  }, []);

  const rememberIdentity = useCallback((me: orgApi.MeResult, activeOrganizationId: string | null, workerProfile: MyWorkerProfile | null) => {
    if (!isKeptSession()) return;
    void secureSet(SECURE_IDENTITY, { me, activeOrganizationId, workerProfile } satisfies OfflineIdentity);
  }, []);


  const bootstrap = useCallback(async () => {
    await restoreToken();
    // Turnos cercanos guardados cifrados: la app abre con ellos aunque no haya señal.
    await restoreShiftCache();
    const token = getToken();
    if (!token) {
      setStatus("unauthenticated");
      return;
    }
    try {
      const me = await orgApi.getMe(token);
      applyMeResult(me);
      const selected = await autoSelectSingleOrganization(token, me.organizations);
      rememberIdentity(me, selected.id, selected.profile);
      setOffline(false);
      setStatus("authenticated");
      setError(null);
    } catch (err) {
      const apiErr = err as ApiError;
      // Sin señal con una sesión de cuidador/a guardada: se abre con la
      // última identidad conocida; las acciones se encolan y se envían luego.
      const cached = apiErr.status !== 401 && isKeptSession() ? await secureGet<OfflineIdentity>(SECURE_IDENTITY) : null;
      if (cached) {
        applyMeResult(cached.me);
        const org = cached.me.organizations.find((o) => o.id === cached.activeOrganizationId) ?? null;
        setActiveOrganizationState(org);
        setActiveWorkerProfile(cached.workerProfile);
        setOffline(true);
        setStatus("authenticated");
        setError(null);
        return;
      }
      if (apiErr.status === 401) {
        clearToken();
        setIsPlatformAdmin(false);
        setActiveWorkerProfile(null);
        setStatus("unauthenticated");
      } else {
        // Error de red o del servidor -- NUNCA se interpreta como sesión
        // inválida. El token se conserva; el bootstrap puede reintentarse.
        setStatus("error");
        setError(apiErr);
      }
    }
  }, [applyMeResult, autoSelectSingleOrganization, rememberIdentity]);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo una sesión de cuidador/a que se queda en el teléfono guarda sus turnos cercanos.
  useEffect(() => {
    if (status !== "authenticated" || !isKeptSession()) return;
    startShiftCache();
    return () => stopShiftCache();
  }, [status]);

  // Se abrió sin señal: al volver la señal confirma la sesión con el servidor.
  useEffect(() => {
    if (!offline) return;
    const onOnline = () => void bootstrap();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [offline, bootstrap]);

  const login = useCallback(async (identifier: string, password: string) => {
    const isEmail = identifier.includes("@");
    const payload = isEmail ? { email: identifier, password } : { phone: identifier, password };
    const { token, keepSignedIn, expiresAt } = await authApi.login(payload); // si esto falla (401/500/red), nunca se llegó a guardar token -- nada que revertir
    setToken(token, { keepSignedIn, expiresAt });
    try {
      const me = await orgApi.getMe(token);
      applyMeResult(me);
      const selected = await autoSelectSingleOrganization(token, me.organizations);
      rememberIdentity(me, selected.id, selected.profile);
      setOffline(false);
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
      setIsPlatformAdmin(false);
      setActiveWorkerProfile(null);
      setStatus("unauthenticated");
      setError(null);
      throw err;
    }
  }, [applyMeResult, autoSelectSingleOrganization, rememberIdentity]);

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
    setIsPlatformAdmin(false);
    setActiveWorkerProfile(null);
    setError(null);
    setOffline(false);
    setStatus("unauthenticated");
  }, []);

  const endSession = useCallback(() => {
    clearToken();
    setUser(null);
    setOrganizations([]);
    setActiveOrganizationState(null);
    setIsPlatformAdmin(false);
    setActiveWorkerProfile(null);
    setError(null);
    setOffline(false);
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
    const profile = org?.roles.includes("WORKER") ? await orgApi.getMyWorkerProfile(organizationId, token) : null;
    setActiveWorkerProfile(profile);
    if (user) rememberIdentity({ user, platformAdmin: isPlatformAdmin, organizations }, organizationId, profile);
  }, [organizations, user, isPlatformAdmin, rememberIdentity]);

  const roles = useMemo(() => activeOrganization?.roles ?? [], [activeOrganization]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status, user, organizations, activeOrganization, roles, isPlatformAdmin, activeWorkerProfile, error, offline,
      login, logout, endSession, refreshSession, setActiveOrganization: setActiveOrganizationById,
    }),
    [status, user, organizations, activeOrganization, roles, isPlatformAdmin, activeWorkerProfile, error, offline, login, logout, endSession, refreshSession, setActiveOrganizationById]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
