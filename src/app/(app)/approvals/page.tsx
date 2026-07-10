import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PackagePlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { canManageInventory } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/config";
import { listPendingReceipts } from "@/lib/goodsReceipts";
import { ApprovalReceiptCard } from "@/components/goods-receipts/ApprovalReceiptCard";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user.role)) redirect("/inventory");
  const t = await getTranslations("approvals");

  const pending = isSupabaseConfigured() ? await listPendingReceipts() : [];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-gray-900">{t("title")}</h1>
      <p className="text-sm text-gray-500">
        {t("subtitle", { count: pending.length })}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[.65rem] border-l-4 border-[#059669] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <PackagePlus className="h-4 w-4 text-[#059669]" aria-hidden />
            {t("kpi.title")}
          </div>
          <div className="mt-1 text-3xl font-extrabold text-[#059669]">
            {pending.length}
          </div>
          <div className="mt-0.5 text-xs text-[#047857]">{t("kpi.hint")}</div>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          {t("none")}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            {t("receiptsHeading")}
          </h2>
          {pending.map((r) => (
            <ApprovalReceiptCard key={r.id} receipt={r} />
          ))}
        </div>
      )}
    </div>
  );
}
