import { describe, expect, it } from "vitest";
import {
  formatToman,
  formatTomanNumber,
  toToman,
  tomanInputToRial,
} from "./money";

describe("toman input and display with preserved integer ledger values", () => {
  it.each(["4500000", "4,500,000", "۴٬۵۰۰٬۰۰۰", "٤٬٥٠٠٬٠٠٠", " 4 500 000 "])(
    "records the 4.5 million toman cleaning cost correctly: %s",
    (input) => {
      expect(tomanInputToRial(input)).toBe(45_000_000);
      expect(formatToman(tomanInputToRial(input))).toBe("۴,۵۰۰,۰۰۰ تومان");
    },
  );
  it("shows historical balances and spreadsheet values at the same toman scale", () => {
    expect(formatToman(3_887_059)).toBe("۳۸۸,۷۰۵.۹ تومان");
    expect(toToman(3_887_059)).toBe(388_705.9);
    expect(formatToman(-150_000)).toBe("-۱۵,۰۰۰ تومان");
    expect(formatToman(0)).toBe("۰ تومان");
  });
  it("preserves fractional shares and never multiplies edited defaults twice", () => {
    for (const amount of [
      1,
      9,
      10,
      11,
      9999,
      3_887_059,
      45_000_000,
      Number.MAX_SAFE_INTEGER,
    ]) {
      expect(tomanInputToRial(formatTomanNumber(amount))).toBe(amount);
    }
    expect(tomanInputToRial("۱۲۳٫۴")).toBe(1234);
    expect(tomanInputToRial("0.1")).toBe(1);
    expect(tomanInputToRial("")).toBe(0);
  });
  it.each([
    "-100",
    "1e6",
    "1.23",
    "100 تومان",
    "oops",
    "NaN",
    "Infinity",
    "1.2.3",
    "9007199254740992",
  ])("rejects invalid or lossy input: %s", (input) => {
    expect(() => tomanInputToRial(input)).toThrow();
  });
});
