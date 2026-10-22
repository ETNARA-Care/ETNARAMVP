import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { ApiError } from "@/api/client";
import { getToken } from "@/auth/token";
import { listTeam, setStaffRole } from "@/api/team";
import { Badge, Button, Card, Modal, useToast } from "@/components/ui";

function roleError(error: unknown): string {
  const apiError = error as ApiError;
  if (apiError.status === 0) return "No hay conexión con el servidor.";
  if (apiError.code === "NO_ACCOUNT_YET") return "Primero debe activar su cuenta con la invitación de acceso de abajo.";
  if (apiError.code === "TEAM_FORBIDDEN") return "Solo un administrador puede cambiar roles.";
  return "No pudimos cambiar el rol. Intenta nuevamente.";
}

/**
 * Fase 12.3: el administrador hace supervisor/a a un cuidador/a de su agencia.
 * Conserva sus turnos (sigue siendo cuidador/a) y además maneja la agencia.
 */
export function StaffRoleCard({ organizationId, workerMembershipId, name }: { organizationId: string; workerMembershipId: string; name: string }) {
  const toast = useToast();
  const [isSupervisor, setIsSupervisor] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState<"grant" | "revoke" | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    listTeam(organizationId, token)
      .then((team) => { if (!cancelled) setIsSupervisor(team.members.some((member) => member.workerMembershipId === workerMembershipId && member.roles.includes("SUPERVISOR"))); })
      .catch(() => { if (!cancelled) setIsSupervisor(false); });
    return () => { cancelled = true; };
  }, [organizationId, workerMembershipId, version]);

  async function apply() {
    const token = getToken();
    if (!token || !confirming) return;
    setSaving(true);
    try {
      await setStaffRole(organizationId, { workerMembershipId, role: "SUPERVISOR", enabled: confirming === "grant" }, token);
      toast.show(confirming === "grant" ? `${name} ahora también es supervisor/a.` : `${name} ya no es supervisor/a.`, "success");
      setConfirming(null);
      setVersion((value) => value + 1);
    } catch (error) {
      toast.show(roleError(error), "danger");
    } finally {
      setSaving(false);
    }
  }

  if (isSupervisor === null) return null;

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <ShieldCheck size={22} aria-hidden className="mt-0.5 shrink-0" />
        <div>
          <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-[var(--color-text-primary)]">Rol en la agencia</p>{isSupervisor && <Badge tone="accent">Supervisor/a</Badge>}</div>
          <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">
            {isSupervisor
              ? "Maneja turnos, residentes, cuidadores e incidentes, y sigue trabajando sus turnos. No ve horas ni dinero."
              : "Si la haces supervisor/a, seguirá trabajando sus turnos y además podrá manejar la agencia (sin ver horas ni dinero)."}
          </p>
        </div>
      </div>
      <Button variant={isSupervisor ? "secondary" : "primary"} onClick={() => setConfirming(isSupervisor ? "revoke" : "grant")}>
        {isSupervisor ? "Quitar supervisor/a" : "Hacer supervisor/a"}
      </Button>
      <Modal
        open={confirming !== null}
        onClose={() => !saving && setConfirming(null)}
        title={confirming === "grant" ? "Hacer supervisor/a" : "Quitar supervisor/a"}
        footer={<><Button variant="secondary" disabled={saving} onClick={() => setConfirming(null)}>Cancelar</Button><Button variant={confirming === "revoke" ? "danger" : "primary"} loading={saving} onClick={() => void apply()}>{confirming === "grant" ? "Sí, hacer supervisor/a" : "Sí, quitar"}</Button></>}
      >
        <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">
          {confirming === "grant"
            ? `${name} podrá entrar a la agencia con su misma cuenta y seguirá viendo "Mi día" para sus turnos.`
            : `${name} seguirá siendo cuidador/a, pero ya no podrá entrar a la agencia.`}
        </p>
      </Modal>
    </Card>
  );
}
