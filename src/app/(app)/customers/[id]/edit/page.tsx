import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { updateCustomer } from "../../actions";
import { getCustomer } from "@/lib/customers";
import { getCustomerTypes, isSupabaseConfigured } from "@/lib/config";
import { THAI_PROVINCES } from "@/lib/provinces";
import { satangToBaht } from "@/lib/money";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();

  const [customer, types] = await Promise.all([
    getCustomer(id),
    getCustomerTypes(),
  ]);
  if (!customer) notFound();

  const toBaht = (satang: number) =>
    satang ? String(Math.round(satangToBaht(satang))) : "";

  return (
    <CustomerForm
      action={updateCustomer.bind(null, id)}
      mode="edit"
      types={types}
      provinces={THAI_PROVINCES}
      customerCode={customer.code}
      initial={{
        name: customer.name,
        tax_id: customer.tax_id ?? "",
        type_id: customer.type_id ?? "",
        province: customer.province ?? "",
        annual_revenue: toBaht(customer.annual_revenue),
        lifetime_revenue: toBaht(customer.lifetime_revenue),
        source: customer.source ?? "",
        industry: customer.industry ?? "",
        notes: customer.notes ?? "",
        address: customer.address ?? "",
        segment: customer.segment ?? "",
        buyer_role: customer.buyer_role ?? "",
        partner_name: customer.partner_name ?? "",
        contact_name: customer.primary_contact?.name ?? "",
        contact_email: customer.primary_contact?.email ?? "",
        contact_phone: customer.primary_contact?.phone ?? "",
        contact_line: customer.primary_contact?.line_id ?? "",
      }}
    />
  );
}
