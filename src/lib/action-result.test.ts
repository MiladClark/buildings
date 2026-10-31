import { describe, expect, it } from "vitest";
import {
  mutationResult,
  assertActionSuccess,
  actionErrorMessage,
} from "./action-result";

describe("mutation feedback", () => {
  it("serializes an expected business failure and never reports success for it", async () => {
    const result = await mutationResult(async () => {
      throw new Error("این هزینه پرداخت فعال دارد؛ ابتدا آن را بررسی کنید.");
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual({
      ok: false,
      message: "این هزینه پرداخت فعال دارد؛ ابتدا آن را بررسی کنید.",
    });
    expect(() => assertActionSuccess(result)).toThrow("پرداخت فعال");
  });
  it("does not expose database or framework errors as business failures", async () => {
    await expect(
      mutationResult(async () => {
        throw new Error("database connection credentials");
      }),
    ).rejects.toThrow("database");
    expect(
      actionErrorMessage(
        new Error(
          "An error occurred in the Server Components render with digest",
        ),
      ),
    ).not.toContain("digest");
    expect(
      actionErrorMessage(new Error("Failed to find Server Action abc")),
    ).toContain("نسخهٔ برنامه");
    expect(actionErrorMessage(new Error("Failed to fetch"))).toContain(
      "وضعیت آخرین ثبت",
    );
  });
  it("accepts successful void and value actions", async () => {
    expect(await mutationResult(async () => "saved-id")).toBe("saved-id");
    expect(() => assertActionSuccess(undefined)).not.toThrow();
  });
});
