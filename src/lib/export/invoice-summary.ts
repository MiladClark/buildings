export function invoiceExportSummary<
  T extends { basis: string | null; amountRial: number },
>(lines: T[], totalRial: number) {
  const chargeTotalRial = lines
    .filter((line) => line.basis?.includes("مبلغ ثابت واحد"))
    .reduce((sum, line) => sum + line.amountRial, 0);
  return {
    lines: lines.filter((line) => !line.basis?.includes("مبلغ ثابت واحد")),
    chargeTotalRial,
    expensesTotalRial: totalRial - chargeTotalRial,
  };
}
