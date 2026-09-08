import { Link } from "react-router-dom";
import { HeartHandshake, HandHeart, Building2 } from "lucide-react";
import { Card } from "@/components/ui";

const EXPERIENCES = [
  {
    to: "/family/today",
    icon: <HeartHandshake size={26} />,
    title: "App Familiar",
    description: "Tranquilidad y transparencia sobre el cuidado de un ser querido.",
  },
  {
    to: "/caregiver/shifts",
    icon: <HandHeart size={26} />,
    title: "App Cuidador",
    description: "Turnos, registro de cuidados y observaciones, pensado para una mano.",
  },
  {
    to: "/agency",
    icon: <Building2 size={26} />,
    title: "Portal Agencia",
    description: "Cobertura de turnos, cumplimiento e incidentes en un solo lugar.",
  },
];

/**
 * Landing interna de solo-desarrollo -- no es parte del producto final.
 * Sirve para inspeccionar rápidamente las tres experiencias de frontend-v2
 * mientras se revisa el diseño (Fase 2). Se retira antes de producción.
 */
export function DemoLandingPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-[var(--spacing-md)] py-[var(--spacing-xl)]">
      <div className="w-full max-w-[880px] flex flex-col gap-8 items-center text-center">
        <div>
          <p className="text-[var(--text-caption)] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-700)]">
            frontend-v2 · vista interna de desarrollo
          </p>
          <h1 className="font-display text-[var(--text-display)] text-[var(--color-text-primary)] mt-2">ETNARA Care</h1>
          <p className="text-[var(--text-body-lg)] text-[var(--color-text-secondary)] mt-2 max-w-[52ch] mx-auto">
            Elige una experiencia para revisar el nuevo diseño. Ninguna está conectada al backend todavía.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 w-full">
          {EXPERIENCES.map((exp) => (
            <Link key={exp.to} to={exp.to} className="text-left">
              <Card className="h-full flex flex-col gap-3 hover:shadow-[var(--shadow-raised)] transition-shadow">
                <span className="text-[var(--color-navy-800)]" aria-hidden>{exp.icon}</span>
                <span className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{exp.title}</span>
                <span className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{exp.description}</span>
              </Card>
            </Link>
          ))}
        </div>
        <Link to="/login" className="text-[var(--text-small)] text-[var(--color-text-secondary)] hover:underline">
          Ver pantalla de login →
        </Link>
      </div>
    </div>
  );
}
