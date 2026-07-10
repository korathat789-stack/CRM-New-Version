/** @jsxRuntime automatic */
/** @jsxImportSource react */
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { COMPANY } from "@/lib/company";
import { formatMoney2 } from "@/lib/money";
import {
  groupLinesByCategory,
  paymentRowAmount,
} from "@/lib/quotationPdfModel";
import type { QuotationPdfData } from "@/lib/quotations";

Font.register({
  family: "Sarabun",
  fonts: [
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Regular.ttf") },
    {
      src: path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});

const C = { line: "#334155", soft: "#e2e8f0", muted: "#64748b" };

const s = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 8, color: "#111827", padding: 28 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  company: { fontSize: 9, fontWeight: "bold" },
  companyLine: { fontSize: 7, color: C.muted },
  title: { textAlign: "center", fontSize: 14, fontWeight: "bold", marginVertical: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  infoCol: { width: "48%" },
  infoLine: { flexDirection: "row", marginBottom: 1 },
  infoLabel: { width: 60, color: C.muted },
  infoValue: { flex: 1 },
  intro: { marginBottom: 4 },
  th: { flexDirection: "row", backgroundColor: "#f1f5f9", borderTop: 1, borderBottom: 1, borderColor: C.line, fontWeight: "bold" },
  tr: { flexDirection: "row", borderBottom: 1, borderColor: C.soft },
  subheader: { flexDirection: "row", backgroundColor: "#f8fafc", borderBottom: 1, borderColor: C.soft },
  cNo: { width: "6%", padding: 3 },
  cModel: { width: "16%", padding: 3 },
  cDesc: { width: "38%", padding: 3 },
  cQty: { width: "8%", padding: 3, textAlign: "right" },
  cUom: { width: "8%", padding: 3 },
  cUnit: { width: "12%", padding: 3, textAlign: "right" },
  cTotal: { width: "12%", padding: 3, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: "40%", marginTop: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 },
  grand: { borderTop: 1, borderColor: C.line, fontWeight: "bold", marginTop: 2, paddingTop: 2 },
  remark: { marginTop: 8 },
  payTitle: { marginTop: 8, fontWeight: "bold" },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 28 },
  signCol: { width: "48%" },
  signLabel: { fontWeight: "bold", marginBottom: 4 },
  legal: { marginTop: 16, fontSize: 7, color: C.muted },
});

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoLine}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || "—"}</Text>
    </View>
  );
}

export function QuotationPdf({ data }: { data: QuotationPdfData }) {
  const rows = groupLinesByCategory(data.items);
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.company}>{COMPANY.legalName} {COMPANY.headOfficeNote}</Text>
            <Text style={s.companyLine}>{COMPANY.address}</Text>
            <Text style={s.companyLine}>T: {COMPANY.tel}, {COMPANY.cellPhone}  FAX: {COMPANY.fax}</Text>
          </View>
        </View>

        <Text style={s.title}>ESTIMATED PRICE</Text>

        {/* Client + meta */}
        <View style={s.infoRow}>
          <View style={s.infoCol}>
            <Info label="Client:" value={data.customer.name} />
            <Info label="Address:" value={data.customer.address ?? data.customer.province ?? ""} />
            <Info label="Attention:" value={data.customer.contactName ?? ""} />
            <Info label="Title:" value={data.customer.contactTitle ?? ""} />
            <Info label="Tel:" value={data.customer.contactPhone ?? ""} />
            <Info label="Email:" value={data.customer.contactEmail ?? ""} />
          </View>
          <View style={s.infoCol}>
            <Info label="Quote No:" value={data.number ?? "—"} />
            <Info label="Date:" value={fmtDate(data.quotationDate)} />
            <Info label="Validity:" value={`${data.validityDays} days`} />
            <Info label="Sales Person:" value={data.salesPerson ?? ""} />
            <Info label="Cell Phone:" value={COMPANY.cellPhone} />
          </View>
        </View>

        <Text style={s.intro}>{COMPANY.introLine}</Text>

        {/* Solution table */}
        <View style={s.th}>
          <Text style={s.cNo}>No</Text>
          <Text style={s.cModel}>Model</Text>
          <Text style={s.cDesc}>Item Description</Text>
          <Text style={s.cQty}>QTY</Text>
          <Text style={s.cUom}>UOM</Text>
          <Text style={s.cUnit}>Unit Price</Text>
          <Text style={s.cTotal}>Total (THB)</Text>
        </View>
        {rows.map((r, i) =>
          r.kind === "subheader" ? (
            <View key={`h${i}`} style={s.subheader}>
              <Text style={{ padding: 3, fontWeight: "bold" }}>{r.category}</Text>
            </View>
          ) : (
            <View key={`r${i}`} style={s.tr}>
              <Text style={s.cNo}>{r.no}</Text>
              <Text style={s.cModel}>{r.model}</Text>
              <Text style={s.cDesc}>{r.description}</Text>
              <Text style={s.cQty}>{r.qty}</Text>
              <Text style={s.cUom}>{r.uom}</Text>
              <Text style={s.cUnit}>{formatMoney2(r.unitPrice)}</Text>
              <Text style={s.cTotal}>{formatMoney2(r.amount)}</Text>
            </View>
          )
        )}

        {/* Totals */}
        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatMoney2(data.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>VAT {data.vatRatePct}%</Text>
            <Text>{formatMoney2(data.vatAmount)}</Text>
          </View>
          <View style={[s.totalRow, s.grand]}>
            <Text>Grand Total (THB)</Text>
            <Text>{formatMoney2(data.total)}</Text>
          </View>
        </View>

        {/* Remark */}
        {data.remark ? <Text style={s.remark}>Remark: {data.remark}</Text> : null}

        {/* Payment terms */}
        <Text style={s.payTitle}>Term of payment</Text>
        <View style={s.th}>
          <Text style={{ width: "15%", padding: 3 }}>%</Text>
          <Text style={{ width: "25%", padding: 3, textAlign: "right" }}>Amount (THB)</Text>
          <Text style={{ width: "60%", padding: 3 }}>Condition/Deliverables</Text>
        </View>
        {data.paymentTerms.map((p, i) => (
          <View key={`p${i}`} style={s.tr}>
            <Text style={{ width: "15%", padding: 3 }}>{p.percent}%</Text>
            <Text style={{ width: "25%", padding: 3, textAlign: "right" }}>
              {formatMoney2(paymentRowAmount(data.total, p.percent))}
            </Text>
            <Text style={{ width: "60%", padding: 3 }}>{p.condition}</Text>
          </View>
        ))}

        {/* Signatures */}
        <View style={s.signRow}>
          <View style={s.signCol}>
            <Text style={s.signLabel}>Service Provider</Text>
            <Text>Company: {COMPANY.legalName}</Text>
            <Text>Authorizer: {COMPANY.signatory.name}</Text>
            <Text>Title: {COMPANY.signatory.title}</Text>
            <Text>Date: {fmtDate(data.quotationDate)}</Text>
            <Text>Signature: ____________________</Text>
          </View>
          <View style={s.signCol}>
            <Text style={s.signLabel}>Client</Text>
            <Text>Company: ____________________</Text>
            <Text>Authorizer: ____________________</Text>
            <Text>Title: ____________________</Text>
            <Text>Date: ____________________</Text>
            <Text>Signature: ____________________</Text>
          </View>
        </View>

        <Text style={s.legal}>{COMPANY.legalLine}</Text>
      </Page>
    </Document>
  );
}

export default QuotationPdf;
