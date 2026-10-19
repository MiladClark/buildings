import { describe, expect, it } from "vitest";
import { invoiceRecipient } from "./invoice-recipient";

describe("invoice recipient", () => {
  it("uses the registered tenant and trims accidental whitespace", () => {
    expect(
      invoiceRecipient({
        status: "occupied",
        tenantName: "  علی رضایی  ",
        ownerName: "مالک",
      }),
    ).toEqual({ name: "علی رضایی", label: "نام ساکن" });
  });
  it("uses the owner for an owner-occupied unit, ignoring a former tenant", () => {
    expect(
      invoiceRecipient({
        status: "owner_occupied",
        tenantName: "مستأجر قبلی",
        ownerName: "مریم کریمی",
      }),
    ).toEqual({ name: "مریم کریمی", label: "نام ساکن" });
  });
  it("identifies the owner of a vacant unit rather than a former resident", () => {
    expect(
      invoiceRecipient({
        status: "empty",
        tenantName: "مستأجر قبلی",
        ownerName: "رضا احمدی",
      }),
    ).toEqual({ name: "رضا احمدی", label: "نام مالک" });
  });
  it("labels an owner fallback accurately when the tenant name is missing", () => {
    expect(
      invoiceRecipient({
        status: "occupied",
        tenantName: "  ",
        ownerName: "رضا احمدی",
      }),
    ).toEqual({ name: "رضا احمدی", label: "نام مالک" });
  });
  it("leaves a missing name empty instead of substituting a former tenant", () => {
    expect(
      invoiceRecipient({ status: "empty", tenantName: "مستأجر قبلی" }).name,
    ).toBeNull();
  });
});
