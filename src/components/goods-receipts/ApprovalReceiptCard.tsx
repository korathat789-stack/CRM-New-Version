"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { PackagePlus, ChevronDown, XCircle, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ReceiptStatusBadge } from "@/components/goods-receipts/ReceiptStatusBadge";
import { toast } from "@/lib/toast";
import {
  approveGoodsReceipt,
  rejectGoodsReceipt,
} from "@/app/(app)/goods-receipts/actions";
import type { GoodsReceiptDetail } from "@/lib/goodsReceipts";

export function ApprovalReceiptCard({
  receipt,
}: {
  receipt: GoodsReceiptDetail;
}) {
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const tv = useTranslations("goodsReceipts.detailView");
  const tg = useTranslations("goodsReceipts");
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  const code = receipt.code ?? "";

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    confirmMsg: string
  ) => {
    if (!window.confirm(confirmMsg)) return;
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast(tc("saved"));
        router.refresh();
      } else if (res.error === "notPending") {
        toast(tg("toast.notPending"), "error");
        router.refresh();
      } else {
        toast(tc("retry"), "error");
      }
    });
  };

  return (
    <Card className="overflow-hidden border border-[var(--color-line-soft)]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="flex cursor-pointer items-center gap-3 px-4 py-3.5"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[.6rem] bg-[#d1fae5] text-[#059669]">
          <PackagePlus className="h-[18px] w-[18px]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[#059669]">
              {receipt.code ?? tg("detail")}
            </span>
            <ReceiptStatusBadge status={receipt.status} />
            <span className="text-xs text-gray-500">{receipt.receipt_date}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-gray-500">
            {receipt.supplier}
            {receipt.po_ref ? ` · PO: ${receipt.po_ref}` : ""}
            {` · ${tv("receivedBy")}: ${receipt.received_by_name ?? "—"}`}
          </div>
        </div>
        <div
          className="flex flex-shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="!border-[#dc2626] !text-[#dc2626] hover:!bg-red-50"
            onClick={() =>
              run(
                () => rejectGoodsReceipt(receipt.id),
                t("confirmReject", { code })
              )
            }
          >
            <XCircle className="h-4 w-4" aria-hidden />
            {t("reject")}
          </Button>
          <Button
            type="button"
            variant="success"
            disabled={pending}
            onClick={() =>
              run(
                () => approveGoodsReceipt(receipt.id),
                t("confirmApprove", { code })
              )
            }
          >
            <Check className="h-4 w-4" aria-hidden />
            {t("approve")}
          </Button>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </div>
      </div>
      {expanded && (
        <div className="border-t border-[var(--color-line-soft)] px-4 py-3">
          <ul className="flex flex-col gap-1 text-xs">
            {receipt.items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span className="text-gray-800">
                  {it.product_name}{" "}
                  <span className="text-gray-400">({it.product_code})</span>
                </span>
                <span className="font-semibold text-gray-900">
                  {it.qty} {it.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
