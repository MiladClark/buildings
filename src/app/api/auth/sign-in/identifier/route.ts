import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import {
  englishPassword,
  latinDigits,
  loginToEmail,
  normalizeIranMobile,
} from "@/lib/auth/phone";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { isSameOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request))
    return Response.json(
      { message: "درخواست ورود معتبر نیست." },
      { status: 403 },
    );
  let input: { identifier?: unknown; password?: unknown };
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { message: "اطلاعات ورود معتبر نیست." },
      { status: 400 },
    );
  }
  if (
    !input ||
    typeof input.identifier !== "string" ||
    input.identifier.length > 254 ||
    typeof input.password !== "string" ||
    input.password.length > 200
  ) {
    return Response.json(
      { message: "اطلاعات ورود معتبر نیست." },
      { status: 400 },
    );
  }
  const identifier = latinDigits(input.identifier);
  let password: string;
  try {
    password = englishPassword(input.password);
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "رمز عبور باید فقط با حروف انگلیسی باشد.",
      },
      { status: 400 },
    );
  }
  let email: string;
  try {
    email = loginToEmail(identifier);
    if (!identifier.includes("@")) {
      const found = await db.query.user.findFirst({
        where: eq(user.phone, normalizeIranMobile(identifier)),
      });
      if (found) email = found.email;
    }
  } catch {
    return Response.json(
      { message: "شماره تلفن یا ایمیل معتبر نیست." },
      { status: 400 },
    );
  }
  // Reuse Better Auth's full handler, including rate limits, CSRF and signed cookies.
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return auth.handler(
    new Request(new URL("/api/auth/sign-in/email", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    }),
  );
}
