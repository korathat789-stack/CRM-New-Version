import type { CustomerStatus } from "@/lib/types";

const STYLES: Record<CustomerStatus, string> = {
  active: "bg-green-100 text-green-800 ring-green-600/20",
  lead: "bg-amber-100 text-amber-800 ring-amber-600/20",
  inactive: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

export default function StatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
