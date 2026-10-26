import type { ReactNode } from "react";

/**
 * Report status for cards on small screens: normal case, wraps to a second line when it
 * must, never squeezes the resident's name. ETNARA tones (navy / cream / sage).
 * Module-local on purpose: the shared Badge used elsewhere is not changed.
 */
type Tone = "neutral" | "success" | "warning" | "accent" | "danger";
const TONE: Record<Tone, string> = {
  // Fixed brand values: the portals' themes don't all define the sage/ivory tokens.
  neutral: "bg-[#F5F1E8] text-[#4A5568] border-[#E5DFD3]",
  success: "bg-[#E4ECE2] text-[#3D5C45] border-[#CFDECF]",
  warning: "bg-[#FFF6E5] text-[#8A5A00] border-[#F2DDB0]",
  accent: "bg-[#EEF2FA] text-[#102B57] border-[#D5DEF0]",
  danger: "bg-[#FDECEC] text-[#9B2C2C] border-[#F3CACA]",
};
export function StatusChip({ tone = "neutral", children, testId }: { tone?: Tone; children: ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 ${TONE[tone]}`}>
      {children}
    </span>
  );
}
