export type InvoiceRecipient = { name: string | null; label: string };

/** A vacant or owner-occupied unit must never be billed in a former tenant's name. */
export function invoiceRecipient(unit: {
  status: "occupied" | "owner_occupied" | "empty";
  tenantName?: string | null;
  ownerName?: string | null;
}): InvoiceRecipient {
  const tenant = unit.tenantName?.trim() || null;
  const owner = unit.ownerName?.trim() || null;
  if (unit.status === "occupied" && tenant)
    return { name: tenant, label: "نام ساکن" };
  return {
    name: owner,
    label: unit.status === "owner_occupied" ? "نام ساکن" : "نام مالک",
  };
}
