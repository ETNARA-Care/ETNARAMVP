import { useState, type FormEvent } from "react";
import { CheckCircle2, Lock, MessageSquareText } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import { confirmPhoneVerification, reauthenticate, startPhoneVerification } from "@/api/accountSecurity";
import { CodeInput, PhoneInput } from "./PhoneFields";
import { formatPhone, isValidNanp } from "./phoneFormat";
import { useCountdown } from "./useCountdown";
import { linkErrorMessage } from "./linkErrorMessage";

type Step = "phone" | "password" | "code" | "done";

/**
 * Link or change the phone: number → (password again if more than 10 min since
 * the last one) → SMS code to THAT number → verified. The number is never shown
 * back in full by the server; this screen only repeats what the person typed.
 */
export function PhoneLinkFlow({ changing, onDone }: { changing: boolean; onDone: (result: { phone: string; changed: boolean }) => void }) {
  const [step, setStep] = useState<Step>("phone");
  const [digits, setDigits] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [resendIn, startResend] = useCountdown(60);
  const [result, setResult] = useState<{ phone: string; changed: boolean } | null>(null);

  async function send() {
    const token = getToken();
    if (!token) return;
    setBusy(true); setProblem(null);
    try {
      await startPhoneVerification(`+1${digits}`, token);
      setCode(""); setStep("code"); startResend();
    } catch (error) {
      if ((error as ApiError)?.code === "REAUTHENTICATION_REQUIRED") { setStep("password"); return; }
      setProblem(linkErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function submitPhone(event: FormEvent) {
    event.preventDefault();
    if (!isValidNanp(digits)) { setProblem("Escribe un número válido de Puerto Rico o Estados Unidos."); return; }
    await send();
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token || !password) return;
    setBusy(true); setProblem(null);
    try {
      await reauthenticate(password, token);
      setPassword("");
    } catch (error) {
      setProblem(linkErrorMessage(error));
      setBusy(false);
      return;
    }
    setBusy(false);
    await send();
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token || code.length !== 6) return;
    setBusy(true); setProblem(null);
    try {
      const done = await confirmPhoneVerification(code, token);
      const r = { phone: done.phone, changed: done.changed };
      setResult(r); setStep("done");
    } catch (error) {
      setProblem(linkErrorMessage(error));
      setCode("");
    } finally { setBusy(false); }
  }

  if (step === "done" && result) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" data-testid="phone-linked">
        <CheckCircle2 size={40} aria-hidden className="text-[var(--color-success-700)]" />
        <p className="font-medium text-[var(--color-text-primary)]">Teléfono verificado</p>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
          {result.changed ? "Ahora tu cuenta usa el número " : "Tu cuenta usa el número "}
          <strong className="whitespace-nowrap text-[var(--color-text-primary)]">{result.phone}</strong>
          {result.changed
            ? ". Te avisamos por correo. Por seguridad, la recuperación por SMS estará disponible en 72 horas."
            : ". Ya puedes entrar con él y recuperar tu contraseña por SMS."}
        </p>
        <Button size="lg" fullWidth onClick={() => onDone(result)}>Continuar</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {step === "phone" && (
        <form className="flex flex-col gap-4" onSubmit={submitPhone}>
          <PhoneInput label={changing ? "Número nuevo" : "Tu número de teléfono"} value={digits} onChange={setDigits} disabled={busy} autoFocus />
          {problem && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{problem}</p>}
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={digits.length !== 10} icon={<MessageSquareText size={18} />}>Enviar código</Button>
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Te enviaremos un SMS con un código. Pueden aplicar cargos de mensajes de tu compañía.</p>
        </form>
      )}

      {step === "password" && (
        <form className="flex flex-col gap-4" onSubmit={submitPassword} data-testid="phone-reauth">
          <p className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)] text-[var(--color-text-secondary)]">
            <Lock size={16} aria-hidden className="mt-0.5 shrink-0" />Por seguridad, confirma tu contraseña antes de {changing ? "cambiar" : "vincular"} el teléfono.
          </p>
          <Input label="Contraseña actual" type="password" name="current-password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {problem && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{problem}</p>}
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={!password}>Confirmar</Button>
          <button type="button" className="min-h-11 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]" onClick={() => { setStep("phone"); setProblem(null); }}>Volver</button>
        </form>
      )}

      {step === "code" && (
        <form className="flex flex-col gap-4" onSubmit={submitCode} data-testid="phone-code">
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Escribe el código que enviamos a <strong className="text-[var(--color-text-primary)]">+1 {formatPhone(digits)}</strong>. Vence en 10 minutos.</p>
          <CodeInput value={code} onChange={setCode} disabled={busy} autoFocus />
          {problem && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{problem}</p>}
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={code.length !== 6}>Verificar</Button>
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="min-h-11 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]" onClick={() => { setStep("phone"); setProblem(null); }}>Cambiar número</button>
            <button type="button" disabled={resendIn > 0 || busy} className="min-h-11 text-[var(--text-small)] font-medium text-[var(--color-navy-700)] disabled:text-[var(--color-text-muted)]" onClick={() => void send()}>
              {resendIn > 0 ? `Reenviar en ${resendIn} s` : "Reenviar código"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
