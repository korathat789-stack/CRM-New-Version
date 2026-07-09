// Role model + navigation gating. This is UX only — the source of truth for
// permissions is Supabase Row-Level Security plus server-side checks in Server
// Actions. Hiding a menu never grants security.
//
// Admin   — everything, including managing users & permissions and settings.
// Manager — all data, reports and sign-off; NOT permissions or settings.
// Sales   — daily work only; no Reports, no settings.

export type Role = "admin" | "manager" | "sales";

export const ROLES: Role[] = ["admin", "manager", "sales"];

export function isRole(value: string | null | undefined): value is Role {
  return value === "admin" || value === "manager" || value === "sales";
}

export type NavGroupId = "main" | "warehouse" | "reports" | "admin";

export interface NavItem {
  /** route href */
  href: string;
  /** i18n key under `nav.*` */
  labelKey: string;
  /** lucide-react icon name */
  icon: string;
  /** roles allowed to SEE this item; defaults to the group's roles */
  roles?: Role[];
}

export interface NavGroup {
  id: NavGroupId;
  labelKey: string;
  /** roles allowed to SEE this group */
  roles: Role[];
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    id: "main",
    labelKey: "nav.group.main",
    roles: ["admin", "manager", "sales"],
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: "LayoutDashboard" },
      { href: "/customers", labelKey: "nav.customers", icon: "Building2" },
      { href: "/opportunities", labelKey: "nav.opportunities", icon: "Target" },
      { href: "/projects", labelKey: "nav.projects", icon: "FolderKanban" },
      { href: "/quotations", labelKey: "nav.quotations", icon: "FileText" },
      { href: "/tasks", labelKey: "nav.tasks", icon: "CheckSquare" },
    ],
  },
  {
    id: "warehouse",
    labelKey: "nav.group.warehouse",
    roles: ["admin", "manager", "sales"],
    items: [
      { href: "/inventory", labelKey: "nav.inventory", icon: "Package" },
      {
        href: "/goods-receipts",
        labelKey: "nav.goodsReceipt",
        icon: "PackagePlus",
        roles: ["admin", "manager"],
      },
      {
        href: "/approvals",
        labelKey: "nav.approvals",
        icon: "ShieldCheck",
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    id: "reports",
    labelKey: "nav.group.reports",
    roles: ["admin", "manager"],
    items: [
      { href: "/reports/sales", labelKey: "nav.salesReport", icon: "TrendingUp" },
      { href: "/reports/cost", labelKey: "nav.costBudgeting", icon: "Wallet" },
      { href: "/reports/accounting", labelKey: "nav.accounting", icon: "Receipt" },
      { href: "/reports/pnl", labelKey: "nav.pnl", icon: "PieChart" },
    ],
  },
  {
    id: "admin",
    labelKey: "nav.group.admin",
    roles: ["admin"],
    items: [
      { href: "/settings/users", labelKey: "nav.users", icon: "Users" },
      { href: "/settings/import", labelKey: "nav.import", icon: "Upload" },
      { href: "/settings", labelKey: "nav.settings", icon: "Settings" },
    ],
  },
];

export function visibleNav(role: Role): NavGroup[] {
  return NAV.filter((group) => group.roles.includes(role))
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || item.roles.includes(role)
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function canSeeReports(role: Role): boolean {
  return role === "admin" || role === "manager";
}

export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

export function canDelete(role: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Can create/edit products and adjust stock. */
export function canManageInventory(role: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Can authorize / sign off a Won opportunity. */
export function canAuthorize(role: Role): boolean {
  return role === "admin" || role === "manager";
}

/**
 * Map a pathname to the i18n label key of the nav item it belongs to, using a
 * longest-prefix match so nested routes (e.g. /customers/123) resolve to their
 * section. Falls back to the dashboard label for unknown routes.
 */
export function navTitleKey(pathname: string): string {
  let best: NavItem | null = null;
  for (const group of NAV) {
    for (const item of group.items) {
      const match =
        pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (match && (!best || item.href.length > best.href.length)) {
        best = item;
      }
    }
  }
  return best ? best.labelKey : "nav.dashboard";
}
