import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-strong)] active:scale-[0.98]",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-ivory-100)]",
  ghost:
    "bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-ivory-100)]",
  danger: "bg-[var(--color-danger-700)] text-white hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  // 44px+ objetivo táctil (WCAG 2.2 AA) incluso en el tamaño "md"
  md: "h-11 px-4 text-[var(--text-body)] gap-2",
  lg: "h-13 px-6 text-[var(--text-body-lg)] gap-2.5 min-h-[52px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, icon, fullWidth, className = "", children, disabled, ...rest },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium
          transition-all duration-[var(--duration-fast)] ease-[var(--ease-standard)]
          disabled:opacity-50 disabled:pointer-events-none
          ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? (
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string; // obligatorio -- accesibilidad, nunca un icon button mudo
  variant?: Variant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, variant = "ghost", className = "", ...rest }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center h-11 w-11 rounded-[var(--radius-md)]
        transition-colors duration-[var(--duration-fast)]
        ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  )
);
IconButton.displayName = "IconButton";
