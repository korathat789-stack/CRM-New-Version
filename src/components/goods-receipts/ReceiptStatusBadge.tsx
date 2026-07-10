"use client";

import { useTranslations } from "next-intl";
import {
  GR_STATUS_COLORS,
  GR_STATUS_LABEL_KEYS,
  type GoodsReceiptStatus,
} from "@/lib/goodsReceipts-shared";

export function ReceiptStatusBadge({ status }: { status: GoodsReceiptStatus }) {
  const t = useTranslations();
  const c = GR_STATUS_COLORS[status];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: c.bg, color: c.fg }}
    >
      {t(GR_STATUS_LABEL_KEYS[status])}
    </span>
  );
}
