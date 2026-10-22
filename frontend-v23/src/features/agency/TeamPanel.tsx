import { useCallback, useEffect, useState } from "react";
import { Copy, Mail, UserPlus, Users, X } from "lucide-react";
import type { ApiError } from "@/api/client";
import { getToken } from "@/auth/token";
import {
  inviteTeamMember,
  listTeam,
  revokeTeamInvitation,
  staffRoleLabel,
  teamActivationLink,
  type StaffRole,
  type TeamInvitation,
  type TeamMember,
} from "@/api/team";
import { Badge, Button, Card, ErrorState, Input, Modal, Select, Skeleton, useToast } from "@/components/ui";

const ROLE_HELP: Record<StaffRole, string> = {
  ORGANIZATION_ADMIN: "Todo, incluido equipo, horas, tarifas y facturación.",
  SUPERVISOR: "Turnos, residentes, cuidadores, incidentes y mensajes. No ve horas ni dinero.",
};

function inviteError(error: unknown): string {
  const apiError = error as ApiError;
  if (apiError.status === 0) return "No hay conexión con el servidor.";
  if (apiError.code === "ALREADY_A_MEMBER") return "Esa persona ya es parte de esta agencia.";
  if (apiError.code === "INVALID_PAYLOAD") return "Revisa el correo electrónico.";
  if (apiError.code === "TEAM_FORBIDDEN") return "Solo un administrador puede invitar al equipo.";
  return "No pudimos enviar la invitación. Intenta nuevamente.";
}

/** Equipo de la agencia: solo lo ve y lo usa un administrador (el backend lo exige). */
export function TeamPanel({ organizationId }: { organizationId: string }) {
  const toast = useToast();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [error, setError] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("SUPERVISOR");
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; role: StaffRole; link: string; emailed: boolean } | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const result = await listTeam(organizationId, token);
      setError(false);
      setMembers(result.members);
      setInvitations(result.invitations);
    } catch {
      setMembers([]);
      setError(true);
    }
  }, [organizationId]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    listTeam(organizationId, token)
      .then((result) => { if (!cancelled) { setError(false); setMembers(result.members); setInvitations(result.invitations); } })
      .catch(() => { if (!cancelled) { setMembers([]); setError(true); } });
    return () => { cancelled = true; };
  }, [organizationId]);

  function openInvite() {
    setEmail("");
    setRole("SUPERVISOR");
    setFormError(null);
    setSent(null);
    setInviting(true);
  }

  async function submit() {
    const token = getToken();
    if (!token || !email.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const result = await inviteTeamMember(organizationId, { email: email.trim(), role }, token);
      setSent({ email: result.invitation.email, role: result.invitation.role, link: teamActivationLink(result.token), emailed: result.emailDelivery.status === "sent" });
      await load();
    } catch (requestError) {
      setFormError(inviteError(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function revoke(invitation: TeamInvitation) {
    const token = getToken();
    if (!token) return;
    try {
      await revokeTeamInvitation(organizationId, invitation.id, token);
      toast.show(`Invitación de ${invitation.email} cancelada.`, "success");
      await load();
    } catch {
      toast.show("No pudimos cancelar la invitación.", "danger");
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.show("Enlace copiado.", "success");
    } catch {
      toast.show("No se pudo copiar. Mantén presionado el enlace para copiarlo.", "danger");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Equipo</h2>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Administradores y supervisores de la agencia. Los cuidadores se invitan desde Personal.</p>
        </div>
        <Button icon={<UserPlus size={18} />} onClick={openInvite}>Invitar</Button>
      </div>
      {members === null ? <Skeleton className="h-28" /> : error ? <ErrorState kind="server" onRetry={() => void load()} /> : (
        <Card className="flex flex-col divide-y divide-[var(--color-border)] p-0">
          {members.map((member) => (
            <div key={member.membershipId} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="flex min-w-0 items-center gap-2">
                <Users size={18} aria-hidden className="shrink-0 text-[var(--color-text-muted)]" />
                <p className="truncate font-medium text-[var(--color-text-primary)]">{member.email}</p>
                {member.isYou && <span className="text-[var(--text-caption)] text-[var(--color-text-muted)]">(tú)</span>}
              </div>
              <div className="flex gap-1.5">{member.roles.map((code) => <Badge key={code} tone={code === "ORGANIZATION_ADMIN" ? "accent" : "neutral"}>{staffRoleLabel[code]}</Badge>)}</div>
            </div>
          ))}
          {invitations.map((invitation) => (
            <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Mail size={18} aria-hidden className="shrink-0 text-[var(--color-text-muted)]" /><p className="truncate font-medium text-[var(--color-text-primary)]">{invitation.email}</p></div>
                <p className="mt-0.5 text-[var(--text-caption)] text-[var(--color-text-muted)]">Invitación pendiente · vence {new Date(invitation.expiresAt).toLocaleDateString("es-PR", { day: "numeric", month: "short" })}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="warning">{staffRoleLabel[invitation.role]}</Badge>
                <Button variant="ghost" size="md" icon={<X size={16} />} onClick={() => void revoke(invitation)}>Cancelar</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Modal
        open={inviting}
        onClose={() => !saving && setInviting(false)}
        title={sent ? "Invitación enviada" : "Invitar al equipo"}
        footer={sent
          ? <Button onClick={() => setInviting(false)}>Listo</Button>
          : <><Button variant="secondary" disabled={saving} onClick={() => setInviting(false)}>Cancelar</Button><Button loading={saving} disabled={!email.trim()} onClick={() => void submit()}>Enviar invitación</Button></>}
      >
        {sent ? (
          <div className="flex flex-col gap-3">
            <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">
              {sent.emailed ? `Le enviamos un correo a ${sent.email} para crear su cuenta de ${staffRoleLabel[sent.role].toLowerCase()}.` : `No pudimos enviar el correo. Comparte este enlace con ${sent.email}:`}
            </p>
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-ivory-100)] p-3">
              <p className="break-all text-[var(--text-caption)] text-[var(--color-text-secondary)] select-text">{sent.link}</p>
            </div>
            <Button variant="secondary" icon={<Copy size={16} />} onClick={() => void copy(sent.link)}>Copiar enlace</Button>
            <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">El enlace vence en 7 días y solo sirve una vez.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Select label="Rol" value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="ORGANIZATION_ADMIN">Administrador</option>
            </Select>
            <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{ROLE_HELP[role]}</p>
            {formError && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{formError}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
