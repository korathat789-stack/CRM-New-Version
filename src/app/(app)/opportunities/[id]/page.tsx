import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StageBadge } from "@/components/ui/StageBadge";
import { CompletenessTracker } from "@/components/opportunities/CompletenessTracker";
import { StageGateControl } from "@/components/opportunities/StageGateControl";
import { NextActionEditor } from "@/components/opportunities/NextActionEditor";
import { AddActivityButton } from "@/components/activities/AddActivityButton";
import { getOpportunity } from "@/lib/opportunities";
import { isSupabaseConfigured } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { canAuthorize } from "@/lib/roles";
import { formatBahtShort } from "@/lib/money";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();

  const [opp, user] = await Promise.all([getOpportunity(id), getCurrentUser()]);
  if (!opp) notFound();

  const t = await getTranslations("opportunities.detail");
  const blockerKeys = opp.nextGate?.missing.map((m) => m.key) ?? [];
  const canOverride = user ? canAuthorize(user.role) : false;

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] p-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-gray-900">
              {opp.title}
            </div>
            <div className="truncate text-xs text-gray-500">
              {opp.code} ·{" "}
              <Link
                href={`/customers/${opp.customer_id}`}
                className="text-[var(--color-primary)]"
              >
                {opp.customer_name} ↩
              </Link>
            </div>
          </div>
          <StageBadge code={opp.stage} />
          <div className="text-right">
            <div className="text-base font-bold text-gray-900">
              {formatBahtShort(opp.value)}
            </div>
            {opp.next_step && (
              <div className="text-[11px] text-gray-500">{opp.next_step}</div>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/quotations/new?customer=${opp.customer_id}&opp=${opp.id}`}>
              <Button variant="outline">{t("createQuotation")}</Button>
            </Link>
            <AddActivityButton customerId={opp.customer_id} opportunityId={opp.id} />
          </div>
        </div>

        <CardBody className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <NextActionEditor id={opp.id} value={opp.next_action_date ?? ""} />
          </div>
          <CompletenessTracker
            percent={opp.completeness.percent}
            items={opp.completeness.items}
            blockerKeys={blockerKeys}
          />
          <StageGateControl
            id={opp.id}
            customerId={opp.customer_id}
            next={opp.next}
            canOverride={canOverride}
            authorized={Boolean(opp.authorized_by)}
            presentationLogged={opp.ctx.presentationLogged}
            pocScheduled={opp.poc_scheduled_at}
            pocResult={opp.poc_result}
          />
        </CardBody>
      </Card>
    </div>
  );
}
