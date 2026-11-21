import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Landmark } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Card, PageHeader } from "@/components/ui";
import { ServicesTab } from "@/features/finance/ServicesTab";
import { CaregiversTab } from "@/features/finance/CaregiversTab";
import { ClientsTab } from "@/features/finance/ClientsTab";
import { HolidaysTab } from "@/features/finance/HolidaysTab";
import { BillingTab } from "@/features/billing/BillingTab";

const TABS = [
  { id: "services", label: "Servicios y tarifas" },
  { id: "caregivers", label: "Por cuidador" },
  { id: "clients", label: "Clientes" },
  { id: "holidays", label: "Feriados" },
  { id: "billing", label: "Facturación" }, // label from the billing catalog (es/en)
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * Finanzas → Servicios y Tarifas (backend 119). Agency administrator only and
 * only while ETNARA central has FINANZAS on for the agency (FeatureRoute in
 * App.tsx). Supervisors, caregivers, relatives and ETNARA central never see it.
 */
export function AgencyFinancePage() {
  // Re-render every tab when the language changes: dates follow the app language (F1.1 visual).
  useTranslation();
  const { roles, activeOrganization } = useAuth();
  const { t: tBilling } = useTranslation("billing");
  const [tab, setTab] = useState<TabId>("services");
  const organizationId = activeOrganization?.id;

  if (!roles.includes("ORGANIZATION_ADMIN")) {
    return (
      <div className="flex flex-col gap-[var(--spacing-md)]">
        <PageHeader title="Finanzas" description="Servicios, tarifas de cobro y tarifas de pago de la agencia." />
        <Card><p className="font-medium text-[var(--color-text-primary)]">Esta sección es solo para administradores.</p></Card>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-lg)]">
      <PageHeader
        title="Finanzas"
        description="Servicios que ofrece la agencia, lo que cobra a cada cliente y lo que paga a cada cuidador. ETNARA no mueve dinero."
      />
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-finance-tabs>
        <div role="tablist" aria-label="Secciones de Finanzas" className="inline-flex min-w-full gap-1 rounded-[var(--radius-pill)] bg-[var(--color-ivory-100)] p-1 sm:min-w-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`h-10 shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] px-4 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-[var(--color-navy-900)] text-white shadow-[var(--shadow-card)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t.id === "billing" ? tBilling("tab") : t.label}
            </button>
          ))}
        </div>
      </div>
      {organizationId && (
        <>
          {tab === "services" && <ServicesTab organizationId={organizationId} />}
          {tab === "caregivers" && <CaregiversTab organizationId={organizationId} />}
          {tab === "clients" && <ClientsTab organizationId={organizationId} />}
          {tab === "holidays" && <HolidaysTab organizationId={organizationId} />}
          {tab === "billing" && <BillingTab organizationId={organizationId} />}
        </>
      )}
      {tab !== "billing" && <p className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
        <Landmark size={14} className="mt-0.5 shrink-0" aria-hidden />
        El margen bruto es una estimación entre lo cobrado y lo pagado por el mismo servicio. No incluye nómina, contribuciones, seguros ni otros gastos: no es ganancia neta.
      </p>}
    </div>
  );
}
