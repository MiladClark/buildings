import { describe, expect, it } from "vitest";
import { allocatePayment, ledgerBalance } from "./ledger";
describe("payment ledger", () => {
  it("settles oldest invoices and preserves excess credit", () => {
    const r = allocatePayment(350, [
      { id: "old", totalRial: 200, paidRial: 50 },
      { id: "new", totalRial: 100, paidRial: 0 },
    ]);
    expect(r.updates).toEqual([
      { id: "old", paidRial: 200, balanceRial: 0 },
      { id: "new", paidRial: 100, balanceRial: 0 },
    ]);
    expect(r.creditRial).toBe(100);
  });
  it("never counts previous debt twice across periods", () => {
    expect(ledgerBalance([100, 200, 300], [50, 150])).toBe(400);
  });
  it("supports advance payments without invoices", () => {
    expect(allocatePayment(100, [])).toEqual({ updates: [], creditRial: 100 });
    expect(ledgerBalance([], [100])).toBe(-100);
  });
  it("allocates partial payments without touching later invoices", () => {
    expect(
      allocatePayment(50, [
        { id: "a", totalRial: 100, paidRial: 0 },
        { id: "b", totalRial: 100, paidRial: 0 },
      ]).updates,
    ).toEqual([{ id: "a", paidRial: 50, balanceRial: 50 }]);
  });
});
