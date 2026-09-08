import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const fieldBase =
  "w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3.5 h-11 text-[var(--text-body)] " +
  "text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-muted)] " +
  "disabled:opacity-50 disabled:bg-[var(--color-ivory-100)]";

function fieldBorder(error?: boolean) {
  return error
    ? "border-[var(--color-danger-700)] focus:border-[var(--color-danger-700)]"
    : "border-[var(--color-border)] focus:border-[var(--color-navy-700)]";
}

interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
}

function FieldWrapper({ label, error, hint, required, htmlFor, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[var(--text-small)] font-medium text-[var(--color-text-primary)]">
        {label} {required && <span aria-hidden className="text-[var(--color-danger-700)]">*</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[var(--text-caption)] text-[var(--color-danger-700)]">{error}</p>
      ) : hint ? (
        <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, required, className = "", ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-err` : undefined}
          className={`${fieldBase} ${fieldBorder(!!error)} ${className}`}
          {...rest}
        />
      </FieldWrapper>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, required, className = "", ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
        <textarea
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={!!error}
          rows={4}
          className={`${fieldBase} h-auto py-2.5 resize-y ${fieldBorder(!!error)} ${className}`}
          {...rest}
        />
      </FieldWrapper>
    );
  }
);
Textarea.displayName = "Textarea";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, id, required, className = "", children, ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
        <select
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={!!error}
          className={`${fieldBase} ${fieldBorder(!!error)} ${className}`}
          {...rest}
        >
          {children}
        </select>
      </FieldWrapper>
    );
  }
);
Select.displayName = "Select";

export function Checkbox({ label, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label htmlFor={fieldId} className="flex items-center gap-2.5 text-[var(--text-body)] cursor-pointer select-none">
      <input
        type="checkbox"
        id={fieldId}
        className="h-5 w-5 rounded-[4px] border-[var(--color-border)] accent-[var(--color-navy-800)]"
        {...rest}
      />
      {label}
    </label>
  );
}

export function Radio({ label, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label htmlFor={fieldId} className="flex items-center gap-2.5 text-[var(--text-body)] cursor-pointer select-none">
      <input
        type="radio"
        id={fieldId}
        className="h-5 w-5 border-[var(--color-border)] accent-[var(--color-navy-800)]"
        {...rest}
      />
      {label}
    </label>
  );
}
