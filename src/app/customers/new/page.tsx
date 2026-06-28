import Link from "next/link";
import { createCustomer } from "../actions";
import CustomerForm from "@/components/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/customers"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← Back to customers
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-gray-900">
        New customer
      </h1>
      <CustomerForm
        action={createCustomer}
        submitLabel="Create customer"
        cancelHref="/customers"
      />
    </div>
  );
}
