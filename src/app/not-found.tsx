import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold text-gray-900">Not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        We couldn’t find what you were looking for.
      </p>
      <Link
        href="/customers"
        className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Back to customers
      </Link>
    </div>
  );
}
