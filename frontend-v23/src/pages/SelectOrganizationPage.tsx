import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { resolveExperienceRoute } from "@/auth/roles";

export function SelectOrganizationPage() {
  const { organizations, setActiveOrganization } = useAuth();
  const navigate = useNavigate();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(orgId: string) {
    setSelectingId(orgId);
    setError(null);
    try {
      await setActiveOrganization(orgId);
      const org = organizations.find((o) => o.id === orgId);
      const route = resolveExperienceRoute(org?.roles ?? []);
      navigate(route ?? "/login", { replace: true });
    } catch {
      setError("No pudimos activar esa organización. Intenta de nuevo.");
      setSelectingId(null);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-[var(--spacing-md)] bg-[var(--color-navy-950)]">
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        <div className="text-center mb-2">
          <h1 className="font-display text-[var(--text-h2)] text-[var(--color-surface)]">Elige una organización</h1>
          <p className="text-[var(--text-small)] text-[var(--color-ivory-200)] mt-1">Tienes acceso a más de una.</p>
        </div>
        {organizations.map((org) => (
          <Card key={org.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">{org.name}</p>
              <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{org.type}</p>
            </div>
            <Button size="md" loading={selectingId === org.id} onClick={() => choose(org.id)}>
              Entrar
            </Button>
          </Card>
        ))}
        {error && <p role="alert" className="text-center text-[var(--text-small)] text-[var(--color-danger-100)]">{error}</p>}
      </div>
    </div>
  );
}
