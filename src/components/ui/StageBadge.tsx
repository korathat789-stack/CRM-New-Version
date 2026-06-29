import { useTranslations } from "next-intl";
import { STAGES, type StageCode } from "@/lib/stages";

// Pipeline stage pill. ALWAYS shows a text label (never color-only) for
// accessibility. Colors come from the locked theme tokens.
export function StageBadge({ code }: { code: StageCode }) {
  const t = useTranslations();
  const stage = STAGES[code];
  return (
    <span
      className="pill inline-flex items-center px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ background: stage.bg, color: stage.fg }}
    >
      {t(stage.labelKey)}
    </span>
  );
}
