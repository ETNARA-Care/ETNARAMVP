import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listMyCareRecipients, type FamilyRecipient } from "@/api/familyTimeline";
import { FamilyRecipientContext, familyRecipientName, pickRecipient, recipientKey, useFamilyRecipient } from "./familyRecipient";

export function FamilyRecipientProvider({ children }: { children: ReactNode }) {
  const [recipients, setRecipients] = useState<FamilyRecipient[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let alive = true;
    listMyCareRecipients(token)
      .then((rows) => { if (alive) setRecipients(rows); })
      .catch(() => { if (alive) setRecipients([]); });
    return () => { alive = false; };
  }, []);

  return (
    <FamilyRecipientContext.Provider value={{ recipients, selectedKey, select: setSelectedKey }}>
      {children}
    </FamilyRecipientContext.Provider>
  );
}

/** Selector visible solo cuando la cuenta tiene más de un familiar autorizado. */
export function FamilyRecipientSwitcher() {
  const { recipients, selectedKey, select } = useFamilyRecipient();
  const { activeOrganization } = useAuth();
  if (recipients.length < 2) return null;
  const current = pickRecipient(recipients, activeOrganization?.id, selectedKey);

  return (
    <div role="group" aria-label="Escoge a tu familiar" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {recipients.map((recipient) => {
        const key = recipientKey(recipient);
        const active = current ? recipientKey(current) === key : false;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => select(key)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${active ? "border-[#102b57] bg-[#102b57] text-white" : "border-[#102b57]/15 bg-white text-[#173154]"}`}
          >
            {familyRecipientName(recipient)}
          </button>
        );
      })}
    </div>
  );
}
