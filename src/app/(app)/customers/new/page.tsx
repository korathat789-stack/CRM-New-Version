import { CustomerForm } from "@/components/customers/CustomerForm";
import { createCustomer } from "../actions";
import { getCustomerTypes } from "@/lib/config";
import { THAI_PROVINCES } from "@/lib/provinces";

export default async function NewCustomerPage() {
  const types = await getCustomerTypes();
  return (
    <CustomerForm
      action={createCustomer}
      mode="new"
      types={types}
      provinces={THAI_PROVINCES}
    />
  );
}
