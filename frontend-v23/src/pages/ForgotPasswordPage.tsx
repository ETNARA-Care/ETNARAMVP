import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MailCheck, KeyRound, Mail, MessageSquareText } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { requestPasswordReset } from "@/api/auth";
import type { ApiError } from "@/api/client";
import { getRecoveryOptions } from "@/api/accountSecurity";
import { SmsRecovery } from "@/features/accountSecurity/SmsRecovery";

/**
 * «¿Olvidaste tu contraseña?» — por correo. Pase lo que pase (cuenta
 * existente o no, cuenta desactivada, fallo del proveedor de correo) la
 * pantalla muestra el MISMO mensaje: nunca revela si un correo tiene cuenta.
 * Solo se distinguen los casos que no dicen nada de la cuenta: sin conexión
 * y demasiados intentos.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // SMS is offered only when the server says it is on; otherwise the page is exactly the e-mail one.
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [method, setMethod] = useState<"email" | "sms">("email");
  useEffect(() => {
    let alive = true;
    getRecoveryOptions().then((o) => { if (alive) setSmsAvailable(o.sms === true); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setProblem(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (caught) {
      const apiError = caught as ApiError;
      if (apiError.status === 0) setProblem("No pudimos conectar con ETNARA. Verifica tu conexión.");
      else if (apiError.status === 429) setProblem("Demasiados intentos. Espera unos minutos y vuelve a intentarlo.");
      else if (apiError.status === 400) setProblem("Escribe un correo electrónico válido.");
      else setSent(true); // any other answer: same neutral message
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--color-navy-950)] px-[var(--spacing-md)] py-8">
      <Card className="w-full max-w-[420px] flex flex-col gap-5">
        <div className="text-center">
          {sent
            ? <MailCheck size={40} aria-hidden className="mx-auto text-[var(--color-success-700)]" />
            : <KeyRound size={38} aria-hidden className="mx-auto text-[var(--color-navy-700)]" />}
          <h1 className="font-display text-[length:var(--text-h1)] leading-tight text-[var(--color-text-primary)] mt-3">
            {sent ? "Revisa tu correo" : "Recupera tu contraseña"}
          </h1>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-2">
            {sent
              ? "Si ese correo está registrado en ETNARA Care, te enviamos un enlace para crear una contraseña nueva. Vence en 30 minutos y solo se puede usar una vez."
              : method === "sms"
                ? "Escribe tu número verificado. Te enviaremos un código por SMS para crear una contraseña nueva."
                : "Escribe el correo con el que entras a ETNARA Care. Te enviaremos un enlace para crear una contraseña nueva."}
          </p>
        </div>

        {!sent && smsAvailable && (
          <div role="radiogroup" aria-label="Cómo quieres recuperar tu contraseña" className="grid grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-1" data-testid="recovery-method">
            {([["email", "Correo", Mail], ["sms", "SMS", MessageSquareText]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={method === value} onClick={() => { setMethod(value); setProblem(null); }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-[10px] text-[var(--text-small)] font-medium ${method === value ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-raised)]" : "text-[var(--color-text-secondary)]"}`}>
                <Icon size={16} aria-hidden />{label}
              </button>
            ))}
          </div>
        )}

        {!sent && method === "sms" ? (
          <>
            <SmsRecovery onUseEmail={() => setMethod("email")} />
            <Link to="/login" className="flex min-h-11 items-center justify-center gap-1.5 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">
              <ArrowLeft size={16} aria-hidden />Volver a iniciar sesión
            </Link>
          </>
        ) : sent ? (
          <div className="flex flex-col gap-3" data-testid="forgot-sent">
            <p className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--text-caption)] text-[var(--color-text-secondary)]">
              ¿No llega? Revisa la carpeta de correo no deseado. Puedes pedir otro enlace en unos minutos; el anterior dejará de funcionar.
            </p>
            <Link to="/login" className="block"><Button fullWidth size="lg">Volver a iniciar sesión</Button></Link>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submit} noValidate={false}>
            <Input
              label="Correo electrónico"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {problem && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{problem}</p>}
            <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!email.trim()}>Enviar enlace</Button>
            <Link to="/login" className="flex min-h-11 items-center justify-center gap-1.5 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">
              <ArrowLeft size={16} aria-hidden />Volver a iniciar sesión
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
}
