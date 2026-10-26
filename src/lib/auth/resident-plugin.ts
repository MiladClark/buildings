import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  sessionMiddleware,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import {
  connectGoogleResident,
  ResidentConnectionError,
} from "./google-resident";

export const residentConnection = () =>
  ({
    id: "resident-connection",
    endpoints: {
      completeGoogleResident: createAuthEndpoint(
        "/resident/complete-google",
        {
          method: "POST",
          body: z.object({
            phone: z.string().min(1).max(40),
            unitId: z.string().min(1).max(100),
            firstName: z.string().max(60).optional(),
            lastName: z.string().max(60).optional(),
          }),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          try {
            const connected = await connectGoogleResident({
              ...ctx.body,
              userId: ctx.context.session.user.id,
              sessionToken: ctx.context.session.session.token,
            });
            await setSessionCookie(ctx, connected);
            return ctx.json({ ok: true });
          } catch (error) {
            if (error instanceof ResidentConnectionError)
              throw new APIError("BAD_REQUEST", {
                code: error.code,
                message: error.message,
              });
            if (error instanceof Error && /[\u0600-\u06FF]/.test(error.message))
              throw new APIError("BAD_REQUEST", { message: error.message });
            throw error;
          }
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path) => path === "/resident/complete-google",
        window: 60,
        max: 5,
      },
    ],
  }) satisfies BetterAuthPlugin;
