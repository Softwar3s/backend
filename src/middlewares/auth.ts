/**
 * Session-based auth middlewares using Better Auth.
 *
 * attachSession – attaches user/session to context if available (non-blocking)
 * requireAuth   – returns 401 if not authenticated (blocking)
 */

import auth from "../lib/auth";
import { createMiddleware } from "hono/factory";

export type AuthVariables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

/** Attaches user + session to context. Does NOT block unauthenticated requests. */
export const attachSession = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      c.set("user", null);
      c.set("session", null);
      return next();
    }

    c.set("user", session.user);
    c.set("session", session.session);
    return next();
  },
);

/** Blocks unauthenticated requests with a 401 response. */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("user", session.user);
    c.set("session", session.session);
    return next();
  },
);
