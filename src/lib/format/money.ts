const faDigits = "۰۱۲۳۴۵۶۷۸۹";

export function formatToman(amount: number): string {
  return formatTomanNumber(amount) + " تومان";
}

/** Existing ledger values stay in integer minor units, preserving historic bills. */
export function toToman(amount: number): number {
  return amount / 10;
}

export function formatTomanNumber(amount: number): string {
  return toPersianDigits(
    toToman(amount).toLocaleString("en-US", { maximumFractionDigits: 1 }),
  );
}

export function toPersianDigits(value: string): string {
  return value.replace(/\d/g, (d) => faDigits[Number(d)]);
}

/** Convert a toman input once at the form boundary into the ledger's integer unit. */
export function tomanInputToRial(
  value: FormDataEntryValue | string | null,
): number {
  if (value === null || value === "") return 0;
  if (typeof value !== "string") throw new Error("مبلغ تومان معتبر نیست.");
  const latin = value
    .trim()
    .replace(/[۰-۹]/g, (d) => String(faDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[,٬\s]/g, "")
    .replace("٫", ".");
  if (!/^\d+(?:\.\d)?$/.test(latin))
    throw new Error("مبلغ را به تومان و با حداکثر یک رقم اعشار وارد کنید.");
  const [whole, fraction = "0"] = latin.split(".");
  const stored = Number(whole) * 10 + Number(fraction);
  if (!Number.isSafeInteger(stored))
    throw new Error("مبلغ واردشده بیش از حد بزرگ است.");
  return stored;
}
