import { useTranslations } from "next-intl";
import { Inbox, AlertTriangle, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";

// Reusable non-happy-path states. Every screen must handle Loading / Empty /
// Error / No-access / Success (wireframe frame W).

export function EmptyState({
  title,
  body,
  action,
}: {
  title?: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const t = useTranslations("states");
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <Inbox className="h-8 w-8 text-gray-300" aria-hidden />
      <div className="font-semibold text-gray-900">{title ?? t("emptyTitle")}</div>
      <div className="text-sm text-gray-500">{body ?? t("emptyBody")}</div>
      {action}
    </Card>
  );
}

export function NoAccess() {
  const t = useTranslations("states");
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <Lock className="h-5 w-5" aria-hidden />
      </div>
      <div className="font-semibold text-gray-900">{t("noAccessTitle")}</div>
      <div className="text-sm text-gray-500">{t("noAccessBody")}</div>
    </Card>
  );
}

export function ErrorView({
  reset,
  message,
}: {
  reset?: () => void;
  message?: string;
}) {
  const t = useTranslations("states");
  const common = useTranslations("common");
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <AlertTriangle className="h-8 w-8 text-[#dc2626]" aria-hidden />
      <div className="font-semibold text-gray-900">{t("errorTitle")}</div>
      <div className="text-sm text-gray-500">{message ?? t("errorBody")}</div>
      {reset && (
        <button
          onClick={reset}
          className="mt-1 text-sm font-semibold text-[var(--color-primary)]"
        >
          {common("retry")}
        </button>
      )}
    </Card>
  );
}

/** Generic skeleton block for loading states. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function CardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="mt-1 h-9 w-full" />
    </Card>
  );
}
