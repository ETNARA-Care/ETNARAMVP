import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Mail, RotateCw, UserPlus, XCircle } from "lucide-react";
import { getToken } from "@/auth/token";
import {
  createAccessInvitation,
  deactivateInvitedAccess,
  listAccessInvitations,
  renewAccessInvitation,
  revokeAccessInvitation,
  type AccessInvitation,
} from "@/api/accessInvitations";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Skeleton, useToast } from "@/components/ui";

type Props =
  | { organizationId: string; type: "worker"; workerMembershipId: string }
  | { organizationId: string; type: "family"; careRecipientId: string };

const labels = {
  pending: { text: "Pendiente", tone: "warning" as const },
  accepted: { text: "Aceptada", tone: "success" as const },
  expired: { text: "Vencida", tone: "neutral" as const },
  revoked: { text: "Revocada", tone: "danger" as const },
};

function buildActivationLink(token: string) {
  const path = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}activate`;
  return `${new URL(path, window.location.origin).toString()}#token=${token}`;
}

export function AccessInvitationPanel(props: Props) {
  const [invitations, setInvitations] = useState<AccessInvitation[] | undefined>();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [relationshipType, setRelationshipType] = useState("Familiar");
  const [saving, setSaving] = useState(false);
  const [secureLink, setSecureLink] = useState<string | null>(null);
  const toast = useToast();
  const workerAlreadyLinked = props.type === "worker" && invitations?.some((row) => row.account_linked);

  const target = props.type === "worker"
    ? { workerMembershipId: props.workerMembershipId }
    : { careRecipientId: props.careRecipientId };

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setInvitations(await listAccessInvitations(props.organizationId, target, token));
    } catch {
      setInvitations([]);
      toast.show("No pudimos cargar las invitaciones.", "danger");
    }
  // target is intentionally represented by stable primitive ids from props.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.organizationId, props.type, props.type === "worker" ? props.workerMembershipId : props.careRecipientId]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    const token = getToken();
    if (!token || !email.trim()) return;
    setSaving(true);
    try {
      const input = props.type === "worker"
        ? { type: "worker" as const, email: email.trim(), workerMembershipId: props.workerMembershipId }
        : { type: "family" as const, email: email.trim(), careRecipientId: props.careRecipientId, relationshipType };
      const result = await createAccessInvitation(props.organizationId, input, token);
      setSecureLink(buildActivationLink(result.token));
      setOpen(false);
      setEmail("");
      await load();
      toast.show("Invitación segura creada.", "success");
    } catch {
      toast.show("No pudimos crear la invitación. Verifica si ya existe una pendiente.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (invitationId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await revokeAccessInvitation(props.organizationId, invitationId, token);
      await load();
      toast.show("Invitación revocada.", "success");
    } catch {
      toast.show("No pudimos revocar la invitación.", "danger");
    }
  };

  const renew = async (invitationId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const result = await renewAccessInvitation(props.organizationId, invitationId, token);
      setSecureLink(buildActivationLink(result.token));
      await load();
      toast.show("Se generó un enlace nuevo; el anterior dejó de funcionar.", "success");
    } catch {
      toast.show("No pudimos renovar la invitación.", "danger");
    }
  };

  const deactivate = async (invitationId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await deactivateInvitedAccess(props.organizationId, invitationId, token);
      await load();
      toast.show("Acceso desactivado; el historial permanece guardado.", "success");
    } catch {
      toast.show("No pudimos desactivar el acceso.", "danger");
    }
  };

  const copy = async () => {
    if (!secureLink) return;
    try {
      await navigator.clipboard.writeText(secureLink);
      toast.show("Enlace copiado.", "success");
    } catch {
      toast.show("Selecciona y copia el enlace manualmente.", "warning");
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound size={21} className="text-[var(--color-text-muted)]" aria-hidden />
            <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">
              {props.type === "worker" ? "Acceso a ETNARA" : "Acceso familiar"}
            </h2>
          </div>
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">
            Invitaciones de uso único con vencimiento de siete días.
          </p>
        </div>
        {!workerAlreadyLinked && <Button icon={<UserPlus size={18} />} onClick={() => setOpen(true)}>Crear invitación</Button>}
      </div>

      {invitations === undefined ? <Skeleton className="h-24" /> : invitations.length === 0 ? (
        <EmptyState icon={<Mail size={28} />} title="No hay invitaciones todavía." />
      ) : (
        <div className="flex flex-col gap-2">
          {invitations.map((invitation) => {
            const label = labels[invitation.status];
            return (
              <Card key={invitation.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--color-text-primary)] break-all">{invitation.email}</p>
                    <Badge tone={invitation.status === "accepted" && !invitation.account_linked ? "neutral" : label.tone}>
                      {invitation.status === "accepted" && !invitation.account_linked ? "Acceso desactivado" : label.text}
                    </Badge>
                  </div>
                  <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">
                    {invitation.status === "accepted" && invitation.accepted_at
                      ? `Aceptada ${new Date(invitation.accepted_at).toLocaleString("es-PR")}`
                      : `Vence ${new Date(invitation.expires_at).toLocaleString("es-PR")}`}
                  </p>
                </div>
                {(invitation.status === "pending" || invitation.status === "expired") && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" icon={<RotateCw size={16} />} onClick={() => void renew(invitation.id)}>Nuevo enlace</Button>
                    <Button variant="danger" icon={<XCircle size={16} />} onClick={() => void revoke(invitation.id)}>Revocar</Button>
                  </div>
                )}
                {props.type === "family" && invitation.status === "accepted" && invitation.account_linked && (
                  <Button variant="danger" icon={<XCircle size={16} />} onClick={() => void deactivate(invitation.id)}>Desactivar acceso</Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={props.type === "worker" ? "Invitar al personal" : "Invitar a un familiar"}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void create()} loading={saving} disabled={!email.trim()}>Crear enlace seguro</Button></>}
      >
        <div className="flex flex-col gap-3">
          <Input label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          {props.type === "family" && (
            <Select label="Relación con el residente" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>
              <option value="Familiar">Familiar</option><option value="Hija/o">Hija/o</option><option value="Esposa/o">Esposa/o</option><option value="Tutora/or">Tutora/or</option><option value="Contacto autorizado">Contacto autorizado</option>
            </Select>
          )}
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">La contraseña la establece la persona invitada. ETNARA nunca la muestra al administrador.</p>
        </div>
      </Modal>

      <Modal
        open={Boolean(secureLink)}
        onClose={() => setSecureLink(null)}
        title="Enlace de activación listo"
        footer={<Button onClick={() => setSecureLink(null)}>Terminar</Button>}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Copia este enlace y envíalo únicamente al correo indicado. Por seguridad, no podrás volver a consultar este mismo enlace después de cerrar.</p>
          <Input label="Enlace seguro" value={secureLink ?? ""} readOnly />
          <Button variant="secondary" icon={<Copy size={18} />} onClick={() => void copy()}>Copiar enlace</Button>
        </div>
      </Modal>
    </section>
  );
}
