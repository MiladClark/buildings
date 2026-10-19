/** Isolated local preview. Never run against the real database. */
import { loadEnvConfig } from "@next/env";
import jalaali from "jalaali-js";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DATABASE_URL?.endsWith("/preview.db"))
    throw new Error("Preview requires DATABASE_URL=file:./data/preview.db");
  const { db } = await import("../src/lib/db");
  const s = await import("../src/lib/db/schema");
  const { auth } = await import("../src/lib/auth");
  const { eq } = await import("drizzle-orm");
  const { fromJalali, jalaliParts, formatJalaliMonthLabel } =
    await import("../src/lib/format/jalali");
  const { finalizeBillingPeriod } = await import("../src/lib/billing/finalize");
  const { allocatePayment } = await import("../src/lib/billing/ledger");
  const { computeChargeRecommendation } =
    await import("../src/lib/billing/recommendations");
  if (await db.query.building.findFirst()) {
    console.log("Preview fixture already exists.");
    return;
  }
  const manager = await auth.api.signUpEmail({
    body: {
      name: "رضا احمدی",
      email: "manager@preview.local",
      password: process.env.PREVIEW_PASSWORD || "Local-preview-1405!",
    },
  });
  const resident = await auth.api.signUpEmail({
    body: {
      name: "علی رضایی",
      email: "resident@preview.local",
      password: process.env.PREVIEW_PASSWORD || "Local-preview-1405!",
    },
  });
  const buildingId = crypto.randomUUID();
  await db.insert(s.building).values({
    id: buildingId,
    name: "ساختمان سرو (آزمایشی)",
    address: "اطلاعات نمونه برای بررسی رابط کاربری",
    bankAccount: "0000-0000-0000-0000",
    paymentDueDay: 10,
    perUnitIncludeEmpty: false,
  });
  const units = [];
  const names = [
    "علی رضایی",
    "سارا محمدی",
    "امیر کاظمی",
    "واحد خالی",
    "مریم کریمی",
    "حسین نادری",
    "نیلوفر احمدی",
    "رضا احمدی",
  ];
  for (let i = 0; i < 8; i++) {
    const u = {
      id: crypto.randomUUID(),
      buildingId,
      label: String(i + 1),
      floor: Math.floor(i / 2) + 1,
      occupantCount: [2, 4, 1, 0, 3, 2, 4, 1][i],
      ownerName: names[i],
      status: i === 3 ? ("empty" as const) : ("occupied" as const),
      sortOrder: i,
    };
    units.push(u);
    await db.insert(s.unit).values(u);
  }
  await db.insert(s.membership).values([
    {
      id: crypto.randomUUID(),
      buildingId,
      userId: manager.user.id,
      role: "manager",
    },
    {
      id: crypto.randomUUID(),
      buildingId,
      userId: resident.user.id,
      role: "resident",
      unitId: units[0].id,
    },
  ]);
  const categories = [];
  for (const [i, c] of [
    {
      name: "نظافت و نگهداری",
      slug: "cleaning",
      allocationMethod: "per_unit" as const,
    },
    {
      name: "آب ساختمان",
      slug: "water",
      allocationMethod: "per_person" as const,
    },
    {
      name: "آسانسور",
      slug: "elevator",
      allocationMethod: "per_unit" as const,
    },
    {
      name: "برق مشترک",
      slug: "common-electricity",
      allocationMethod: "per_unit" as const,
    },
    {
      name: "تجهیزات و تعمیرات",
      slug: "equipment",
      allocationMethod: "per_unit" as const,
    },
    { name: "گاز شخصی", slug: "gas", allocationMethod: "excluded" as const },
  ].entries()) {
    const row = {
      ...c,
      id: crypto.randomUUID(),
      buildingId,
      includeEmptyUnits: i !== 1,
      sortOrder: i,
      inflationPercent: i === 0 ? 10 : 0,
    };
    categories.push(row);
    await db.insert(s.expenseCategory).values(row);
  }
  const today = jalaliParts(new Date());
  for (let i = 0; i < 6; i++) {
    let jm = today.jm - 5 + i,
      jy = today.jy;
    if (jm < 1) {
      jm += 12;
      jy--;
    }
    const start = fromJalali(jy, jm, 1),
      end = fromJalali(jy, jm, jalaali.jalaaliMonthLength(jy, jm));
    const id = crypto.randomUUID();
    await db.insert(s.billingPeriod).values({
      id,
      buildingId,
      title: `شارژ ${formatJalaliMonthLabel(start)}`,
      periodType: "monthly",
      startDate: start,
      endDate: end,
      dueDate: fromJalali(jm === 12 ? jy + 1 : jy, jm === 12 ? 1 : jm + 1, 10),
    });
    const values = [12500000, 7200000, 5800000, 3500000, 2400000];
    for (let j = 0; j < 5; j++)
      await db.insert(s.expenseLine).values({
        id: crypto.randomUUID(),
        periodId: id,
        categoryId: categories[j].id,
        amountRial: Math.round(
          values[j] * [0.72, 0.86, 0.79, 1.12, 0.92, 1][i],
        ),
        description: [
          "نظافت راه‌پله و مشاعات",
          "قبض آب مشترک",
          "سرویس و نگهداری آسانسور",
          "قبض برق مشاعات",
          "خرید لوازم و تجهیزات ساختمان",
        ][j],
        expenseDate: fromJalali(jy, jm, Math.min(5 + j * 3, 28)),
      });
    if (i === 5) continue;
    await finalizeBillingPeriod(id);
    for (let n = 0; n < units.length; n++) {
      const invoices = await db
        .select()
        .from(s.unitInvoice)
        .where(eq(s.unitInvoice.unitId, units[n].id));
      const current = invoices.find((r) => r.periodId === id)!;
      const amount = Math.round(
        current.totalRial * ([2, 5].includes(n) && i > 2 ? 0.5 : 1),
      );
      await db.insert(s.payment).values({
        id: crypto.randomUUID(),
        buildingId,
        unitId: units[n].id,
        periodId: id,
        amountRial: amount,
        method: "bank_transfer",
        paidAt: fromJalali(jy, jm, 12 + n),
        recordedByUserId: manager.user.id,
        note: "واریز نمونه آزمایشی",
      });
      for (const u of allocatePayment(amount, invoices).updates)
        await db
          .update(s.unitInvoice)
          .set({
            paidRial: u.paidRial,
            legacyPaidRial: u.paidRial,
            balanceRial: u.balanceRial,
          })
          .where(eq(s.unitInvoice.id, u.id));
    }
  }
  await db.insert(s.paymentRequest).values({
    id: crypto.randomUUID(),
    unitId: units[0].id,
    userId: resident.user.id,
    amountRial: 1500000,
    note: "شماره پیگیری آزمایشی ۱۲۳۴۵۶",
  });
  await db.insert(s.appNotification).values({
    id: crypto.randomUUID(),
    userId: resident.user.id,
    title: "به پنل ساختمان خوش آمدید",
    body: "این حساب و تمام اطلاعات آن صرفاً برای بررسی نرم‌افزار ساخته شده است.",
  });
  await computeChargeRecommendation(buildingId, 6);
  console.log(
    "Isolated preview ready: manager@preview.local and resident@preview.local",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
