import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, FilePlus2, FileText, Receipt } from "lucide-react";
import { getToken } from "@/auth/token";
import { billingDraftsApi, type InvoiceSummary } from "@/api/billing";
import { Badge, Button, Card, Skeleton } from "@/components/ui";
import { day, langOf, money } from "./billingFormat";
import { NewInvoiceWizard } from "./NewInvoiceWizard";
import { DraftView } from "./DraftView";

type Chip = "drafts" | "inactive" | "discarded";

/**
 * Finanzas → Facturación → «Facturas» (F2.2). Drafts, inactive drafts (14 days
 * without changes: only marked) and discarded drafts. «Nueva factura» only for
 * billing.draft; reading needs billing.view or billing.draft (backend + RLS).
 */
export function InvoicesSection({ organizationId, canDraft, canManageTax, readOnly }: { organizationId: string; canDraft: boolean; canManageTax: boolean; readOnly: boolean }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  const [rows, setRows] = useState<InvoiceSummary[] | null>(null);
  const [days, setDays] = useState(14);
  const [chip, setChip] = useState<Chip>("drafts");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { const r = await billingDraftsApi.list(organizationId, token); setRows(r.invoices); setDays(r.inactiveDays); setFailed(false); } catch { setFailed(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  const counts = {
    drafts: rows?.filter((r) => r.status === "draft" && !r.inactive).length ?? 0,
    inactive: rows?.filter((r) => r.inactive).length ?? 0,
    discarded: rows?.filter((r) => r.status === "discarded").length ?? 0,
  };
  const shown = (rows ?? []).filter((r) => (chip === "drafts" ? r.status === "draft" && !r.inactive : chip === "inactive" ? r.inactive : r.status === "discarded"));

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="billing-invoices-title" data-billing-invoices>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 id="billing-invoices-title" className="flex items-center gap-2 font-display text-lg"><Receipt size={18} aria-hidden />{t("invoices.title")}</h2>
        {canDraft && !readOnly && <Button size="sm" icon={<FilePlus2 size={16} />} onClick={() => setCreating(true)} data-billing-new>{t("invoices.new")}</Button>}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" className="inline-flex gap-1 rounded-[var(--radius-pill)] bg-[var(--color-ivory-100)] p-1">
          {(["drafts", "inactive", "discarded"] as Chip[]).map((c) => (
            <button key={c} type="button" role="tab" aria-selected={chip === c} onClick={() => setChip(c)} data-chip={c}
              className={`h-9 shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] px-3.5 text-sm font-medium ${chip === c ? "bg-[var(--color-navy-900)] text-white" : "text-[var(--color-text-secondary)]"}`}>
              {t(`invoices.chips.${c}`)} <span className="tabular-nums opacity-80">{counts[c]}</span>
            </button>
          ))}
        </div>
      </div>

      {failed ? <Card><p className="text-sm text-[var(--color-text-secondary)]">{t("loadFailed")}</p><Button size="sm" variant="secondary" className="mt-2" onClick={() => void load()}>{t("retry")}</Button></Card>
        : !rows ? <Skeleton className="h-24" />
        : shown.length === 0 ? (
          <Card className="flex items-start gap-3" data-billing-empty>
            <FileText size={18} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
            <div className="min-w-0"><p className="font-medium">{t("invoices.empty")}</p>{canDraft && <p className="text-sm text-[var(--color-text-secondary)]">{t("invoices.emptyHint")}</p>}</div>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 [&>li]:min-w-0">
            {shown.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setOpen(r.id)} data-invoice-card={r.id}
                  className="w-full min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-card)] transition hover:border-[var(--color-navy-700)]">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 break-words font-medium leading-snug">{r.clientName}</p>
                    <span className="shrink-0 font-semibold tabular-nums">{money(r.subtotalCents, lang)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{t("invoices.period", { from: day(r.periodFrom, lang), to: day(r.periodTo, lang) })} · {t("invoices.lines", { count: r.lineCount })}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={r.status === "draft" ? "neutral" : "warning"}>{t(`invoices.status.${r.status}`)}</Badge>
                    {r.inactive && <Badge tone="warning"><Clock size={12} className="mr-1 inline" aria-hidden />{t("invoices.inactiveBadge")}</Badge>}
                    {r.taxPending && <Badge tone="warning">{t("blockers.TAX_PENDING")}</Badge>}
                  </div>
                  {r.inactive && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t("invoices.inactiveHelp", { days })}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}

      {creating && <NewInvoiceWizard organizationId={organizationId} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); void load(); setOpen(id); }} />}
      {open && <DraftView organizationId={organizationId} invoiceId={open} canManageTax={canManageTax} onClose={() => { setOpen(null); void load(); }} />}
    </section>
  );
}
