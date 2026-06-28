export type CustomerStatus = "active" | "lead" | "inactive";

export const CUSTOMER_STATUSES: CustomerStatus[] = ["active", "lead", "inactive"];

export interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: CustomerStatus;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Shape of the form payload used for create / update.
export interface CustomerInput {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: CustomerStatus;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
}
