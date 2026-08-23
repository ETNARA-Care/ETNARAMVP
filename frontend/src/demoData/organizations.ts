export type OrganizationType = "HOME_CARE_AGENCY" | "RESIDENTIAL_CARE_HOME";

export interface DemoOrganization {
  id: string;
  name: string;
  type: OrganizationType;
}

export const demoOrganizations: DemoOrganization[] = [
  { id: "org-1", name: "Hogar Serenidad Demo", type: "RESIDENTIAL_CARE_HOME" },
  { id: "org-2", name: "Cuidado en Casa Demo", type: "HOME_CARE_AGENCY" },
];
