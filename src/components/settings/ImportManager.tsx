"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { importCustomers, type ImportRow } from "@/app/(app)/settings/import/actions";

const FIELDS = [
  "name",
  "tax_id",
  "province",
  "industry",
  "source",
  "annual_revenue",
  "contact_name",
  "contact_email",
  "contact_phone",
] as const;

// Minimal CSV parser (handles quoted fields + escaped quotes).
function parseCsv(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      if ((FIELDS as readonly string[]).includes(h)) row[h] = cells[i] ?? "";
    });
    return row as unknown as ImportRow;
  });
}

export function ImportManager() {
  const t = useTranslations("import");
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => parseCsv(text).filter((r) => r.name?.trim()), [text]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const doImport = () =>
    startTransition(async () => {
      const res = await importCustomers(rows);
      if (res.ok) {
        toast(t("done", { inserted: res.inserted, skipped: res.skipped }));
        setText("");
        router.refresh();
      } else {
        toast(t("forbidden"), "error");
      }
    });

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <p className="text-xs text-gray-500">{t("columns")}</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={t("placeholder")}
          className="input font-mono text-xs"
        />

        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            <Upload className="h-4 w-4" aria-hidden />
            {t("upload")}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <Button disabled={pending || rows.length === 0} onClick={doImport}>
            {t("import", { count: rows.length })}
          </Button>
        </div>

        {/* Preview */}
        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-[var(--color-line-soft)]">
            <div className="px-3 py-2 text-[11px] font-semibold text-gray-500">
              {t("preview", { count: rows.length })}
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
                <tr>
                  {FIELDS.map((f) => (
                    <th key={f} className="px-2 py-1.5 font-bold">{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t border-[var(--color-line-soft)]">
                    {FIELDS.map((f) => (
                      <td key={f} className="whitespace-nowrap px-2 py-1.5 text-gray-700">
                        {r[f] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          text.trim() && <p className="text-xs text-[#dc2626]">{t("noRows")}</p>
        )}
      </CardBody>
    </Card>
  );
}
