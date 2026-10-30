import { z } from "zod";
import { latinDigits } from "@/lib/auth/phone";

export const utilityKinds = {
  water: "آب",
  electricity: "برق",
  gas: "گاز",
  other: "سایر قبوض",
};
const dateValue = z.string().refine((v) => {
  if (!v) return true;
  const date = new Date(`${v}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === v
  );
}, "تاریخ قبض معتبر نیست.");
const digits = z
  .string()
  .max(30)
  .regex(/^\d*$/, "شناسه قبض و پرداخت را فقط با عدد وارد کنید.");
const reading = z
  .string()
  .max(30)
  .regex(/^(?:\d+(?:\.\d+)?)?$/, "عدد قرائت یا مصرف معتبر نیست.");
export const utilityBillSchema = z
  .object({
    kind: z.enum(["water", "electricity", "gas", "other"]),
    billId: digits.default(""),
    paymentId: digits.default(""),
    subscriptionId: z.string().trim().max(60).default(""),
    meterNumber: z.string().trim().max(60).default(""),
    issuer: z.string().trim().max(150).default(""),
    issuedOn: dateValue.default(""),
    receivedOn: dateValue.default(""),
    dueOn: dateValue.default(""),
    periodStart: dateValue.default(""),
    periodEnd: dateValue.default(""),
    previousReading: reading.default(""),
    currentReading: reading.default(""),
    consumption: reading.default(""),
    previousDebtRial: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .default(null),
    currentChargeRial: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .nullable()
      .default(null),
  })
  .refine(
    (v) => !v.periodStart || !v.periodEnd || v.periodStart <= v.periodEnd,
    "قرائت فعلی باید پس از قرائت قبلی باشد.",
  )
  .refine(
    (v) => !v.issuedOn || !v.dueOn || v.issuedOn <= v.dueOn,
    "مهلت پرداخت نباید قبل از صدور قبض باشد.",
  );
export type UtilityBill = z.infer<typeof utilityBillSchema>;
export function parseUtilityBill(value: unknown): UtilityBill | null {
  if (value == null) return null;
  const result = utilityBillSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      result.error.issues[0]?.message ?? "اطلاعات قبض معتبر نیست.",
    );
  return result.data;
}
export function utilityBillFromForm(form: FormData): UtilityBill | null {
  if (form.get("hasUtilityBill") !== "on") return null;
  const value = (name: string) =>
    latinDigits(String(form.get(`bill_${name}`) ?? "")).trim();
  const money = (name: string) => {
    const raw = value(name).replace(/[,٬\s]/g, "");
    return raw ? Number(raw) * 10 : null;
  };
  return parseUtilityBill({
    kind: value("kind"),
    billId: value("billId"),
    paymentId: value("paymentId"),
    subscriptionId: value("subscriptionId"),
    meterNumber: value("meterNumber"),
    issuer: value("issuer"),
    issuedOn: value("issuedOn"),
    receivedOn: value("receivedOn"),
    dueOn: value("dueOn"),
    periodStart: value("periodStart"),
    periodEnd: value("periodEnd"),
    previousReading: value("previousReading"),
    currentReading: value("currentReading"),
    consumption: value("consumption"),
    previousDebtRial: money("previousDebt"),
    currentChargeRial: money("currentCharge"),
  });
}
