import { apiClient } from "./client";

/**
 * Contrato real confirmado en src/modules/auth/auth.routes.ts del backend
 * (etnara-care-backend-staging): acepta `email` XOR `phone` + `password`,
 * responde `{ token, expiresAt }` en éxito. Nada inventado aquí.
 */
export interface LoginPayload {
  email?: string;
  phone?: string;
  password: string;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
}

export function login(payload: LoginPayload): Promise<LoginResult> {
  return apiClient.post<LoginResult>("/auth/login", payload);
}

export function logout(token: string): Promise<{ ok: boolean }> {
  return apiClient.post<{ ok: boolean }>("/auth/logout", undefined, token);
}
