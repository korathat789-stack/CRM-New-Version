import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/types";
import CustomerForm from "@/components/CustomerForm";
import { updateCustomer } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const customer = data as Customer;

  const updateThis = updateCustomer.bind(null, customer.id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href={`/customers/${customer.id}`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← Back to {customer.name}
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-gray-900">
        Edit customer
      </h1>
      <CustomerForm
        action={updateThis}
        customer={customer}
        submitLabel="Save changes"
        cancelHref={`/customers/${customer.id}`}
      />
    </div>
  );
}
