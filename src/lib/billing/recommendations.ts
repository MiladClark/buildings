import { db } from "@/lib/db";
import { chargeRecommendation } from "@/lib/db/schema";
import { loadSettlementData } from "./settlement-store";
import { calculateChargeRecommendation } from "./forecast";
export async function computeChargeRecommendation(
  buildingId: string,
  monthsWindow: number,
) {
  const result = calculateChargeRecommendation(
    await loadSettlementData(db, buildingId),
    monthsWindow,
  );
  const id = crypto.randomUUID();
  await db
    .insert(chargeRecommendation)
    .values({
      id,
      buildingId,
      monthsWindow,
      suggestedMonthlyRial: result.suggestedMonthlyRial,
      breakdownJson: JSON.stringify(result.breakdown),
      computedAt: new Date(),
    });
  return { id, ...result };
}
