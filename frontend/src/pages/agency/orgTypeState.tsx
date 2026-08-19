import { createContext, useContext, useState, type ReactNode } from "react";
import type { OrganizationType } from "../../demoData/organizations";

interface OrgTypeContextValue {
  type: OrganizationType;
  setType: (t: OrganizationType) => void;
}

const OrgTypeContext = createContext<OrgTypeContextValue | null>(null);

export function OrgTypeProvider({ children }: { children: ReactNode }) {
  const [type, setType] = useState<OrganizationType>("RESIDENTIAL_CARE_HOME");
  return <OrgTypeContext.Provider value={{ type, setType }}>{children}</OrgTypeContext.Provider>;
}

export function useOrgType() {
  const ctx = useContext(OrgTypeContext);
  if (!ctx) throw new Error("useOrgType must be used within OrgTypeProvider");
  return ctx;
}
