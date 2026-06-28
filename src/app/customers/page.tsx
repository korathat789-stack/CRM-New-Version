import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import SearchBar from "@/components/SearchBar";

export const dynamic = "force-dynamic";

type Search = { q?: string; status?: string };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { q = "", status = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (q) {
    const term = `%${q}%`;
    query = query.or(
      `name.ilike.${term},company.ilike.${term},email.ilike.${term}`
    );
  }
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  const customers = (data ?? []) as Customer[];

  const statuses = [
    { key: "", label: "All" },
    { key: "active", label: "Active" },
    { key: "lead", label: "Leads" },
    { key: "inactive", label: "Inactive" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            {customers.length} {customers.length === 1 ? "customer" : "customers"}
            {q ? ` matching “${q}”` : ""}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <span className="text-lg leading-none">+</span> New customer
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar initialQuery={q} />
        <div className="flex flex-wrap gap-1">
          {statuses.map((s) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (s.key) params.set("status", s.key);
            const href = `/customers${params.toString() ? `?${params.toString()}` : ""}`;
            const active = status === s.key;
            return (
              <Link
                key={s.key || "all"}
                href={href}
                className={`rounded-full px-3 py-1 text-sm ${
                  active
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load customers: {error.message}
          <p className="mt-1 text-red-600">
            Have you run the SQL in <code>supabase/migrations</code> and set the
            environment variables?
          </p>
        </div>
      ) : customers.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-gray-900 font-medium">No customers yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first customer.
          </p>
          <Link
            href="/customers/new"
            className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New customer
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Company</th>
                <th className="hidden px-6 py-3 md:table-cell">Email</th>
                <th className="hidden px-6 py-3 lg:table-cell">Location</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium text-gray-900 hover:text-indigo-600"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.company ?? "—"}</td>
                  <td className="hidden px-6 py-4 text-sm text-gray-600 md:table-cell">
                    {c.email ?? "—"}
                  </td>
                  <td className="hidden px-6 py-4 text-sm text-gray-600 lg:table-cell">
                    {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
