import { Badge } from "@/components/ui";
import type { WorkerCredentialSummary } from "@/api/shifts";
import { credentialState } from "./workerCredentialUtils";

export function WorkerCredentialBadge({ credential }: { credential: WorkerCredentialSummary }) {
  const state = credentialState(credential);
  if (state === "revoked") return <Badge tone="danger">Revocada</Badge>;
  if (state === "expired") return <Badge tone="danger">Vencida</Badge>;
  if (state === "expiring") return <Badge tone="warning">Por vencer</Badge>;
  return <Badge tone="success">Vigente</Badge>;
}
