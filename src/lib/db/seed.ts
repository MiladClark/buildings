import { db } from "@/lib/db";
import {
  building,
  expenseCategory,
  membership,
  unit,
  user,
} from "@/lib/db/schema";

const DEFAULT_CATEGORIES = [
  {
    name: "آب ساختمان",
    slug: "water",
    allocationMethod: "per_person" as const,
  },
  {
    name: "برق مشترک",
    slug: "common-electricity",
    allocationMethod: "per_unit" as const,
  },
  { name: "آسانسور", slug: "elevator", allocationMethod: "per_unit" as const },
  { name: "پارکینگ", slug: "parking", allocationMethod: "per_unit" as const },
  { name: "نظافت", slug: "cleaning", allocationMethod: "per_unit" as const },
  {
    name: "تجهیزات و لوازم",
    slug: "equipment",
    allocationMethod: "per_unit" as const,
  },
  { name: "گاز (شخصی)", slug: "gas", allocationMethod: "excluded" as const },
];

async function main() {
  const existingBuilding = await db.select().from(building).limit(1);
  if (existingBuilding.length > 0) {
    console.log("Seed skipped: building already exists.");
    return;
  }

  const buildingId = crypto.randomUUID();
  await db.insert(building).values({
    id: buildingId,
    name: "ساختمان نمونه",
    address: "تهران",
    bankAccount: "شماره حساب را در تنظیمات وارد کنید",
    bankSheba: "",
    defaultPeriodType: "monthly",
    paymentDueDay: 10,
    perUnitIncludeEmpty: false,
  });

  for (const [index, cat] of DEFAULT_CATEGORIES.entries()) {
    await db.insert(expenseCategory).values({
      id: crypto.randomUUID(),
      buildingId,
      name: cat.name,
      slug: cat.slug,
      kind: cat.allocationMethod === "excluded" ? "variable" : "variable",
      allocationMethod: cat.allocationMethod,
      includeEmptyUnits: false,
      sortOrder: index,
      active: cat.allocationMethod !== "excluded",
    });
  }

  const demoUnits = [
    { label: "۱", floor: 1, occupantCount: 1 },
    { label: "۲", floor: 1, occupantCount: 4 },
    { label: "۳", floor: 2, occupantCount: 2 },
  ];

  for (const [index, u] of demoUnits.entries()) {
    await db.insert(unit).values({
      id: crypto.randomUUID(),
      buildingId,
      label: u.label,
      floor: u.floor,
      occupantCount: u.occupantCount,
      status: "occupied",
      sortOrder: index,
    });
  }

  const users = await db.select().from(user).limit(1);
  if (users[0]) {
    await db.insert(membership).values({
      id: crypto.randomUUID(),
      userId: users[0].id,
      buildingId,
      role: "manager",
    });
  }

  console.log(
    "Seed complete. Register the first manager account from /register",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
