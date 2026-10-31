export type ActionFailure = { ok: false; message: string };

/** Expected domain errors must survive Next's production error redaction. */
export async function mutationResult<T>(
  run: () => Promise<T>,
): Promise<T | ActionFailure> {
  try {
    return await run();
  } catch (error) {
    if (
      error instanceof Error &&
      /^[\u0600-\u06ff]/.test(error.message) &&
      !("cause" in error)
    )
      return { ok: false, message: error.message };
    throw error;
  }
}

export function assertActionSuccess(result: unknown): void {
  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    result.ok === false
  )
    throw new Error(
      "message" in result && typeof result.message === "string"
        ? result.message
        : "عملیات انجام نشد.",
    );
}

export function actionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (
    /failed to find server action|server action.*not found|older or newer deployment/i.test(
      message,
    )
  )
    return "نسخهٔ برنامه تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.";
  if (
    /failed to fetch|networkerror|load failed|network request failed/i.test(
      message,
    )
  )
    return "ارتباط قطع شد. پیش از تلاش دوباره، وضعیت آخرین ثبت را بررسی کنید.";
  return /^[\u0600-\u06ff]/.test(message)
    ? message
    : "عملیات انجام نشد. صفحه را تازه کنید؛ اگر مشکل ادامه داشت دوباره وارد حساب شوید.";
}
