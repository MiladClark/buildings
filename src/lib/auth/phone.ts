const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

/** Persian and Arabic-Indic digits become ASCII digits. Other characters stay. */
export function latinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
}

const arabicScript =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export const englishPasswordMessage = "رمز عبور باید فقط با حروف انگلیسی باشد.";

/** Digits may be Persian; letters may not. Persian digits are already ASCII here. */
export function englishPassword(value: string) {
  const password = latinDigits(value);
  if (arabicScript.test(password)) throw new Error(englishPasswordMessage);
  return password;
}

/** Rewrite a field in place so Persian digits show as English while typing. */
export function writeLatinDigits(input: HTMLInputElement) {
  const next = latinDigits(input.value);
  if (next === input.value) return;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.value = next;
  if (start !== null && end !== null) input.setSelectionRange(start, end);
}

/** Internal mailbox so better-auth can keep an email column without showing it. */
export function phoneToAuthEmail(phone: string) {
  return `${phone}@residents.internal`;
}

// Contacts copied from RTL apps can include invisible direction markers.
function compactPhone(value: string) {
  return latinDigits(value).replace(
    /[\s().\-\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g,
    "",
  );
}

function phoneEdit(value: string) {
  const compact = compactPhone(value);
  // Wait for the mobile prefix so typing +98 / 0098 remains possible.
  const prefix = compact.match(/^(?:\+98|0098|98)0?(?=9)/)?.[0];
  const removed = prefix?.length ?? 0;
  const added = prefix || /^9\d{9}$/.test(compact) ? "0" : "";
  return { compact, removed, added, value: added + compact.slice(removed) };
}

/** Format incomplete input without throwing or silently discarding invalid text. */
export function formatIranMobileInput(value: string) {
  return phoneEdit(value).value;
}

/** Normalize typing/paste in place, keeping the caret near the edited digits. */
export function writeIranMobile(input: HTMLInputElement) {
  const original = input.value;
  const edit = phoneEdit(original);
  if (edit.value === original) return;
  const mapPosition = (position: number) => {
    const compactPosition = compactPhone(original.slice(0, position)).length;
    return compactPosition <= edit.removed
      ? Math.min(compactPosition, edit.added.length)
      : compactPosition - edit.removed + edit.added.length;
  };
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const direction = input.selectionDirection;
  input.value = edit.value;
  if (start !== null && end !== null)
    input.setSelectionRange(
      mapPosition(start),
      mapPosition(end),
      direction ?? undefined,
    );
}

export function normalizeIranMobile(value: string) {
  const local = formatIranMobileInput(value);
  if (!/^09\d{9}$/.test(local))
    throw new Error("شماره تلفن را به صورت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید.");
  return local;
}

/** A registration choice is only a building unit numbered 1 through 8. */
export function registrationUnitNumber(label: string) {
  const compact = latinDigits(label).trim();
  const digits = compact.replace(/\D/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  if (value < 1 || value > 8) return null;
  return value;
}

/** Email accounts stay as typed. A phone becomes the internal mailbox. */
export function loginToEmail(value: string) {
  const trimmed = latinDigits(value).trim();
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
 * A prepared account must use the manager's unit when one was assigned.
 * If the manager left the unit empty, the resident's choice is stored.
 */
export function claimedUnitId(
  hasShell: boolean,
  selectedUnitId: string,
  shellUnitId: string | null,
) {
  if (!hasShell) return null;
  const selected = selectedUnitId.trim();
  if (!selected || (shellUnitId && selected !== shellUnitId))
    throw new Error(
      "شماره تلفن و واحد باید با اطلاعات ثبت‌شده توسط مدیر مطابقت داشته باشند.",
    );
  return shellUnitId ?? selected;
}
