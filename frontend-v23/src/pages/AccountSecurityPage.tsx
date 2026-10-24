import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, LogOut, Mail, Phone, ShieldCheck } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { PhoneLinkFlow } from "@/features/accountSecurity/PhoneLinkFlow";
import { useAccountSecurity } from "@/features/accountSecurity/useAccountSecurity";

function Row({ icon, label, value, badge }: { icon: React.ReactNode; label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-ivory-100)] text-[var(--color-navy-700)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[var(--text-caption)] text-[var(--color-text-muted)]">{label}</span>
        <span className="block truncate font-medium text-[var(--color-text-primary)]">{value}</span>
      </span>
      {badge}
    </div>
  );
}

function pausedText(iso: string): string {
  return new Date(iso).toLocaleString("es-PR", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
}

/**
 * «Seguridad de la cuenta», the same for the three portals: e-mail and phone
 * linked to the account and how to recover it. With ?required=1 (staff created
 * after the cut-off without a verified phone) there is no way out but linking
 * the phone or signing out.
 */
export function AccountSecurityPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { logout } = useAuth();
  const { security, loaded, notSupported, reload } = useAccountSecurity();
  const [linking, setLinking] = useState(false);
  const required = params.get("required") === "1" && !!security?.phoneRequired;

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/", { replace: true }));
  const verifiedBadge = <span className="flex items-center gap-1 rounded-full bg-[var(--color-success-100,#e5f4ec)] px-2 py-1 text-xs font-medium text-[var(--color-success-700)]"><CheckCircle2 size={13} aria-hidden />Verificado</span>;

  return (
    <div className="min-h-dvh flex items-start justify-center bg-[var(--color-navy-950)] px-[var(--spacing-md)] py-8 sm:items-center">
      <Card className="w-full max-w-[440px] flex flex-col gap-5" data-testid="account-security">
        <div className="text-center">
          <ShieldCheck size={38} aria-hidden className="mx-auto text-[var(--color-navy-700)]" />
          <h1 className="font-display text-[length:var(--text-h1)] leading-tight text-[var(--color-text-primary)] mt-3">
            {required ? "Vincula tu teléfono" : linking ? (security?.phoneVerified ? "Cambiar número" : "Vincular teléfono") : "Seguridad de la cuenta"}
          </h1>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-2">
            {required
              ? "Para proteger la información de los pacientes, tu cuenta necesita un teléfono verificado. Lo usarás para entrar y para recuperar tu contraseña."
              : "Tu correo y tu teléfono verificado te permiten entrar y recuperar tu cuenta si olvidas la contraseña."}
          </p>
        </div>

        {!loaded && <div className="mx-auto h-8 w-8 rounded-full border-2 border-[var(--color-navy-800)] border-t-transparent animate-spin" aria-label="Cargando" />}

        {loaded && !security && notSupported && (
          <p className="text-center text-[var(--text-small)] text-[var(--color-text-secondary)]" data-testid="phone-coming-soon">Muy pronto podrás vincular tu teléfono. Mientras tanto, recuperas tu cuenta por correo.</p>
        )}

        {loaded && !security && !notSupported && (
          <p role="alert" className="text-center text-[var(--text-small)] text-[var(--color-text-secondary)]">No pudimos cargar la seguridad de tu cuenta. Inténtalo más tarde.</p>
        )}

        {loaded && security && (linking || required) && security.phoneVerificationAvailable && (
          <PhoneLinkFlow changing={security.phoneVerified} onDone={() => { setLinking(false); void reload().then(() => { if (required) navigate("/", { replace: true }); }); }} />
        )}

        {loaded && security && !linking && !required && (
          <div className="flex flex-col gap-3">
            <Row icon={<Mail size={18} aria-hidden />} label="Correo" value={security.email ?? "Sin correo"} />
            <Row icon={<Phone size={18} aria-hidden />} label="Teléfono" value={security.phone ?? "Sin teléfono verificado"} badge={security.phoneVerified ? verifiedBadge : undefined} />
            {security.smsRecoveryPausedUntil && (
              <p className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)] text-[var(--color-text-secondary)]" data-testid="sms-paused">
                <Clock size={16} aria-hidden className="mt-0.5 shrink-0" />Cambiaste el número hace poco. Por seguridad, la recuperación por SMS vuelve a estar disponible el {pausedText(security.smsRecoveryPausedUntil)}; mientras tanto, usa tu correo.
              </p>
            )}
            {security.phoneVerificationAvailable ? (
              <Button size="lg" fullWidth variant={security.phoneVerified ? "secondary" : "primary"} onClick={() => setLinking(true)}>
                {security.phoneVerified ? "Cambiar número" : "Vincular teléfono"}
              </Button>
            ) : (
              <p className="text-center text-[var(--text-caption)] text-[var(--color-text-muted)]" data-testid="phone-coming-soon">Muy pronto podrás vincular tu teléfono. Mientras tanto, recuperas tu cuenta por correo.</p>
            )}
          </div>
        )}

        {required ? (
          <button type="button" onClick={() => void logout()} className="flex min-h-11 items-center justify-center gap-1.5 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">
            <LogOut size={16} aria-hidden />Cerrar sesión
          </button>
        ) : (
          <button type="button" onClick={() => (linking ? setLinking(false) : back())} className="flex min-h-11 items-center justify-center gap-1.5 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">
            <ArrowLeft size={16} aria-hidden />{linking ? "Cancelar" : "Volver"}
          </button>
        )}
      </Card>
    </div>
  );
}
