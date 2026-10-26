const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

/** Internal mailbox so better-auth can keep an email column without showing it. */
export function phoneToAuthEmail(phone: string) {
  return `${phone}@residents.internal`;
}

export function normalizeIranMobile(value: string) {
  const compact = value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[\s().-]/g, "");
  if (!compact || compact.length > 16)
    throw new Error("شماره تلفن را به صورت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.");

  let local = compact;
  if (local.startsWith("+")) local = local.slice(1);
  if (local.startsWith("0098")) local = `0${local.slice(4)}`;
  else if (local.startsWith("98")) local = `0${local.slice(2)}`;
  else if (/^9\d{9}$/.test(local)) local = `0${local}`;

  if (!/^09\d{9}$/.test(local))
    throw new Error("شماره تلفن را به صورت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.");
  return local;
}

/** Email accounts stay as typed. A phone becomes the internal mailbox. */
export function loginToEmail(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return phoneToAuthEmail(normalizeIranMobile(trimmed));
}

export function joinedPersonName(firstName: string, lastName: string) {
  return [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

/** A name typed at registration replaces the manager's label. An empty name keeps it. */
export function claimedDisplayName(typedName: string, existingName: string) {
  const typed = typedName.trim();
  return typed || existingName;
}

/**
 * Unit choice applies only to a phone the manager already created.
 * An empty choice keeps the manager's unit.
 */
export function claimedUnitId(
  hasShell: boolean,
  selectedUnitId: string,
  shellUnitId: string | null,
) {
  if (!hasShell) return null;
  const selected = selectedUnitId.trim();
  if (selected) return selected;
  return shellUnitId;
}
