import { Badge } from "@/components/ui";
import type { WorkerCredentialSummary } from "@/api/shifts";
import { credentialState } from "./workerCredentialUtils";

type ReviewAwareCredential = WorkerCredentialSummary & {
  document_status?: "presented" | "verified" | "rejected" | null;
  organization_review_status?: "pending" | "approved" | "rejected" | null;
  verification_status?: "verified" | "pending" | "rejected" | null;
};

export function WorkerCredentialBadge({ credential }: { credential: ReviewAwareCredential }) {
  const state = credentialState(credential);

  // Hard validity rules always win. A revoked or expired credential can never
  // appear compliant, regardless of who approved the uploaded document.
  if (state === "revoked") return <Badge tone="danger">Revocada</Badge>;
  if (state === "expired") return <Badge tone="danger">Vencida</Badge>;

  // Uploading a document is evidence submission, not proof of compliance.
  if (credential.document_status === "rejected" || credential.organization_review_status === "rejected" || credential.verification_status === "rejected") {
    return <Badge tone="danger">Rechazada</Badge>;
  }
  if (credential.document_status === "presented" || credential.organization_review_status === "pending" || credential.verification_status === "pending") {
    return <Badge tone="warning">Pendiente de revisión</Badge>;
  }

  // ETNARA verification is intentionally distinct from an organization's own
  // review. Only an independently verified credential gets the Verified label.
  if (credential.verification_status === "verified" || credential.document_status === "verified") {
    return <Badge tone="success">ETNARA Verified</Badge>;
  }

  if (state === "expiring") return <Badge tone="warning">Por vencer</Badge>;

  // Metadata may be current while its evidence has not yet been independently
  // verified. Do not imply that merely having an active record equals compliance.
  return <Badge tone="warning">Sin verificar</Badge>;
}
