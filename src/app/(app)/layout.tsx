import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { Toaster } from "@/components/ui/Toaster";
import { getCurrentUser } from "@/lib/auth";

// Authenticated app shell: role-gated sidebar + top bar. Unauthenticated users
// are bounced to /login (also enforced by middleware).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:block">
        <div className="sticky top-0 h-screen">
          <Sidebar user={user} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
