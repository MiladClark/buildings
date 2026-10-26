import { jalaliMonths, jalaliParts } from "@/lib/format/jalali";

function cleanPart(value: string) {
  return value
    .normalize("NFC")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-]+|[.\-]+$/g, "");
}

/** The export date is always the Persian civil date in Tehran. */
export function datedExportFilename(
  stem: string,
  extension: string,
  now = new Date(),
) {
  if (!/^[a-z0-9]+$/i.test(extension))
    throw new Error("پسوند فایل معتبر نیست.");
  const { jy, jm, jd } = jalaliParts(now);
  return `${cleanPart(stem) || "گزارش"}-${jy}-${jalaliMonths[jm - 1]}-${jd}.${extension.toLowerCase()}`;
}

export function invoiceExportFilename(
  unitLabel: string,
  extension: string,
  now = new Date(),
) {
  const label = cleanPart(unitLabel).replace(/^واحد-?/u, "") || "نامشخص";
  return datedExportFilename(`واحد-${label}`, extension, now);
}

/** RFC 6266/5987: ASCII headers, with the exact Persian filename for browsers. */
export function attachmentDisposition(filename: string) {
  const safe = filename.replace(/[\r\n\u0000]/g, "");
  const extension = safe.match(/\.([a-z0-9]+)$/i)?.[1] ?? "bin";
  const encoded = encodeURIComponent(safe).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="download.${extension}"; filename*=UTF-8''${encoded}`;
}

const tableNames: Record<string, string> = {
  report: "گزارش",
  "charge-forecast": "پیشنهاد-شارژ",
  "my-cost-settlements": "تسویه‌های-واحد",
  "cost-settlements": "تسویه-هزینه‌ها",
  "unit-balances": "مانده-واحدها",
  "my-invoices": "فیش‌های-من",
  "building-expenses": "هزینه‌های-ساختمان",
  "maintenance-requests": "تعمیرات-و-درخواست‌ها",
  "building-payments": "واریزهای-ساختمان",
  "payment-requests": "اعلام-واریزها",
  "management-trash": "سوابق-حذف‌شده",
  "management-events": "رویدادهای-مدیریت",
  "period-invoices": "فیش‌های-دوره",
  "independent-expenses": "هزینه‌های-مستقل",
  "building-units": "واحدهای-ساختمان",
  "unit-accounts": "حساب-واحدها",
};
export function tableExportFilename(name: string, now = new Date()) {
  const unit = name.match(/^unit-(.+)-(?:costs|payments)$/);
  return unit
    ? invoiceExportFilename(unit[1], "csv", now)
    : datedExportFilename(tableNames[name] ?? name, "csv", now);
}
