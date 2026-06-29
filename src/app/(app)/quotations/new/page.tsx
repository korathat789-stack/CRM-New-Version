import { QuotationForm } from "@/components/quotations/QuotationForm";
import { getVatRatePct } from "@/lib/config";

export default async function NewQuotationPage() {
  const vatRate = await getVatRatePct();
  const today = new Date().toISOString().slice(0, 10);
  const autoNumber = `Q${today.slice(2, 4)}…`;

  return <QuotationForm vatRate={vatRate} autoNumber={autoNumber} today={today} />;
}
