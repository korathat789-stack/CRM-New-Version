import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";
import { NoAccess } from "@/components/states/StateViews";

// Settings (including Users & Roles) is Admin-only. Enforced here AND by RLS on
// the profiles/config tables.
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !canManageUsers(user.role)) {
    return (
      <div className="mx-auto max-w-2xl">
        <NoAccess />
      </div>
    );
  }
  return <>{children}</>;
}
