import { Badge } from "@/components/ui";
import type { WorkerCredentialSummary } from "@/api/shifts";
import { credentialState } from "./workerCredentialUtils";

type ReviewAwareCredential = WorkerCredentialSummary & {
  document_status?: "presented" | "verified" | "rejected" | null;
  /** The agency's own decision (organization_credential_reviews). Absent in the short summary. */
  organization_review_status?: "pending" | "approved" | "rejected" | null;
};

/**
 * The real state of a caregiver credential: its validity and the decision of the AGENCY, which is
 * responsible for reviewing and approving its staff's credentials (decisión 5-nov-2026).
 * ETNARA does not verify or certify credentials, so there is no "ETNARA Verified" state.
 */
export function WorkerCredentialBadge({ credential }: { credential: ReviewAwareCredential }) {
  const state = credentialState(credential);

  // Validity always wins: a revoked or expired credential never looks usable.
  if (state === "revoked") return <Badge tone="danger">Revocada</Badge>;
  if (state === "expired") return <Badge tone="danger">Vencida</Badge>;

  // The short summary (Centro de Cumplimiento) has no review data: show validity only.
  if (!("organization_review_status" in credential)) {
    return state === "expiring" ? <Badge tone="warning">Por vencer</Badge> : <Badge tone="neutral">Vigente</Badge>;
  }

  const review = credential.organization_review_status;
  if (review === "rejected") return <Badge tone="danger">Rechazada por la agencia</Badge>;
  if (review === "approved") {
    return state === "expiring"
      ? <Badge tone="warning">Aprobada por la agencia · vence pronto</Badge>
      : <Badge tone="success">Aprobada por la agencia</Badge>;
  }
  if (credential.document_status) return <Badge tone="warning">Pendiente de revisión de la agencia</Badge>;
  return <Badge tone="neutral">Sin documento</Badge>;
}
