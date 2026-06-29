// Pipeline stages — locked order + colors. Pills always render a TEXT label
// (never color-only) for accessibility. Colors reference the CSS theme tokens
// defined in globals.css.

export type StageCode =
  | "inquiry"
  | "presentation"
  | "quotation"
  | "poc"
  | "negotiation"
  | "won"
  | "lost";

export interface StageDef {
  code: StageCode;
  /** i18n key under `stages.*` */
  labelKey: string;
  order: number;
  bg: string;
  fg: string;
}

export const STAGES: Record<StageCode, StageDef> = {
  inquiry: {
    code: "inquiry",
    labelKey: "stages.inquiry",
    order: 1,
    bg: "var(--color-stage-inquiry-bg)",
    fg: "var(--color-stage-inquiry-fg)",
  },
  presentation: {
    code: "presentation",
    labelKey: "stages.presentation",
    order: 2,
    bg: "var(--color-stage-presentation-bg)",
    fg: "var(--color-stage-presentation-fg)",
  },
  quotation: {
    code: "quotation",
    labelKey: "stages.quotation",
    order: 3,
    bg: "var(--color-stage-quotation-bg)",
    fg: "var(--color-stage-quotation-fg)",
  },
  poc: {
    code: "poc",
    labelKey: "stages.poc",
    order: 4,
    bg: "var(--color-stage-poc-bg)",
    fg: "var(--color-stage-poc-fg)",
  },
  negotiation: {
    code: "negotiation",
    labelKey: "stages.negotiation",
    order: 5,
    bg: "var(--color-stage-negotiation-bg)",
    fg: "var(--color-stage-negotiation-fg)",
  },
  won: {
    code: "won",
    labelKey: "stages.won",
    order: 6,
    bg: "var(--color-stage-won-bg)",
    fg: "var(--color-stage-won-fg)",
  },
  lost: {
    code: "lost",
    labelKey: "stages.lost",
    order: 7,
    bg: "var(--color-stage-lost-bg)",
    fg: "var(--color-stage-lost-fg)",
  },
};

/** Open (non-terminal) stages in pipeline order. */
export const OPEN_STAGES: StageCode[] = [
  "inquiry",
  "presentation",
  "quotation",
  "poc",
  "negotiation",
];

export const ALL_STAGES: StageCode[] = [...OPEN_STAGES, "won", "lost"];

export function isStageCode(value: string): value is StageCode {
  return value in STAGES;
}
