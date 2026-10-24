import { useId } from "react";
import { formatPhone, phoneDigits } from "./phoneFormat";

const field = "h-13 min-h-[52px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[length:1.125rem] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-navy-700)] focus:ring-2 focus:ring-[var(--color-navy-700)]/15";

/** +1 is fixed (Puerto Rico and the US); the phone's keypad opens; autofill offers the user's own number. */
export function PhoneInput({ label, value, onChange, disabled, autoFocus }: {
  label: string; value: string; onChange: (digits: string) => void; disabled?: boolean; autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[var(--text-small)] font-medium text-[var(--color-text-primary)]">{label}</label>
      <div className="flex items-stretch gap-2">
        <span className="flex min-w-[64px] items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-ivory-100)] px-3 text-[length:1.125rem] font-medium text-[var(--color-text-secondary)]" aria-hidden>+1</span>
        <input
          id={id}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(787) 555-1234"
          disabled={disabled}
          autoFocus={autoFocus}
          className={field}
          value={formatPhone(value)}
          onChange={(event) => onChange(phoneDigits(event.target.value))}
          aria-describedby={`${id}-hint`}
        />
      </div>
      <p id={`${id}-hint`} className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Puerto Rico o Estados Unidos.</p>
    </div>
  );
}

/** One field, 6 digits: iPhone offers the code from Messages; Android fills it from the SMS. */
export function CodeInput({ value, onChange, disabled, autoFocus }: {
  value: string; onChange: (code: string) => void; disabled?: boolean; autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[var(--text-small)] font-medium text-[var(--color-text-primary)]">Código de 6 dígitos</label>
      <input
        id={id}
        name="one-time-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`${field} text-center font-medium tracking-[0.5em] text-[length:1.5rem]`}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
      />
    </div>
  );
}

