import { useEffect, useState, type ReactNode } from "react";
import { severityStyle, type AdminSeverity } from "./severity";

/** Superficie base del portal. `surface` = panel blanco; `navy` = panel institucional invertido. */
export function AdminPanel({ tone = "surface", className = "", children }: { tone?: "surface" | "navy"; className?: string; children: ReactNode }) {
 const base = tone === "navy"
 ? "bg-[var(--color-navy-900)] text-[#DEE4EE] shadow-[var(--shadow-raised)]"
 : "border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";
 return <section className={`relative min-w-0 overflow-hidden rounded-[var(--radius-lg)] ${base} ${className}`}>{children}</section>;
}

export function AdminPanelHeader({ title, description, action, inverted = false }: { title: string; description?: string; action?: ReactNode; inverted?: boolean }) {
 return (
 <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-6 sm:pt-5">
 <div className="min-w-0">
 <h2 className={`font-display text-[1.15rem] leading-tight sm:text-[1.3rem] ${inverted ? "text-white" : "text-[var(--color-text-primary)]"}`}>{title}</h2>
 {description && <p className={`mt-1 text-sm ${inverted ? "text-white/65" : "text-[var(--color-text-secondary)]"}`}>{description}</p>}
 </div>
 {action}
 </header>
 );
}

export function SeverityBadge({ severity, children }: { severity: AdminSeverity; children?: ReactNode }) {
 const s = severityStyle[severity];
 return (
 <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.tint} ${s.text}`}>
 <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
 {children ?? s.label}
 </span>
 );
}

export function Meter({ value, max = 100, label, toneClass = "bg-[var(--color-success-700)]" }: { value: number; max?: number; label: string; toneClass?: string }) {
 const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
 return (
 <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-text-primary)]/[0.07]">
 <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${pct}%` }} />
 </div>
 );
}

/** Arco de preparación. Se dibuja una vez al cargar: el único momento de movimiento del dashboard. */
export function ReadinessRing({ value, caption, size = 164 }: { value: number | null; caption: string; size?: number }) {
 const stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r, arc = 0.78, dash = c * arc;
 const [shown, setShown] = useState(0);
 useEffect(() => { const t = requestAnimationFrame(() => setShown(value ?? 0)); return () => cancelAnimationFrame(t); }, [value]);
 return (
 <div className="relative shrink-0" style={{ width: size, height: size }}>
 <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" style={{ transform: `rotate(${90 + (360 * (1 - arc)) / 2}deg)` }} aria-hidden>
 <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
 <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sage-300)" strokeWidth={stroke} strokeDasharray={`${dash} ${c}`}
 strokeDashoffset={dash - dash * (shown / 100)} strokeLinecap="round" className="admin-ring" />
 </svg>
 <div className="absolute inset-0 grid place-items-center px-6 text-center">
 <div>
 <div className="font-display text-[2.6rem] leading-none text-white tabular-nums">{value === null ? "—" : value}<span className="text-2xl text-white/60">{value === null ? "" : "%"}</span></div>
 <div className="mt-1.5 text-xs leading-snug text-white/70">{caption}</div>
 </div>
 </div>
 </div>
 );
}

/** Wordmark ETNARA Care. El favicon no forma parte del logo institucional. */
export function AdminLogo({ inverted = false, compact = false }: { inverted?: boolean; compact?: boolean }) {
 return (
 <span className="inline-flex items-center gap-2.5">
 {!compact && (
 <span className="whitespace-nowrap leading-none">
 <span className={`font-display text-[1.3rem] font-semibold tracking-[0.04em] ${inverted ? "text-white" : "text-[var(--color-navy-900)]"}`}>ETNARA</span>
 <span className={`ml-1.5 font-display text-[1.3rem] italic ${inverted ? "text-[var(--color-sage-300)]" : "text-[var(--color-success-700)]"}`}>Care</span>
 </span>
 )}
 </span>
 );
}
