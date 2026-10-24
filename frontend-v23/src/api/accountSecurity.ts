import { apiClient } from "./client";

/**
 * Phone linked to the account + SMS recovery (backend migration 117).
 * Every phone route answers 404 FEATURE_NOT_ENABLED until SMS is switched on;
 * the app asks first (recovery options / phoneVerificationAvailable) and hides
 * what is not available. Numbers come back masked (•••-•••-1234) only.
 */
export interface AccountSecurity {
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  phoneRequired: boolean;
  phoneRecommended: boolean;
  smsRecoveryAvailable: boolean;
  smsRecoveryPausedUntil: string | null;
  phoneVerificationAvailable: boolean;
}

export async function getAccountSecurity(token: string): Promise<AccountSecurity> {
  return (await apiClient.get<{ security: AccountSecurity }>("/me/account-security", token)).security;
}

export function reauthenticate(password: string, token: string): Promise<{ ok: boolean }> {
  return apiClient.post<{ ok: boolean }>("/me/reauthenticate", { password }, token);
}

export function startPhoneVerification(phone: string, token: string): Promise<{ sent: boolean; resendAfterSeconds: number }> {
  return apiClient.post("/me/phone/verification", { phone }, token);
}

export function confirmPhoneVerification(code: string, token: string): Promise<{ phone: string; phoneVerified: boolean; changed: boolean }> {
  return apiClient.post("/me/phone/verification/confirm", { code }, token);
}

export function getRecoveryOptions(): Promise<{ email: boolean; sms: boolean }> {
  return apiClient.get("/auth/recovery-options");
}

export function requestSmsReset(phone: string): Promise<{ ok: boolean }> {
  return apiClient.post("/auth/password-reset/sms/request", { phone });
}

export function verifySmsReset(phone: string, code: string): Promise<{ resetToken: string; expiresInSeconds: number }> {
  return apiClient.post("/auth/password-reset/sms/verify", { phone, code });
}
