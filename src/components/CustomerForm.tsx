"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CUSTOMER_STATUSES, type Customer } from "@/lib/types";

type Props = {
  action: (formData: FormData) => Promise<void>;
  customer?: Customer;
  submitLabel: string;
  cancelHref: string;
};

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}

export default function CustomerForm({ action, customer, submitLabel, cancelHref }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
      } catch (e) {
        // redirect() throws a special error we should let bubble up.
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Contact</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" name="name" required defaultValue={customer?.name} placeholder="Jane Doe" />
          <Field label="Company" name="company" defaultValue={customer?.company} placeholder="Acme Inc." />
          <Field label="Email" name="email" type="email" defaultValue={customer?.email} placeholder="jane@acme.com" />
          <Field label="Phone" name="phone" defaultValue={customer?.phone} placeholder="+1 555 000 0000" />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Status</span>
            <select
              name="status"
              defaultValue={customer?.status ?? "active"}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm capitalize text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Location</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Address" name="address" defaultValue={customer?.address} placeholder="123 Market St" />
          <Field label="City" name="city" defaultValue={customer?.city} placeholder="San Francisco" />
          <Field label="Country" name="country" defaultValue={customer?.country} placeholder="USA" />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Notes</h2>
        <textarea
          name="notes"
          rows={4}
          defaultValue={customer?.notes ?? ""}
          placeholder="Anything worth remembering about this customer…"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href={cancelHref}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
