"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { STAGES } from "@/lib/stages";
import type { StageCode } from "@/lib/stages";
import {
  advanceStage,
  authorizeOpportunity,
  updatePoc,
  logPresentation,
} from "@/app/(app)/opportunities/actions";

export function StageGateControl({
  id,
  customerId,
  next,
  canOverride,
  authorized,
  presentationLogged,
  pocScheduled,
  pocResult,
}: {
  id: string;
  customerId: string;
  next: StageCode | null;
  canOverride: boolean;
  authorized: boolean;
  presentationLogged: boolean;
  pocScheduled: string | null;
  pocResult: string | null;
}) {
  const t = useTranslations("opportunities.detail");
  const treq = useTranslations("gates.req");
  const ts = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [schedule, setSchedule] = useState(pocScheduled ?? "");
  const [result, setResult] = useState(pocResult ?? "");

  const run = (fn: () => Promise<{ ok: boolean; blockers?: string[] }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.blockers) setBlockers(res.blockers);
      else {
        setBlockers(null);
        router.refresh();
      }
    });

  const nextLabel = next ? ts(STAGES[next].labelKey) : "";
  const advanceLabel =
    next === "won" ? t("markWon") : t("advanceTo", { stage: nextLabel });

  return (
    <div className="flex flex-col gap-3">
      {/* Quick actions to satisfy gates */}
      <div className="flex flex-col gap-2 rounded-md border border-dashed border-gray-300 p-3">
        {!presentationLogged && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => logPresentation(id, customerId))}
          >
            {t("logPresentation")}
          </Button>
        )}

        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold text-gray-600">{t("pocTitle")}</div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500">{t("pocSchedule")}</span>
            <input
              type="date"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500">{t("pocResult")}</span>
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              rows={2}
              className="input"
            />
          </label>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => updatePoc(id, { scheduled: schedule, result }))}
          >
            {t("savePoc")}
          </Button>
        </div>

        {canOverride && (
          <Button
            variant={authorized ? "ghost" : "outline"}
            disabled={pending || authorized}
            onClick={() => run(() => authorizeOpportunity(id))}
          >
            {authorized ? t("authorized") : t("authorize")}
          </Button>
        )}
      </div>

      {/* Advance / Lost */}
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button disabled={pending} onClick={() => run(() => advanceStage(id, next))}>
            {advanceLabel}
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => advanceStage(id, "lost"))}
        >
          {t("markLost")}
        </Button>
      </div>

      {/* Block modal */}
      {blockers && next && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-sm p-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fef3c7] text-[#b45309]">
                <ShieldAlert className="h-5 w-5" aria-hidden />
              </div>
              <button onClick={() => setBlockers(null)} aria-label={t("close")}>
                <X className="h-4 w-4 text-gray-400" aria-hidden />
              </button>
            </div>
            <div className="font-bold text-gray-900">{t("blockTitle")}</div>
            <p className="mt-1.5 text-sm text-gray-500">
              {t("blockBody", { count: blockers.length })}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {blockers.map((b) => (
                <div
                  key={b}
                  className="flex items-center gap-2 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  {treq(b)}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBlockers(null)}>
                {t("close")}
              </Button>
              {canOverride && (
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => run(() => advanceStage(id, next, true))}
                >
                  {t("managerOverride")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
