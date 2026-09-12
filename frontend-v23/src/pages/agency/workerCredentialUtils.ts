import type { WorkerCredentialSummary } from "@/api/shifts";

export function credentialState(credential: WorkerCredentialSummary): "active" | "expiring" | "expired" | "revoked" {
  if (credential.status === "revoked") return "revoked";
  if (credential.status === "expired") return "expired";
  if (!credential.expires_at) return "active";
  const expiry = new Date(`${credential.expires_at}T23:59:59`);
  if (expiry.getTime() < Date.now()) return "expired";
  const thirtyDaysFromNow = Date.now() + 30 * 24 * 60 * 60 * 1000;
  return expiry.getTime() <= thirtyDaysFromNow ? "expiring" : "active";
}

export function formatCredentialDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-PR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
