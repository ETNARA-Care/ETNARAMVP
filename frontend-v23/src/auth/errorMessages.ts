import type { ApiError } from "@/api/client";
import i18n from "@/i18n";

/**
 * Messages by status/code. The backend sends no readable text (only
 * `{ error: "CODE" }`), so the text lives here, in the auth catalog (es / en).
 */
export function loginErrorMessage(err: ApiError): string {
  if (err.isNetworkError || err.status === 0) return i18n.t("auth:errors.network");
  if (err.status === 401) return i18n.t("auth:errors.invalidCredentials");
  if (err.status === 403) return i18n.t("auth:errors.forbidden");
  if (err.status === 429) return i18n.t("auth:errors.tooManyAttempts");
  if (err.status >= 500) return i18n.t("auth:errors.unavailable");
  return i18n.t("auth:errors.unexpected");
}

export function bootstrapErrorMessage(err: ApiError): string {
  if (err.isNetworkError || err.status === 0) return i18n.t("auth:errors.network");
  if (err.status >= 500) return i18n.t("auth:errors.unavailable");
  return i18n.t("auth:errors.sessionLost");
}
