import { describe, expect, it } from "vitest";
import { formatAllocationBasis, perUnitBasis } from "./allocation-basis";

describe("allocation wording", () => {
  it.each(["۱ از ۸ واحد", "1 از 8 واحد", "١ از ٨ واحد"])(
    "clarifies historical basis %s",
    (basis) => {
      expect(formatAllocationBasis(basis)).toBe("تقسیم مساوی بین ۸ واحد");
    },
  );
  it("retains the payment information attached to the original basis", () => {
    expect(formatAllocationBasis("۱ از ۸ واحد · تسویه‌شده")).toBe(
      "تقسیم مساوی بین ۸ واحد · تسویه‌شده",
    );
  });
  it("leaves population, fixed and unequal shares intact", () => {
    for (const basis of [
      "۲ نفر",
      "مبلغ ثابت واحد",
      "۲ از ۸ واحد",
      "غیبت موقت · ۰ نفر حاضر",
    ])
      expect(formatAllocationBasis(basis)).toBe(basis);
    expect(formatAllocationBasis(null)).toBeNull();
    expect(formatAllocationBasis(perUnitBasis(8))).toBe(perUnitBasis(8));
  });
});
