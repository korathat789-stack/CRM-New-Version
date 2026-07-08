import { QuotationForm } from "@/components/quotations/QuotationForm";
import { getVatRatePct } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { PickerCustomer } from "@/app/(app)/quotations/actions";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; opp?: string }>;
}) {
  const sp = await searchParams;
  const vatRate = await getVatRatePct();
  const today = new Date().toISOString().slice(0, 10);
  const autoNumber = `Q${today.slice(2, 4)}…`;

  // Prefill the customer when launched from an opportunity (revenue linkage).
  let initialCustomer: PickerCustomer | null = null;
  if (sp.customer) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customers")
      .select("id, code, name, tax_id, province, grade_annual")
      .eq("id", sp.customer)
      .maybeSingle();
    if (data) {
      initialCustomer = {
        id: data.id as string,
        code: (data.code as string) ?? null,
        name: data.name as string,
        tax_id: (data.tax_id as string) ?? null,
        province: (data.province as string) ?? null,
        grade: (data.grade_annual as string) ?? "F",
      };
    }
  }

  return (
    <QuotationForm
      vatRate={vatRate}
      autoNumber={autoNumber}
      today={today}
      initialCustomer={initialCustomer}
      opportunityId={sp.opp}
    />
  );
}
