"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  approveGoodsReceipt,
  rejectGoodsReceipt,
} from "@/app/(app)/goods-receipts/actions";

export function ApprovalActions({
  receiptId,
  code,
}: {
  receiptId: string;
  code: string;
}) {
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const tg = useTranslations("goodsReceipts.toast");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
        toast(tg("notPending"), "error");
        router.refresh();
      } else {
        toast(tc("retry"), "error");
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(() => rejectGoodsReceipt(receiptId), t("confirmReject", { code }))
        }
      >
        {t("reject")}
      </Button>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() => approveGoodsReceipt(receiptId), t("confirmApprove", { code }))
        }
      >
        {t("approve")}
      </Button>
    </div>
  );
}
