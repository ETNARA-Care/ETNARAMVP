import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui";
import type { ApiError } from "@/api/client";
import { requestSmsReset, verifySmsReset } from "@/api/accountSecurity";
import { CodeInput, PhoneInput } from "./PhoneFields";
import { formatPhone, isValidNanp } from "./phoneFormat";
import { useCountdown } from "./useCountdown";

/**
 * Recovery by SMS on «¿Olvidaste tu contraseña?». The code only goes to a number
 * already VERIFIED on an account; the screen answers the same whether the number
 * has an account or not («si ese número…»). A right code gives a 10-minute token
 * that travels to /reset-password in navigation state, never in the address bar.
 */
export function SmsRecovery({ onUseEmail }: { onUseEmail: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [resendIn, startResend] = useCountdown(60);

  function message(error: unknown): string {
    const e = error as ApiError;
    if (e?.status === 0) return "No pudimos conectar con ETNARA. Verifica tu conexión.";
    if (e?.status === 429) return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
    if (e?.code === "PHONE_INVALID" || e?.status === 400 && step === "phone") return "Escribe un número válido de Puerto Rico o Estados Unidos.";
    if (e?.code === "FEATURE_NOT_ENABLED") return "La recuperación por SMS no está disponible ahora. Usa tu correo.";
    return "Código incorrecto o vencido. Revisa el mensaje o pide uno nuevo.";
  }

  async function send() {
    setBusy(true); setProblem(null);
    try {
      await requestSmsReset(`+1${digits}`);
      setCode(""); setStep("code"); startResend();
    } catch (error) {
      const e = error as ApiError;
      // Anything that says nothing about the account is shown; the rest gets the same neutral screen.
      if (e?.status === 0 || e?.status === 429 || e?.status === 400 || e?.code === "FEATURE_NOT_ENABLED") setProblem(message(error));
      else { setCode(""); setStep("code"); startResend(); }
    } finally { setBusy(false); }
  }

  async function submitPhone(event: FormEvent) {
    event.preventDefault();
    if (!isValidNanp(digits)) { setProblem("Escribe un número válido de Puerto Rico o Estados Unidos."); return; }
    await send();
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true); setProblem(null);
    try {
      const { resetToken } = await verifySmsReset(`+1${digits}`, code);
      setCode("");
      navigate("/reset-password", { replace: true, state: { resetToken } });
    } catch (error) {
      setProblem(message(error));
      setCode("");
    } finally { setBusy(false); }
  }

  if (step === "code") {
    return (
      <form className="flex flex-col gap-4" onSubmit={submitCode} data-testid="sms-code">
        <p className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)] text-[var(--color-text-secondary)]">
          Si <strong className="text-[var(--color-text-primary)]">+1 {formatPhone(digits)}</strong> está verificado en una cuenta de ETNARA Care, te enviamos un código por SMS. Vence en 10 minutos.
        </p>
        <CodeInput value={code} onChange={setCode} disabled={busy} autoFocus />
        {problem && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{problem}</p>}
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={code.length !== 6}>Continuar</Button>
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="min-h-11 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]" onClick={() => { setStep("phone"); setProblem(null); }}>Cambiar número</button>
          <button type="button" disabled={resendIn > 0 || busy} className="min-h-11 text-[var(--text-small)] font-medium text-[var(--color-navy-700)] disabled:text-[var(--color-text-muted)]" onClick={() => void send()}>
            {resendIn > 0 ? `Reenviar en ${resendIn} s` : "Reenviar código"}
          </button>
        </div>
        <button type="button" className="min-h-11 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]" onClick={onUseEmail}>¿No llega? Usa tu correo</button>
      </form>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submitPhone} data-testid="sms-phone">
      <PhoneInput label="Número de teléfono verificado" value={digits} onChange={setDigits} disabled={busy} autoFocus />
      {problem && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{problem}</p>}
      <Button type="submit" size="lg" fullWidth loading={busy} disabled={digits.length !== 10}>Enviar código</Button>
      <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Solo funciona con el número que ya verificaste en tu cuenta. Si lo cambiaste hace menos de 72 horas, usa tu correo.</p>
    </form>
  );
}
