import { gradeColor, type Grade } from "@/lib/grade";

const SIZES = {
  sm: "h-6 w-6 text-[11px]",
  md: "h-[30px] w-[30px] text-sm",
  lg: "h-[42px] w-[42px] text-xl",
} as const;

// Round grade avatar (A–F) shown wherever a customer appears.
export function GradeBadge({
  grade,
  size = "md",
}: {
  grade: Grade;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white ${SIZES[size]}`}
      style={{ background: gradeColor(grade) }}
      aria-label={`Grade ${grade}`}
    >
      {grade}
    </span>
  );
}
