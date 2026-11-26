/**
 * CSV seguro (revisión GPT de F0.1, 25-nov-2026). Una celda de texto que empieza por «=», «+», «-», «@»
 * (aunque vaya precedida de espacios), por un tabulador o por un retorno se antepone con «'»: así Excel, Numbers
 * o Google Sheets la muestran como texto y nunca la ejecutan como fórmula (inyección CSV mediante el nombre de una
 * persona). Los números («-5.00», «64.00») no se tocan. Toda celda va entre comillas, con las comillas duplicadas.
 */
const FORMULA_START = /^\s*[=+\-@]|^[\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvLines(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
