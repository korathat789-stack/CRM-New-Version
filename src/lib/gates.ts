// Sales workflow stage gates — ONE editable rule set, shared by the
// completeness tracker and the gate modal. Pure/client-safe (no DB imports).
//
// Requirements are the fields that must be complete to ENTER a stage
// (wireframe frame T2). Stage advance is validated against these in the Server
// Action (lib is the single source of truth); Manager/Admin can override.

import { type StageCode } from "./stages";

/** Everything the gate rules need, assembled server-side from an opportunity
 *  and its related records (customer, activities, quotation). */
export interface GateContext {
  customerName: boolean;
  customerType: boolean;
  customerOwner: boolean;
  oppValue: boolean;
  presentationLogged: boolean;
  quoteNumber: boolean;
  quoteAmount: boolean;
  quoteSent: boolean;
  pocScheduled: boolean;
  pocResult: boolean;
  signedQuote: boolean;
  authorized: boolean;
}

export interface GateRequirement {
  key: string; // i18n key under gates.req.*
  met: (c: GateContext) => boolean;
}

// Requirements to ENTER each stage. inquiry/lost have none.
export const STAGE_GATES: Partial<Record<StageCode, GateRequirement[]>> = {
  presentation: [
    { key: "customerName", met: (c) => c.customerName },
    { key: "customerType", met: (c) => c.customerType },
    { key: "customerOwner", met: (c) => c.customerOwner },
    { key: "oppValue", met: (c) => c.oppValue },
  ],
  quotation: [{ key: "presentationLogged", met: (c) => c.presentationLogged }],
  poc: [
    { key: "quoteNumber", met: (c) => c.quoteNumber },
    { key: "quoteAmount", met: (c) => c.quoteAmount },
    { key: "quoteSent", met: (c) => c.quoteSent },
  ],
  negotiation: [
    { key: "pocScheduled", met: (c) => c.pocScheduled },
    { key: "pocResult", met: (c) => c.pocResult },
  ],
  won: [
    { key: "signedQuote", met: (c) => c.signedQuote },
    { key: "pocPassed", met: (c) => c.pocResult },
    { key: "authorized", met: (c) => c.authorized },
  ],
};

// Linear advance order. (lost is reachable separately, not via gates.)
export const ADVANCE_ORDER: StageCode[] = [
  "inquiry",
  "presentation",
  "quotation",
  "poc",
  "negotiation",
  "won",
];

export function nextStage(stage: StageCode): StageCode | null {
  const i = ADVANCE_ORDER.indexOf(stage);
  if (i < 0 || i >= ADVANCE_ORDER.length - 1) return null;
  return ADVANCE_ORDER[i + 1];
}

export interface GateEvaluation {
  met: boolean;
  missing: GateRequirement[];
}

export function evaluateGate(
  target: StageCode,
  ctx: GateContext
): GateEvaluation {
  const reqs = STAGE_GATES[target] ?? [];
  const missing = reqs.filter((r) => !r.met(ctx));
  return { met: missing.length === 0, missing };
}

/** Flattened checklist of every gate from presentation → won, for the
 *  completeness tracker (% complete + blockers). */
export interface ChecklistItem {
  stage: StageCode;
  key: string;
  met: boolean;
}

export function completeness(ctx: GateContext): {
  items: ChecklistItem[];
  percent: number;
} {
  const items: ChecklistItem[] = [];
  for (const stage of ["presentation", "quotation", "poc", "negotiation", "won"] as StageCode[]) {
    for (const req of STAGE_GATES[stage] ?? []) {
      items.push({ stage, key: req.key, met: req.met(ctx) });
    }
  }
  const met = items.filter((i) => i.met).length;
  const percent = items.length ? Math.round((met / items.length) * 100) : 100;
  return { items, percent };
}
