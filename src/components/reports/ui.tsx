// Shared, server-safe report building blocks.

export function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-gray-300 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div
        className="text-base font-bold"
        style={{ color: color ?? "var(--color-ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-dashed border-gray-300 p-3 ${className}`}
    >
      <div className="mb-2.5 text-xs font-bold text-gray-600">{title}</div>
      {children}
    </div>
  );
}
