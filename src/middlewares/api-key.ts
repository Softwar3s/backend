/**
 * API Key authentication middleware.
 *
 * Validates the `x-api-key` header by SHA-256 hashing it and
 * matching against stored hashes in the api_key table.
 * On success it sets `c.var.apiKeyOrgId` for downstream handlers.
 */

import { createMiddleware } from "hono/factory"
import { eq } from "drizzle-orm"
import * as crypto from "node:crypto"
import db from "../lib/db"
import { apiKey } from "../lib/db/schemas"

export type ApiKeyVariables = {
  apiKeyOrgId: string
}

export const requireApiKey = createMiddleware<{ Variables: ApiKeyVariables }>(
  async (c, next) => {
    const key = c.req.header("x-api-key")

    if (!key) {
      return c.json({ error: "Missing API key. Provide it via x-api-key header." }, 401)
    }

    // Hash the provided key the same way it was stored
    const hash = crypto.createHash("sha256").update(key).digest("hex")

    const [found] = await db
      .select({ id: apiKey.id, organizationId: apiKey.organizationId })
      .from(apiKey)
      .where(eq(apiKey.keyHash, hash))
      .limit(1)

    if (!found) {
      return c.json({ error: "Invalid API key" }, 401)
    }

    // Touch lastUsedAt so org admins can see key activity
    await db
      .update(apiKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKey.id, found.id))

    c.set("apiKeyOrgId", found.organizationId)
    return next()
  },
)
