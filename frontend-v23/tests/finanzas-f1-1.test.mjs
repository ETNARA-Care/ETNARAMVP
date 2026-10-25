import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("a scheduled price change can be cancelled (only while «Programada»), with a required reason", () => {
  const detail = read("src/features/finance/ServiceDetail.tsx");
  assert.match(detail, /\{r\.status === "future" && <Button size="sm" variant="ghost" icon=\{<CalendarX2 size=\{16\} \/>\} onClick=\{\(\) => onCancel\(r\)\}>Cancelar cambio<\/Button>\}/);
  assert.match(detail, /disabled=\{reason\.trim\(\)\.length < 3\} onClick=\{\(\) => void save\(\)\}>Cancelar este cambio<\/Button>/);
  assert.match(detail, /const live = \(r: FinanceRate\) => r\.status !== "past" && r\.status !== "cancelled";/);
  assert.match(detail, /if \(status === "cancelled"\) return <Badge tone="warning">Cancelada<\/Badge>;/);
  assert.match(detail, /Cancelada: \$\{r\.cancel_reason\}/);
  assert.match(read("src/api/finance.ts"), /\$\{F\(org\)\}\/rates\/\$\{rateId\}\/cancel`, \{ reason \}/);
});

test("a holiday is deactivated with a reason, never deleted, and can be reactivated", () => {
  const tab = read("src/features/finance/HolidaysTab.tsx");
  assert.match(tab, />Desactivar<\/Button>/);
  assert.match(tab, /financeApi\.deactivateHoliday\(organizationId, holiday\.date, reason\.trim\(\), token\)/);
  assert.match(tab, /disabled=\{reason\.trim\(\)\.length < 3\}/);
  assert.match(tab, /Desactivados \(\{inactive\.length\}\)/);
  assert.match(tab, />Reactivar<\/Button>/);
  assert.doesNotMatch(tab, /deleteHoliday|apiClient\.delete|>Eliminar<|>Borrar</);
  assert.doesNotMatch(read("src/api/finance.ts"), /\.delete\(/);
  assert.match(tab, /se mantiene en feriado, salvo que ese cliente o cuidador tenga su propia tarifa de feriado/);
});

test("negative gross margin: visible warning in simulator, services and shifts; confirmation on save, never a block", () => {
  const notice = read("src/features/finance/NegativeMarginNotice.tsx");
  assert.match(notice, /<strong>Margen negativo:<\/strong> cobras \{formatCents\(billCents\)\} y pagas \{formatCents\(payCents\)\}/);
  assert.match(notice, /role="status"/);
  assert.match(notice, /<AlertTriangle/); // icon + text, not colour alone
  const detail = read("src/features/finance/ServiceDetail.tsx");
  assert.match(detail, /<NegativeMarginNotice tone="dark"/); // simulator
  assert.match(detail, /if \(negative && !confirmedNegative\) \{ setConfirmingNegative\(true\); return; \}/);
  assert.match(detail, /title="¿Guardar con margen negativo\?"/);
  assert.match(detail, /onClick=\{\(\) => void save\(true\)\}>Guardar igualmente<\/Button>/);
  assert.match(detail, />Revisar<\/Button>/);
  assert.match(read("src/features/finance/ServicesTab.tsx"), /\{isNegativeMargin\(s\.margin\) && <span data-negative-margin-badge><Badge tone="warning">Margen negativo<\/Badge><\/span>\}/);
  assert.match(read("src/features/finance/ShiftFinancePanel.tsx"), /<NegativeMarginNotice billCents=\{r\.estimate\.billing\.amountCents\} payCents=\{r\.estimate\.pay\.amountCents\} per="en este turno" \/>/);
  const money = read("src/features/finance/money.ts");
  assert.match(money, /return margin\.negative \?\? margin\.differenceCents < 0;/);
  for (const f of ["src/features/finance/NegativeMarginNotice.tsx", "src/features/finance/ServiceDetail.tsx"]) {
    assert.doesNotMatch(read(f), /[Gg]anancia(?! neta)/, f);
  }
});

test("new backend codes have plain-Spanish messages", () => {
  const money = read("src/features/finance/money.ts");
  for (const code of ["FINANCE_RATE_CANCELLED", "FINANCE_RATE_ALREADY_IN_FORCE", "FINANCE_HOLIDAY_NOT_FOUND", "FINANCE_HOLIDAY_ALREADY_INACTIVE", "INVALID_DATE"]) {
    assert.match(money, new RegExp(`${code}: "`), code);
  }
});

test("the #231 simulator fix stays as it was", () => {
  const detail = read("src/features/finance/ServiceDetail.tsx");
  assert.match(detail, /<div className="grid grid-cols-2 gap-3 \[&_label\]:text-white\/80 \[&>\*\]:min-w-0">/);
  assert.match(detail, /<Input label="Fecha del servicio" type="date" className="min-w-0 appearance-none"/);
});
