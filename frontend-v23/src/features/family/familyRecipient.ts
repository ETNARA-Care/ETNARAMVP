import { createContext, useContext } from "react";
import type { FamilyRecipient } from "@/api/familyTimeline";

/**
 * Familiar seleccionado dentro del Portal de Familia.
 *
 * Una cuenta familiar puede tener más de un familiar autorizado (por ejemplo,
 * mamá y papá en la misma agencia). Las páginas siguen pidiendo los datos con
 * los contratos curados de Familia; este contexto solo decide CUÁL familiar
 * mostrar. La selección vive en memoria: al recargar se vuelve al primero.
 */
export const recipientKey = (recipient: FamilyRecipient) => `${recipient.organizationId}:${recipient.recipientId}`;

export function familyRecipientName(recipient: FamilyRecipient): string {
  return recipient.preferredName || `${recipient.firstName} ${recipient.lastName}`.trim();
}

export function pickRecipient(
  recipients: FamilyRecipient[],
  activeOrganizationId: string | undefined,
  selectedKey: string | null,
): FamilyRecipient | undefined {
  if (selectedKey) {
    const match = recipients.find((recipient) => recipientKey(recipient) === selectedKey);
    if (match) return match;
  }
  const inActiveOrganization = activeOrganizationId
    ? recipients.find((recipient) => recipient.organizationId === activeOrganizationId)
    : undefined;
  return inActiveOrganization ?? recipients[0];
}

export interface FamilyRecipientState {
  recipients: FamilyRecipient[];
  selectedKey: string | null;
  select: (key: string) => void;
}

export const FamilyRecipientContext = createContext<FamilyRecipientState>({ recipients: [], selectedKey: null, select: () => {} });

export function useFamilyRecipient(): FamilyRecipientState {
  return useContext(FamilyRecipientContext);
}

