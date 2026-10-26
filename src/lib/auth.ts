import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3300";

function trustedOrigins() {
  const origins = new Set(
    (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  origins.add(baseURL);

  const url = new URL(baseURL);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    for (const hostname of ["localhost", "127.0.0.1"]) {
      const localUrl = new URL(baseURL);
      localUrl.hostname = hostname;
      origins.add(localUrl.origin);
    }
  }

  return [...origins];
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: trustedOrigins(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
