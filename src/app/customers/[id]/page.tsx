import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import DeleteButton from "@/components/DeleteButton";
import { deleteCustomer } from "../actions";

export const dynamic = "force-dynamic";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-gray-100 py-3 last:border-0 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

export default async function CustomerDetailPage({
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

  const initials = customer.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const deleteThis = deleteCustomer.bind(null, customer.id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/customers" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back to customers
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">{customer.name}</h1>
              <StatusBadge status={customer.status} />
            </div>
            <p className="text-sm text-gray-500">{customer.company ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${customer.id}/edit`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </Link>
          <DeleteButton action={deleteThis} customerName={customer.name} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Contact</h2>
          <dl>
            <DetailRow label="Email" value={customer.email} />
            <DetailRow label="Phone" value={customer.phone} />
            <DetailRow label="Company" value={customer.company} />
          </dl>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Location</h2>
          <dl>
            <DetailRow label="Address" value={customer.address} />
            <DetailRow label="City" value={customer.city} />
            <DetailRow label="Country" value={customer.country} />
          </dl>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 md:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {customer.notes ?? "No notes yet."}
          </p>
        </section>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Added {new Date(customer.created_at).toLocaleString()} · Updated{" "}
        {new Date(customer.updated_at).toLocaleString()}
      </p>
    </div>
  );
}
