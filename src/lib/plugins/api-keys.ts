import { createAuthEndpoint, getSessionFromCtx } from "better-auth/api"
import { APIError } from "better-auth/api"
import { eq, and } from "drizzle-orm"
import { z } from "zod"
import * as crypto from "node:crypto"
import db from "../db"
import { apiKey, member } from "../db/schemas"

function generateKey(): { key: string; hash: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString("hex")
  const key = `sk_org_${raw.slice(0, 8)}${raw.slice(8)}`
  const hash = crypto.createHash("sha256").update(key).digest("hex")
  const prefix = key.slice(0, "sk_org_".length + 8)
  return { key, hash, prefix }
}

async function requireOrgMember(ctx: any) {
  const session = await getSessionFromCtx(ctx)
  if (!session) {
    throw new APIError("UNAUTHORIZED", { message: "Not authenticated" })
  }
  const orgId = session.session.activeOrganizationId
  if (!orgId) {
    throw new APIError("BAD_REQUEST", { message: "No active organization" })
  }
  const [orgMember] = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.userId, session.user.id),
        eq(member.organizationId, orgId),
      ),
    )
    .limit(1)
  if (!orgMember) {
    throw new APIError("FORBIDDEN", { message: "Not a member of this organization" })
  }
  return { session, orgId }
}

export const apiKeysPlugin = () => ({
  id: "api-keys",
  endpoints: {
    listApiKeys: createAuthEndpoint(
      "/api-keys/list",
      {
        method: "GET",
        metadata: {
          openapi: {
            operationId: "listApiKeys",
            description: "List all API keys for the active organization",
          },
        },
      },
      async (ctx) => {
        const { orgId } = await requireOrgMember(ctx)
        const keys = await db
          .select({
            id: apiKey.id,
            name: apiKey.name,
            keyPrefix: apiKey.keyPrefix,
            domain: apiKey.domain,
            lastUsedAt: apiKey.lastUsedAt,
            createdAt: apiKey.createdAt,
          })
          .from(apiKey)
          .where(eq(apiKey.organizationId, orgId))
          .orderBy(apiKey.createdAt)
        return ctx.json(keys)
      },
    ),
    createApiKey: createAuthEndpoint(
      "/api-keys/create",
      {
        method: "POST",
        body: z.object({
          name: z.string().min(1).max(100),
          domain: z.string().max(255).optional().default(""),
        }),
        metadata: {},
      },
      async (ctx) => {
        const { orgId, session } = await requireOrgMember(ctx)
        const { name, domain } = ctx.body
        const { key, hash, prefix } = generateKey()
        const [created] = await db
          .insert(apiKey)
          .values({
            id: crypto.randomUUID(),
            name,
            keyHash: hash,
            keyPrefix: prefix,
            domain,
            organizationId: orgId,
            userId: session.user.id,
          })
          .returning()
        return ctx.json({ ...created, key })
      },
    ),
    deleteApiKey: createAuthEndpoint(
      "/api-keys/delete",
      {
        method: "POST",
        body: z.object({ id: z.string() }),
        metadata: {},
      },
      async (ctx) => {
        const { orgId } = await requireOrgMember(ctx)
        const { id } = ctx.body
        const [existing] = await db
          .select({ id: apiKey.id })
          .from(apiKey)
          .where(
            and(eq(apiKey.id, id), eq(apiKey.organizationId, orgId)),
          )
          .limit(1)
        if (!existing) {
          throw new APIError("NOT_FOUND", { message: "API key not found" })
        }
        await db.delete(apiKey).where(eq(apiKey.id, id))
        return ctx.json({ success: true })
      },
    ),
  },
})
