import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Mail, MailCheck, RotateCw, Send, UserPlus, XCircle } from "lucide-react";
import { getToken } from "@/auth/token";
import {
  createAccessInvitation,
  deactivateInvitedAccess,
  listAccessInvitations,
  renewAccessInvitation,
  resendFamilyInvitation,
  revokeAccessInvitation,
  sendFamilyInvitation,
  type AccessInvitation,
} from "@/api/accessInvitations";
import type { ApiError } from "@/api/client";
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

/** Why a family invitation e-mail was not sent, in words an agency can act on. */
function familySendError(error: unknown): string {
  const { status, code } = (error ?? {}) as ApiError;
  if (code === "EMAIL_NOT_CONFIRMED") return "No pudimos confirmar que el correo se haya enviado. Revisa la lista antes de reintentar; si no dice «Correo enviado», usa «Reenviar».";
  if (code === "RESEND_TOO_SOON" || status === 429) return "Ya enviamos este correo hace menos de un minuto. Espera un momento y vuelve a intentarlo.";
  if (code === "EMAIL_NOT_CONFIGURED") return "El envío de correos no está disponible en este momento. La invitación quedó pendiente; vuelve a intentarlo más tarde o avisa a ETNARA.";
  if (code === "INVITATION_EMAIL_FAILED") return "No pudimos enviar el correo. La invitación quedó pendiente y no se duplicará: revisa la dirección y vuelve a intentarlo.";
  if (code === "RECIPIENT_NOT_ACTIVE") return "Este residente no está activo; no se puede invitar a familiares.";
  if (code === "INVITATION_NOT_RESENDABLE") return "Esta invitación ya fue aceptada o revocada; no se puede reenviar.";
  if (status === 403) return "No tienes permiso para invitar familiares.";
  if (status === 0 && (error as ApiError | undefined)?.isNetworkError) return "Se perdió la conexión. Revisa la lista: si dice «Correo enviado», la invitación ya salió; si no, vuelve a intentarlo cuando tengas señal.";
  return "No pudimos enviar la invitación. Vuelve a intentarlo.";
}

const sentAtText = (iso: string) => new Date(iso).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" });

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
  const [sendError, setSendError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
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

  const openCreate = () => { setSendError(null); setOpen(true); };

  const create = async () => {
    const token = getToken();
    if (!token || !email.trim()) return;
    setSaving(true);
    setSendError(null);
    if (props.type === "family") {
      const address = email.trim();
      try {
        // Confirmation only once the e-mail provider accepted the message.
        await sendFamilyInvitation(props.organizationId, { email: address, careRecipientId: props.careRecipientId, relationshipType }, token);
        setOpen(false);
        setEmail("");
        toast.show(`Invitación enviada a ${address}.`, "success");
      } catch (error) {
        // The modal stays open with the same data: the button retries without creating a duplicate.
        setSendError(familySendError(error));
      } finally {
        setSaving(false);
        await load();
      }
      return;
    }
    try {
      const result = await createAccessInvitation(props.organizationId, { type: "worker", email: email.trim(), workerMembershipId: props.workerMembershipId }, token);
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

  const resend = async (invitation: AccessInvitation) => {
    const token = getToken();
    if (!token || resendingId) return;
    setResendingId(invitation.id);
    try {
      await resendFamilyInvitation(props.organizationId, invitation.id, token);
      toast.show(`Invitación reenviada a ${invitation.email}. El enlace anterior dejó de funcionar.`, "success");
    } catch (error) {
      toast.show(familySendError(error), "danger");
    } finally {
      setResendingId(null);
      await load();
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
            {props.type === "family" ? "Enviamos por correo un enlace de uso único que vence en siete días." : "Invitaciones de uso único con vencimiento de siete días."}
          </p>
        </div>
        {!workerAlreadyLinked && <Button icon={<UserPlus size={18} />} onClick={openCreate}>Crear invitación</Button>}
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
                      ? `Aceptada ${new Date(invitation.accepted_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}`
                      : `Vence ${new Date(invitation.expires_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}`}
                  </p>
                  {props.type === "family" && invitation.status === "pending" && (
                    invitation.email_sent_at
                      ? <p data-ui="invitation-email-sent" className="mt-1 inline-flex items-center gap-1.5 text-[var(--text-caption)] text-[var(--color-success-700)]"><MailCheck size={14} aria-hidden />Correo enviado {sentAtText(invitation.email_sent_at)}</p>
                      : <p data-ui="invitation-email-missing" className="mt-1 text-[var(--text-caption)] text-[var(--color-warning-700)]">El correo no se envió todavía. Usa «Reenviar».</p>
                  )}
                </div>
                {(invitation.status === "pending" || invitation.status === "expired") && (
                  <div className="flex flex-wrap gap-2">
                    {props.type === "family"
                      ? <Button variant="secondary" icon={<Send size={16} />} loading={resendingId === invitation.id} disabled={resendingId !== null && resendingId !== invitation.id} onClick={() => void resend(invitation)}>Reenviar</Button>
                      : <Button variant="secondary" icon={<RotateCw size={16} />} onClick={() => void renew(invitation.id)}>Nuevo enlace</Button>}
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
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button><Button icon={props.type === "family" ? <Send size={17} /> : undefined} onClick={() => void create()} loading={saving} disabled={!email.trim()}>{props.type === "family" ? (sendError ? "Reintentar envío" : "Enviar invitación") : "Crear enlace seguro"}</Button></>}
      >
        <div className="flex flex-col gap-3">
          <Input label="Correo electrónico" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(event) => { setEmail(event.target.value); setSendError(null); }} required />
          {props.type === "family" && (
            <Select label="Relación con el residente" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}>
              <option value="Familiar">Familiar</option><option value="Hija/o">Hija/o</option><option value="Esposa/o">Esposa/o</option><option value="Tutora/or">Tutora/or</option><option value="Contacto autorizado">Contacto autorizado</option>
            </Select>
          )}
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{props.type === "family"
            ? "ETNARA enviará a este correo un enlace seguro de un solo uso (vence en 7 días). La persona crea su propia contraseña; nunca se envían contraseñas por correo."
            : "La contraseña la establece la persona invitada. ETNARA nunca la muestra al administrador."}</p>
          {sendError && <p role="alert" data-ui="invitation-send-error" className="rounded-[var(--radius-md)] border border-[var(--color-danger-100)] bg-[var(--color-danger-100)]/40 p-3 text-[var(--text-small)] text-[var(--color-danger-700)]">{sendError}</p>}
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
