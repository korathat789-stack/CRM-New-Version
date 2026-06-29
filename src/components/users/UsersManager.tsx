"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CapabilityMatrix } from "./CapabilityMatrix";
import type { AppUser } from "@/lib/users";
import { ROLES, type Role } from "@/lib/roles";
import {
  inviteUser,
  updateUser,
  deleteUser,
} from "@/app/(app)/settings/users/actions";

const ROLE_PILL: Record<Role, { bg: string; fg: string }> = {
  admin: { bg: "#1f2937", fg: "#ffffff" },
  manager: { bg: "#dbeafe", fg: "#1d4ed8" },
  sales: { bg: "#e2e8f0", fg: "#475569" },
};

const GRID = "grid grid-cols-[1.8fr_1.4fr_0.9fr_0.9fr_1.1fr_0.7fr] gap-2 items-center";

function initials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

type DialogState =
  | { mode: "new" }
  | { mode: "edit"; user: AppUser }
  | null;

export function UsersManager({
  users,
  currentUserId,
}: {
  users: AppUser[];
  currentUserId: string;
}) {
  const t = useTranslations("users");
  const tr = useTranslations("roles");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
    );
  }, [users, query]);

  const adminCount = users.filter((u) => u.role === "admin").length;

  const onDelete = (id: string) => {
    startTransition(async () => {
      await deleteUser(id);
      router.refresh();
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] p-4">
        <div className="flex-1">
          <div className="text-base font-bold text-gray-900">{t("title")}</div>
          <div className="text-xs text-gray-500">
            {t("count", { count: users.length, admins: adminCount })}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-line)] px-2.5 py-1.5">
          <Search className="h-4 w-4 text-gray-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="bg-transparent text-sm outline-none"
          />
        </div>
        <Button onClick={() => setDialog({ mode: "new" })}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("newUser")}
        </Button>
      </div>

      <div className={`${GRID} border-b border-[var(--color-line)] bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-500`}>
        <div>{t("cols.name")}</div>
        <div>{t("cols.email")}</div>
        <div>{t("cols.role")}</div>
        <div>{t("cols.status")}</div>
        <div>{t("cols.lastLogin")}</div>
        <div className="text-right">{t("cols.actions")}</div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500">{t("noUsers")}</div>
      ) : (
        filtered.map((u) => {
          const pill = ROLE_PILL[u.role];
          return (
            <div
              key={u.id}
              className={`${GRID} border-b border-[var(--color-line-soft)] px-4 py-2.5 text-xs`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-[11px] font-bold text-white">
                  {initials(u.full_name, u.email)}
                </span>
                <span className="font-semibold text-gray-900">
                  {u.full_name ?? "—"}
                </span>
              </div>
              <div className="truncate text-gray-500">{u.email ?? "—"}</div>
              <div>
                <span
                  className="pill inline-flex px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: pill.bg, color: pill.fg }}
                >
                  {tr(u.role)}
                </span>
              </div>
              <div>
                <span
                  className="text-[11px]"
                  style={{ color: u.status === "active" ? "#16a34a" : "#9ca3af" }}
                >
                  ● {t(`status.${u.status}`)}
                </span>
              </div>
              <div className="text-gray-500">
                {u.last_login_at
                  ? new Date(u.last_login_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })
                  : t("never")}
              </div>
              <div className="flex justify-end gap-2 text-gray-400">
                <button
                  onClick={() => setDialog({ mode: "edit", user: u })}
                  aria-label={t("cols.actions")}
                  className="hover:text-[var(--color-primary)]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                {u.id !== currentUserId && (
                  <button
                    onClick={() => onDelete(u.id)}
                    disabled={pending}
                    aria-label={t("delete.confirm")}
                    className="hover:text-[#dc2626]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {dialog && (
        <UserDialog
          state={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

function UserDialog({
  state,
  onClose,
  onSaved,
}: {
  state: Exclude<DialogState, null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("users.dialog");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const tu = useTranslations("users");
  const isEdit = state.mode === "edit";
  const existing = isEdit ? state.user : null;

  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [role, setRole] = useState<Role>(existing?.role ?? "sales");
  const [status, setStatus] = useState<"active" | "inactive">(
    existing?.status ?? "active"
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = isEdit
        ? await updateUser(existing!.id, { full_name: fullName, role, status })
        : await inviteUser({ email, full_name: fullName, role });
      if (res.ok) onSaved();
      else setError(errorMessage(res.error));
    });
  };

  const errorMessage = (code?: string) => {
    switch (code) {
      case "emailRequired":
        return t("errEmailRequired");
      case "serviceRole":
        return t("errServiceRole");
      case "forbidden":
        return t("errForbidden");
      case "self":
        return t("errSelf");
      default:
        return t("errFailed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-line)] p-4">
          <span className="font-bold text-gray-900">
            {isEdit ? t("editTitle") : t("newTitle")}
          </span>
        </div>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-600">{t("fullName")}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-600">{t("email")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              className="input disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("role")}</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="input"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-600">{t("status")}</span>
              <div className="flex overflow-hidden rounded-md border border-[var(--color-line)] text-xs">
                {(["active", "inactive"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    disabled={!isEdit}
                    className={`flex-1 py-2 font-semibold ${
                      status === s
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-gray-500"
                    } disabled:opacity-60`}
                  >
                    {tu(`status.${s}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <CapabilityMatrix />

          {error && (
            <div className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-line)] p-3">
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button onClick={save} disabled={pending}>
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
