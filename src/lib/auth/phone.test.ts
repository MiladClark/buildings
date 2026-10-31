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
  formatIranMobileInput,
  writeIranMobile,
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
    "+۹۸ (۹۱۲) ۳۴۵-۶۷۸۹",
    "+98 (0) 912 345 6789",
    "۰۰۹۸۰۹۱۲۳۴۵۶۷۸۹",
    "\u200e+98\u00a0912\u200f 345 6789\u202c",
  ])("stores %s as 09123456789", (input) => {
    expect(normalizeIranMobile(input)).toBe("09123456789");
  });

  it("rejects numbers that are not an Iranian mobile", () => {
    expect(() => normalizeIranMobile("02112345678")).toThrow(/۰۹۱۲/);
    expect(() => normalizeIranMobile("")).toThrow(/۰۹۱۲/);
    expect(() => normalizeIranMobile("091234567")).toThrow(/۰۹۱۲/);
    expect(() => normalizeIranMobile("+449123456789")).toThrow(/۰۹۱۲/);
    expect(() => normalizeIranMobile("091234567890")).toThrow(/۰۹۱۲/);
    expect(() => normalizeIranMobile("0912abc3456789")).toThrow(/۰۹۱۲/);
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

describe("live phone entry", () => {
  it.each([
    ["", ""],
    ["۰۹۱", "091"],
    ["٠٩١٢", "0912"],
    ["+", "+"],
    ["+98", "+98"],
    ["0098", "0098"],
    ["+۹۸ ۹", "09"],
    ["۰۰۹۸۹", "09"],
    ["98912", "0912"],
    ["+98 912 641 4551", "09126414551"],
    ["۹۱۲۶۴۱۴۵۵۱", "09126414551"],
    ["+44 912 641 4551", "+449126414551"],
    ["0912abc", "0912abc"],
    ["091264145511", "091264145511"],
  ])(
    "formats %j as %j without requiring a complete number",
    (input, expected) => {
      expect(formatIranMobileInput(input)).toBe(expected);
      expect(formatIranMobileInput(expected)).toBe(expected);
    },
  );

  function field(value: string, start = value.length, end = start) {
    const input = {
      value,
      selectionStart: start,
      selectionEnd: end,
      selectionDirection: "none",
      setSelectionRange(nextStart: number, nextEnd: number) {
        input.selectionStart = nextStart;
        input.selectionEnd = nextEnd;
      },
    };
    return input;
  }

  it("normalizes a paste and leaves the caret at the end", () => {
    const input = field("\u200e+۹۸ (۹۱۲) ۶۴۱-۴۵۵۱");
    writeIranMobile(input as unknown as HTMLInputElement);
    expect(input.value).toBe("09126414551");
    expect(input.selectionStart).toBe(11);
    expect(input.selectionEnd).toBe(11);
  });

  it("keeps the selection beside the same digits when editing in the middle", () => {
    const input = field("+۹۸ ۹۱۲ ۶۴۱ ۴۵۵۱", 8, 11);
    writeIranMobile(input as unknown as HTMLInputElement);
    expect(input.value).toBe("09126414551");
    expect(input.selectionStart).toBe(4);
    expect(input.selectionEnd).toBe(7);
  });

  it.each(["+989126414551", "00989126414551", "989126414551", "۰۹۱۲۶۴۱۴۵۵۱"])(
    "supports entering %s one character at a time, clearing and replacing it",
    (text) => {
      const input = field("");
      for (const character of text) {
        input.value += character;
        input.selectionStart = input.selectionEnd = input.value.length;
        writeIranMobile(input as unknown as HTMLInputElement);
      }
      expect(input.value).toBe("09126414551");
      input.value = "";
      writeIranMobile(input as unknown as HTMLInputElement);
      expect(input.value).toBe("");
      input.value = "٠٩١٢٣٤٥٦٧٨٩";
      writeIranMobile(input as unknown as HTMLInputElement);
      expect(input.value).toBe("09123456789");
    },
  );
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
