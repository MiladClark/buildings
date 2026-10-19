import { toPersianDigits } from "./money";

export function perUnitBasis(count: string | number): string {
  const digits = String(count).replace(/[٠-٩]/g, (digit) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
  );
  return `تقسیم مساوی بین ${toPersianDigits(digits)} واحد`;
}

/** Improve historical wording when displaying it; keep issued financial records intact. */
export function formatAllocationBasis(basis: string | null): string | null {
  if (!basis) return basis;
  return toPersianDigits(
    basis.replace(
      /^[1۱١]\s+از\s+([0-9۰-۹٠-٩]+)\s+واحد(?=\s*(?:$|[·؛]))/u,
      (_match, count: string) => perUnitBasis(count),
    ),
  );
}
