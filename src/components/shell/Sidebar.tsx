"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Building2,
  Target,
  FolderKanban,
  FileText,
  CheckSquare,
  TrendingUp,
  Wallet,
  Receipt,
  PieChart,
  Users,
  Upload,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { visibleNav, type Role } from "@/lib/roles";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Target,
  FolderKanban,
  FileText,
  CheckSquare,
  TrendingUp,
  Wallet,
  Receipt,
  PieChart,
  Users,
  Upload,
  Settings,
};

// Role-gated sidebar. Hidden groups are NOT rendered for Sales/Manager (UX);
// real enforcement is RLS + server checks.
export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const t = useTranslations();
  const groups = visibleNav(role);

  return (
    <nav
      className="flex h-full w-60 flex-col gap-1 overflow-y-auto py-3.5 text-sm"
      style={{ background: "var(--color-sidebar)" }}
    >
      <div className="mb-2 flex items-center gap-2.5 border-b border-white/10 px-4 pb-3.5">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] bg-[var(--color-primary)] text-white font-bold">
          M
        </span>
        <span className="font-bold text-white">{t("app.name")}</span>
      </div>

      {groups.map((group) => (
        <div key={group.id} className="px-2">
          <div className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {t(group.labelKey)}
          </div>
          {group.items.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`my-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 font-medium transition-colors ${
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
