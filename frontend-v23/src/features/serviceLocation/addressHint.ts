import { PUERTO_RICO_MUNICIPALITIES } from "@/features/smartmatch/municipalities";

export interface AddressHint { addressLine: string; municipality: string; postalCode: string }

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Longest names first so «San Juan» never hides «San Germán» and «Juana Díaz» wins over «Juana».
const BY_LENGTH = [...PUERTO_RICO_MUNICIPALITIES].sort((a, b) => b.length - a.length);

/**
 * Splits a written address («Calle Luna 12, Urb. Las Flores, Caguas, PR 00725») into the
 * three fields of the form. Local only: nothing is looked up anywhere and no coordinates
 * are produced. Whatever is not recognised stays in the address line for a person to review.
 */
export function addressFromText(raw: string): AddressHint {
  let text = raw.replace(/\s+/g, " ").trim();
  const zip = text.match(/\b(00[6-9]\d{2})(?:-\d{4})?\b/);
  const postalCode = zip ? zip[0] : "";
  if (zip) text = text.replace(zip[0], " ");
  text = text.replace(/,?\s*(?:Puerto Rico|\bPR\b|\bUSA?\b|Estados Unidos)\s*,?/gi, ", ");

  let municipality = "";
  const folded = fold(text);
  for (const m of BY_LENGTH) {
    const re = new RegExp(`(^|[\\s,])${fold(m).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[\\s,.])`);
    const hit = folded.match(re);
    if (!hit) continue;
    municipality = m;
    // Keep what comes before the town as the street line; the town itself goes to its own field.
    const at = (hit.index ?? 0) + hit[1].length;
    const before = text.slice(0, at).trim();
    const after = text.slice(at + m.length).trim();
    text = before ? before : after;
    break;
  }
  const addressLine = text.replace(/[\s,]+$/g, "").replace(/^[\s,]+/g, "").replace(/\s*,\s*,+/g, ",").slice(0, 200);
  return { addressLine, municipality, postalCode };
}
