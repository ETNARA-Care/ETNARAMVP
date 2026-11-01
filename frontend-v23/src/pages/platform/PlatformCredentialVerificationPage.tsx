import { ArrowLeft, FileCheck2, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";

/**
 * ETNARA Verified (voluntario) — vista de ETNARA Central.
 *
 * Desde el 1-nov-2026 ETNARA Central no tiene acceso permanente a los documentos institucionales de
 * las agencias (backend #247, migración 140). Esta pantalla ya no es una cola de revisión: no lista,
 * no abre y no revisa documentos, y no llama a ningún endpoint de documentos.
 * El acceso temporal autorizado por la agencia (24 h, ampliable hasta 48 h) llegará en otro PR.
 */
export function PlatformCredentialVerificationPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-[var(--spacing-md)]">
      <div className="rounded-2xl bg-[var(--color-navy-900)] p-5 text-white sm:p-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">ETNARA · Centro Administrativo</p>
        <h1 className="font-display text-3xl">ETNARA Verified</h1>
        <p className="mt-2 text-sm text-white/80">Programa voluntario de verificación de documentos institucionales. Los expedientes de empleados y residentes permanecen privados dentro de cada organización.</p>
      </div>

      <PageHeader
        title="Verificación voluntaria"
        description="Solo documentos institucionales que una agencia autorice expresamente."
        actions={<Button variant="secondary" icon={<ArrowLeft size={17} />} onClick={() => navigate("/platform")}>Resumen</Button>}
      />

      <Card>
        <EmptyState
          icon={<FileCheck2 size={30} />}
          title="No hay verificaciones autorizadas"
          description="Cuando una agencia autorice la verificación de documentos concretos, aparecerán aquí durante el tiempo autorizado."
        />
      </Card>

      <Card className="flex items-start gap-3">
        <Lock size={20} className="mt-0.5 shrink-0" aria-hidden />
        <div className="space-y-2 text-[var(--text-small)] text-[var(--color-text-secondary)]">
          <p className="font-medium text-[var(--color-text-primary)]">ETNARA no tiene acceso permanente a los documentos de las agencias.</p>
          <p>Cada agencia carga y administra sus licencias, permisos y seguros. ETNARA solo podrá consultar los documentos que la agencia seleccione, por tiempo limitado y con su autorización expresa. La agencia puede revocarla en cualquier momento.</p>
          <p>ETNARA Verified no es una certificación gubernamental ni una garantía de la calidad del cuidado.</p>
        </div>
      </Card>
    </div>
  );
}
