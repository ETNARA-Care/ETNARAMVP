import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { isResidentialOrganization } from "@/features/residential/modality";

/** F6 (hogares): acceso a la guía de uso de este portal. En agencias e independientes no aparece. */
export function GuideLink({ to, className = "" }: { to: string; className?: string }) {
  const { activeOrganization } = useAuth();
  const { t } = useTranslation("residential");
  if (!isResidentialOrganization(activeOrganization)) return null;
  return (
    <Link to={to} data-testid="guide-link" className={`inline-flex items-center gap-2 text-sm font-medium text-[#486d48] underline underline-offset-2 ${className}`}>
      <BookOpen size={16} aria-hidden />{t("guides.open")}
    </Link>
  );
}
