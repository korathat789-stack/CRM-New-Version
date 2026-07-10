import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { getQuotationForPdf } from "@/lib/quotations";
import { pdfFilename } from "@/lib/quotationPdfModel";
import { QuotationPdf } from "@/lib/pdf/QuotationPdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const data = await getQuotationForPdf(id);
  if (!data) return new Response("Not found", { status: 404 });

  const buffer = await renderToBuffer(<QuotationPdf data={data} />);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(data.number)}"`,
      "Cache-Control": "no-store",
    },
  });
}
