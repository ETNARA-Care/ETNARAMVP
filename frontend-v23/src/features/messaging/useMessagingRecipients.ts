import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listCareRecipients, recipientName } from "@/api/shifts";
import type { MessagingRecipient } from "./ConversationUI";

/**
 * Residentes que el usuario ya puede ver (el backend filtra por rol y
 * asignación), solo para nombrar conversaciones. Si falla, la lista queda vacía
 * y las conversaciones conservan su título genérico.
 */
export function useMessagingRecipients(): MessagingRecipient[] {
  const { activeOrganization } = useAuth();
  const [recipients, setRecipients] = useState<MessagingRecipient[]>([]);
  useEffect(() => {
    const token = getToken();
    if (!token || !activeOrganization) return;
    let cancelled = false;
    listCareRecipients(activeOrganization.id, token)
      .then((rows) => { if (!cancelled) setRecipients(rows.filter((row) => row.status === "active").map((row) => ({ id: row.id, name: recipientName(row) }))); })
      .catch(() => { if (!cancelled) setRecipients([]); });
    return () => { cancelled = true; };
  }, [activeOrganization]);
  return recipients;
}
