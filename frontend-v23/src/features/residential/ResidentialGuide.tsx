import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Printer } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui";
import { isResidentialOrganization } from "@/features/residential/modality";

/**
 * F6 (hogares): guía breve de uso, una por portal (administración, cuidador, familia). Solo hogares. Imprimible en una
 * página: al imprimir solo sale la guía. Textos completos en español e inglés (catálogo «residential», guides.*).
 * Describe solo lo que existe; lo que depende de un módulo lo dice («si tu hogar lo tiene activo»).
 */
export type GuideAudience = "admin" | "caregiver" | "family";
const fallback: Record<GuideAudience, string> = { admin: "/agency", caregiver: "/caregiver/today", family: "/family/today" };

export function ResidentialGuide({ audience }: { audience: GuideAudience }) {
  const { activeOrganization } = useAuth();
  const { t } = useTranslation("residential");
  const residential = isResidentialOrganization(activeOrganization);
  useEffect(() => {
    document.body.classList.add("etnara-print-guide");
    return () => document.body.classList.remove("etnara-print-guide");
  }, []);
  if (!residential) return <Navigate to={fallback[audience]} replace />;
  // Las secciones vienen del catálogo como lista: título y pasos.
  const sections = t(`guides.${audience}.sections`, { returnObjects: true }) as unknown as Array<{ title: string; steps: string[] }>;
  return (
    <article data-print-guide data-testid={`guide-${audience}`} className="mx-auto flex w-full max-w-[46rem] flex-col gap-4 rounded-[var(--radius-md)] bg-white p-5 text-[#173154] print:text-black">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#486d48] print:text-black">{t("guides.brand", { name: activeOrganization?.name ?? "" })}</p>
          <h1 className="font-display text-[1.75rem] leading-tight text-[#102b57] print:text-black">{t(`guides.${audience}.title`)}</h1>
          <p className="mt-1 text-sm text-[#475467] print:text-black">{t(`guides.${audience}.intro`)}</p>
        </div>
        <div className="print:hidden"><Button icon={<Printer size={16} aria-hidden />} onClick={() => window.print()}>{t("guides.print")}</Button></div>
      </header>
      <ol className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        {Array.isArray(sections) && sections.map((s, i) => (
          <li key={s.title} className="rounded-[var(--radius-md)] border border-[#102b57]/12 p-3 break-inside-avoid">
            <h2 className="text-[0.95rem] font-semibold">{`${i + 1}. ${s.title}`}</h2>
            <ul className="mt-1 list-disc pl-5 text-sm leading-6">{s.steps.map((step) => <li key={step}>{step}</li>)}</ul>
          </li>
        ))}
      </ol>
      <footer className="border-t border-[#102b57]/12 pt-3 text-xs leading-5 text-[#475467] print:text-black">
        <p>{t(`guides.${audience}.privacy`)}</p>
        <p className="mt-1">{t("guides.footer")}</p>
      </footer>
    </article>
  );
}
