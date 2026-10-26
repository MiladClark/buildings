import { expect, it } from "vitest";
import { invoiceExportSummary } from "./invoice-summary";

it("separates charged amounts from cost rows without adding them to the invoice twice", () => {
  const lines = [
    { basis: "۲ نفر", amountRial: 1500000 },
    { basis: "مبلغ ثابت واحد", amountRial: 3000000 },
    { basis: "مبلغ ثابت واحد", amountRial: 500000 },
  ];
  expect(invoiceExportSummary(lines, 5000000)).toEqual({
    lines: [lines[0]],
    chargeTotalRial: 3500000,
    expensesTotalRial: 1500000,
  });
  expect(lines).toHaveLength(3);
});
it("keeps the recorded total when no charge was billed", () => {
  expect(
    invoiceExportSummary([{ basis: null, amountRial: 900 }], 1000),
  ).toMatchObject({ chargeTotalRial: 0, expensesTotalRial: 1000 });
});
