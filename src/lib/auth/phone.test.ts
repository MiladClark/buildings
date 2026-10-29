import { describe, expect, it } from "vitest";
import {
  claimedDisplayName,
  claimedUnitId,
  joinedPersonName,
  latinDigits,
  englishPassword,
  loginToEmail,
  normalizeIranMobile,
  phoneToAuthEmail,
  registrationUnitNumber,
} from "./phone";

describe("registration units", () => {
  it("keeps only units numbered 1 through 8", () => {
    expect(registrationUnitNumber("1")).toBe(1);
    expect(registrationUnitNumber("۸")).toBe(8);
    expect(registrationUnitNumber("واحد ۶")).toBe(6);
    expect(registrationUnitNumber("  03 ")).toBe(3);
    for (const label of ["", "۹", "10", "انباری", "۱۲"])
      expect(registrationUnitNumber(label)).toBeNull();
  });
});

describe("Iranian mobile numbers", () => {
  it.each([
    "09123456789",
    "۰۹۱۲۳۴۵۶۷۸۹",
    "٠٩١٢٣٤٥٦٧٨٩",
    "0912 345 6789",
    "0912-345-6789",
    "+989123456789",
    "00989123456789",
    "989123456789",
    "9123456789",
  ])("stores %s as 09123456789", (input) => {
    expect(normalizeIranMobile(input)).toBe("09123456789");
  });

  it("rejects numbers that are not an Iranian mobile", () => {
    expect(() => normalizeIranMobile("02112345678")).toThrow(/۰۹۱۲/);
    expect(() => normalizeIranMobile("")).toThrow(/۰۹۱۲/);
    expect(() => normalizeIranMobile("091234567")).toThrow(/۰۹۱۲/);
  });

  it("maps a phone to a hidden mailbox and leaves real emails unchanged", () => {
    expect(phoneToAuthEmail("09123456789")).toBe(
      "09123456789@residents.internal",
    );
    expect(loginToEmail("  Manager@Preview.Local ")).toBe(
      "manager@preview.local",
    );
    expect(loginToEmail("۰۹۱۲۳۴۵۶۷۸۹")).toBe("09123456789@residents.internal");
    expect(loginToEmail("User۱۲@Example.com")).toBe("user12@example.com");
    expect(latinDigits("رمز۱۲۳٤")).toBe("رمز1234");
  });

  it("rejects Persian letters in a password and keeps English digits", () => {
    expect(englishPassword("Secret۱۲۳")).toBe("Secret123");
    expect(() => englishPassword("رمز۱۲۳")).toThrow(/انگلیسی/);
  });
});

describe("claiming a manager-created account", () => {
  it("joins optional names and keeps a typed registration name", () => {
    expect(joinedPersonName("  رضا ", "")).toBe("رضا");
    expect(joinedPersonName("رضا", "پاکدامن")).toBe("رضا پاکدامن");
    expect(claimedDisplayName("علی", "مهمان")).toBe("علی");
    expect(claimedDisplayName("  ", "مهمان")).toBe("مهمان");
  });

  it("requires the manager's exact unit for a prepared phone", () => {
    expect(claimedUnitId(true, "unit-a", "unit-a")).toBe("unit-a");
    expect(() => claimedUnitId(true, "unit-b", "unit-a")).toThrow();
    expect(() => claimedUnitId(true, "", "unit-a")).toThrow();
    expect(() => claimedUnitId(true, "  ", null)).toThrow();
    expect(claimedUnitId(true, "unit-b", null)).toBe("unit-b");
    expect(claimedUnitId(false, "unit-b", null)).toBeNull();
  });
});
