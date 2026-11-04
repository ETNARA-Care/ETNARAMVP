import { apiClient } from "./client";

/** Web Push (Backend 146). Todo es de la persona que inició sesión: sus teléfonos y sus preferencias. */
export interface PushConfig { enabled: boolean; publicKey: string | null }
export interface PushPreferences {
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  /** null = según el rol (administradora sí, supervisora no). */
  agencyAlerts: boolean | null;
  agencyRole: "admin" | "supervisor" | null;
  agencyAlertsEffective: boolean;
}
export interface PushDevice { id: string; deviceLabel: string | null; createdAt: string; lastSuccessAt: string | null; thisSession: boolean }
export interface NotificationTarget { path: string | null; organizationId: string | null; portal: "agency" | "caregiver" | "family" | null }
export interface BrowserSubscription { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null }

export const pushApi = {
  config: (token: string) => apiClient.get<PushConfig>("/me/push/config", token),
  devices: (token: string) => apiClient.get<{ items: PushDevice[] }>("/me/push/subscriptions", token),
  register: (sub: BrowserSubscription, deviceLabel: string, token: string) =>
    apiClient.post<{ id: string }>("/me/push/subscriptions", { endpoint: sub.endpoint, keys: sub.keys, deviceLabel }, token),
  /** POST para que el endpoint nunca vaya en una URL. */
  unregister: (endpoint: string, token: string) => apiClient.post<{ removed: number }>("/me/push/subscriptions/unsubscribe", { endpoint }, token),
  removeDevice: (id: string, token: string) => apiClient.delete<void>(`/me/push/subscriptions/${encodeURIComponent(id)}`, token),
  preferences: (token: string) => apiClient.get<PushPreferences>("/me/push/preferences", token),
  savePreferences: (prefs: Pick<PushPreferences, "quietEnabled" | "quietStart" | "quietEnd" | "agencyAlerts">, token: string) =>
    apiClient.put<PushPreferences>("/me/push/preferences", prefs, token),
  test: (token: string) => apiClient.post<{ notificationId: string }>("/me/push/test", {}, token),
  target: (notificationId: string, token: string) =>
    apiClient.get<NotificationTarget>(`/me/notifications/${encodeURIComponent(notificationId)}/target`, token),
};
