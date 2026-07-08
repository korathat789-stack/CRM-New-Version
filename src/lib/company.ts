import type { QuotationPaymentTerm } from "./quotationPdfModel";

/** Fixed seller identity for the quotation document. Values transcribed verbatim
 *  from the corporate template (Q-MPT-…). The template shows no Tax ID, so none
 *  is included (do not fabricate). */
export const COMPANY = {
  legalName: "MATCHPOINT TECHNOLOGY CO.,LTD.",
  headOfficeNote: "(Head Office)",
  address:
    "1917 moo10, Soi Baring 36, Sukhumvit 107 Road, Samrongnua, Muangsamutprakarn, Samutprakarn 10270",
  tel: "02-743-2533",
  fax: "02-743-2533#101",
  cellPhone: "086-3183065",
  /** Path under /public for the header logo (add the asset when available). */
  logoPath: "/quotation/logo.png",
  signatory: { name: "Gunyarat Choksuntasut", title: "MANAGER" },
  introLine:
    "According to your requirements we are truly pleased to submit the following offer for your kind consideration",
  legalLine:
    "By signing below, the client has approved and accepted the above terms and conditions of this quotation with fully understanding and acceptance that this document can legally be used as a purchase Order.",
  defaultPaymentTerm: {
    percent: 100,
    condition: "Against Purchase Order (for stock goods)",
  } as QuotationPaymentTerm,
} as const;
