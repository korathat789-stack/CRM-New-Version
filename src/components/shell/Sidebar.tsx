"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Contact2,
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
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { visibleNav } from "@/lib/roles";
import { initialsFrom } from "@/lib/initials";
import { signOut } from "@/lib/actions/auth";
import type { CurrentUser } from "@/lib/auth";

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
export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const t = useTranslations();
  const groups = visibleNav(user.role);

  return (
    <nav
      className="flex h-full w-[248px] flex-col overflow-y-auto text-sm"
      style={{ background: "var(--color-sidebar)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-[18px]">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[.65rem] bg-[var(--color-primary)] text-white">
          <Contact2 className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="truncate font-bold leading-tight text-white">
            {t("app.name")}
          </div>
          <div className="truncate text-[10.5px] text-gray-400">
            {t("app.subtitle")}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => (
          <div key={group.id} className="px-2">
            <div className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t(group.labelKey)}
            </div>
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`my-0.5 flex items-center gap-2.5 rounded-[.65rem] px-2.5 py-2 font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="flex items-center gap-2.5 border-t border-white/10 px-3.5 py-3">
        <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[13px] font-bold text-white">
          {initialsFrom(user.fullName, user.email)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-gray-200">
            {user.fullName ?? user.email}
          </div>
          <div className="text-[11px] text-gray-400">{t(`roles.${user.role}`)}</div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            title={t("common.signOut")}
            aria-label={t("common.signOut")}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[.5rem] text-gray-400 hover:bg-white/5 hover:text-gray-200"
          >
            <LogOut className="h-[17px] w-[17px]" aria-hidden />
          </button>
        </form>
      </div>
    </nav>
  );
}
