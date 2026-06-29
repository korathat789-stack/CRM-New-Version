import type { Grade } from "./grade";
import type { StageCode } from "./stages";

export interface CustomerType {
  id: string;
  code: string;
  label_en: string;
  label_th: string;
  sort: number;
}

export interface Customer {
  id: string;
  code: string | null;
  name: string;
  tax_id: string | null;
  type_id: string | null;
  province: string | null;
  owner_id: string | null;
  annual_revenue: number; // satang
  lifetime_revenue: number; // satang
  source: string | null;
  industry: string | null;
  notes: string | null;
  address: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  customer_id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  line_id: string | null;
  is_primary: boolean;
}

export interface CustomerLinkedProject {
  id: string;
  code: string | null;
  name: string;
  stage: StageCode;
  value: number; // satang
}

export interface CustomerActivity {
  id: string;
  type: string;
  summary: string;
  occurred_at: string;
}

/** Customer plus its joined type, owner name, contacts and computed KPIs. */
export interface CustomerWithStats extends Customer {
  type: CustomerType | null;
  owner_name: string | null;
  primary_contact: Contact | null;
  contacts: Contact[];
  projects: CustomerLinkedProject[];
  activities: CustomerActivity[];
  // KPIs
  open_pipeline: number; // satang — sum of open opportunity value
  win_rate: number | null; // 0..1, null when no closed deals
  open_opportunities: number;
  last_activity_at: string | null;
}

/** Form payload for create / update. Money fields are integer satang. */
export interface CustomerInput {
  name: string;
  tax_id: string | null;
  type_id: string | null;
  province: string | null;
  annual_revenue: number;
  lifetime_revenue: number;
  source: string | null;
  industry: string | null;
  notes: string | null;
}

export type CustomerGradeView = {
  grade: Grade;
};
