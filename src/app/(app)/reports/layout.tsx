import { getCurrentUser } from "@/lib/auth";
import { canSeeReports } from "@/lib/roles";
import { NoAccess } from "@/components/states/StateViews";

// Server-side guard: Reports are Manager + Admin only. Sales is blocked here
// (and by RLS on the underlying invoice data). Hiding the menu is not enough.
export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !canSeeReports(user.role)) {
    return (
      <div className="mx-auto max-w-2xl">
        <NoAccess />
      </div>
    );
  }
  return <>{children}</>;
}
