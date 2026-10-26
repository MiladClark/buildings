import { isoDate, jalaliMonthSpan } from "@/lib/format/jalali";

type Cost = {
  id: string;
  categoryId: string;
  amountRial: number;
  description?: string | null;
  expenseDate: Date;
  coverageMonths?: number | null;
  deletedAt?: Date | null;
  billingTreatment?: string;
};
type Category = {
  id: string;
  name: string;
  slug: string;
  allocationMethod: string;
};

/** A budget estimate, never a second assessment of the underlying expenses. */
export function smartChargePlan(input: {
  categories: Category[];
  expenses: Cost[];
  unitCount: number;
  now?: Date;
  cleaningVisitRial?: number | null;
  cleaningEveryDays?: number;
}) {
  const now = input.now ?? new Date();
  const costs = input.expenses
    .filter(
      (e) =>
        !e.deletedAt &&
        e.billingTreatment !== "separate" &&
        isoDate(e.expenseDate) <= isoDate(now) &&
        e.amountRial > 0,
    )
    .toSorted(
      (a, b) =>
        b.expenseDate.getTime() - a.expenseDate.getTime() ||
        b.id.localeCompare(a.id),
    );
  const rows: {
    key: string;
    name: string;
    monthlyRial: number;
    explanation: string;
    assumed: boolean;
  }[] = [];
  const cleaning = costs.filter(
    (e) =>
      input.categories.find((c) => c.id === e.categoryId)?.slug ===
        "cleaning" &&
      !/وسایل|لوازم|تجهیزات|خرید|لامپ|قفل/.test(e.description ?? ""),
  );
  const cleaningVisitRial =
    input.cleaningVisitRial ?? cleaning[0]?.amountRial ?? null;
  const cleaningEveryDays = input.cleaningEveryDays ?? 30;
  if (cleaningVisitRial !== null)
    rows.push({
      key: "cleaning",
      name: "دستمزد نظافتچی",
      monthlyRial: Math.round((cleaningVisitRial * 30) / cleaningEveryDays),
      explanation: `هزینه هر نوبت × ۳۰ ÷ فاصله ${cleaningEveryDays} روزه؛ خرید وسایل جداست.`,
      assumed:
        input.cleaningVisitRial == null || input.cleaningEveryDays == null,
    });
  const equipment: Cost[] = [];
  for (const category of input.categories) {
    if (
      ["per_person", "excluded", "fixed_per_unit"].includes(
        category.allocationMethod,
      ) ||
      category.slug === "gas"
    )
      continue;
    const records = costs.filter((e) => e.categoryId === category.id);
    if (category.slug === "cleaning") {
      equipment.push(
        ...records.filter((e) => !cleaning.some((c) => c.id === e.id)),
      );
      continue;
    }
    if (["equipment", "supplies", "repairs"].includes(category.slug)) {
      equipment.push(...records);
      continue;
    }
    if (!records.length) continue;
    if (
      ["electricity", "common-electricity", "electric"].includes(category.slug)
    ) {
      const bills = records.slice(0, 6);
      const coverage = bills.reduce((s, e) => s + (e.coverageMonths ?? 2), 0);
      rows.push({
        key: category.id,
        name: category.name,
        monthlyRial: Math.round(
          bills.reduce((s, e) => s + e.amountRial, 0) / coverage,
        ),
        explanation: `میانگین ${bills.length} قبض بر اساس ماه‌های پوشش؛ بازه نامشخص فعلاً دو ماه فرض می‌شود.`,
        assumed: bills.some((e) => !e.coverageMonths),
      });
    } else {
      const recent = records.filter(
        (e) =>
          e.expenseDate.getTime() >=
          new Date(
            now.getFullYear(),
            now.getMonth() - 12,
            now.getDate(),
          ).getTime(),
      );
      const oldest = recent.at(-1);
      if (!oldest) continue;
      // Include months without repairs; one repair is not a monthly service bill.
      const months = Math.max(
        3,
        Math.min(12, jalaliMonthSpan(oldest.expenseDate, now)),
      );
      rows.push({
        key: category.id,
        name: ["elevator", "lift"].includes(category.slug)
          ? "ذخیره آسانسور"
          : `ذخیره ${category.name}`,
        monthlyRial: Math.round(
          recent.reduce((s, e) => s + e.amountRial, 0) / months,
        ),
        explanation: `هزینه‌های ۱۲ ماه اخیر ÷ ${months} ماه؛ با سابقه کم، حداقل سه ماه برای ذخیره در نظر گرفته می‌شود.`,
        assumed: jalaliMonthSpan(oldest.expenseDate, now) < 3,
      });
    }
  }
  const recentEquipment = equipment.filter(
    (e) =>
      e.expenseDate.getTime() >=
      new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()).getTime(),
  );
  if (recentEquipment.length)
    rows.push({
      key: "equipment",
      name: "ذخیره لوازم و تجهیزات",
      monthlyRial: Math.round(
        recentEquipment.reduce((s, e) => s + e.amountRial, 0) / 12,
      ),
      explanation:
        "یک‌دوازدهم خریدهای یک سال اخیر برای جایگزینی احتمالی؛ مبلغ کامل خرید هر ماه تکرار نمی‌شود.",
      assumed: true,
    });
  // Forecasts display whole tomans; sum the exact same rounded values shown in the UI.
  for (const row of rows)
    row.monthlyRial = Math.round(row.monthlyRial / 10) * 10;
  const monthlyBuildingRial = rows.reduce((s, r) => s + r.monthlyRial, 0);
  const bufferPercent = 10,
    roundToRial = 100000;
  const withBufferRial =
    monthlyBuildingRial + Math.round((monthlyBuildingRial * 0.1) / 10) * 10;
  return {
    breakdown: rows,
    monthlyBuildingRial,
    withBufferRial,
    bufferPercent,
    roundToRial,
    suggestedMonthlyRial: input.unitCount
      ? Math.ceil(withBufferRial / input.unitCount / roundToRial) * roundToRial
      : 0,
    unitCount: input.unitCount,
    complete: input.unitCount > 0 && monthlyBuildingRial > 0,
    preliminary: costs.length < 6 || rows.some((r) => r.assumed),
    cleaningVisitRial,
    cleaningEveryDays,
  };
}
