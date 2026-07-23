/**
 * Giveaway CRUD routes (session-auth required).
 *
 * All endpoints require a valid user session and an active organization.
 * Scoped to the active org – users can only manage their own org's giveaways.
 *
 * GET    /api/giveaways          – list all giveaways for the active org
 * GET    /api/giveaways/stats    – aggregate stats (total, active, draft, ended)
 * GET    /api/giveaways/:id      – single giveaway detail
 * POST   /api/giveaways          – create a new giveaway
 * PUT    /api/giveaways/:id      – update a giveaway
 * DELETE /api/giveaways/:id      – delete a giveaway
 * GET    /api/giveaways/:id/entries – list entries for a giveaway
 */

import { Hono } from "hono"
import { eq, and, desc } from "drizzle-orm"
import * as crypto from "node:crypto"
import db from "../lib/db"
import { giveaway, giveawayEntry, member } from "../lib/db/schemas"
import { requireAuth, type AuthVariables } from "../middlewares/auth"

const giveawaysRoutes = new Hono<{ Variables: AuthVariables }>()

/**
 * Helper: ensures the request comes from a member of the active org.
 * Returns the orgId string on success, or a Response (error JSON) on failure.
 */
async function requireOrgMember(c: any) {
  const user = c.get("user")
  const session = c.get("session")
  if (!user || !session) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  const orgId = session.activeOrganizationId
  if (!orgId) {
    return c.json({ error: "No active organization" }, 400)
  }
  const [mem] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, user.id), eq(member.organizationId, orgId)))
    .limit(1)
  if (!mem) {
    return c.json({ error: "Not a member of this organization" }, 403)
  }
  return orgId
}

/** GET /api/giveaways – list all giveaways for the active org with entry counts */
giveawaysRoutes.get("/giveaways", requireAuth, async (c) => {
  const orgId = await requireOrgMember(c)
  if (typeof orgId !== "string") return orgId

  const items = await db
    .select({
      id: giveaway.id,
      name: giveaway.name,
      slug: giveaway.slug,
      description: giveaway.description,
      image: giveaway.image,
      endTime: giveaway.endTime,
      timezone: giveaway.timezone,
      status: giveaway.status,
      createdAt: giveaway.createdAt,
    })
    .from(giveaway)
    .where(eq(giveaway.organizationId, orgId))
    .orderBy(desc(giveaway.createdAt))

  // Fetch entry counts in parallel to avoid N+1 via subquery
  const entryCounts = await Promise.all(
    items.map((g) =>
      db.$count(giveawayEntry, eq(giveawayEntry.giveawayId, g.id)).then((c) => ({ id: g.id, count: c })),
    ),
  )
  const countMap = Object.fromEntries(entryCounts.map((e) => [e.id, e.count]))

  return c.json({
    giveaways: items.map((g) => ({ ...g, entryCount: countMap[g.id] || 0 })),
  })
})

/** GET /api/giveaways/stats – aggregate stats for the active org */
giveawaysRoutes.get("/giveaways/stats", requireAuth, async (c) => {
  const orgId = await requireOrgMember(c)
  if (typeof orgId !== "string") return orgId

  const all = await db
    .select({ status: giveaway.status })
    .from(giveaway)
    .where(eq(giveaway.organizationId, orgId))

  const total = all.length
  const active = all.filter((g) => g.status === "active").length
  const draft = all.filter((g) => g.status === "draft").length
  const ended = all.filter((g) => g.status === "ended").length

  return c.json({ total, active, draft, ended })
})

/** GET /api/giveaways/:id – single giveaway by ID (scoped to org) */
giveawaysRoutes.get("/giveaways/:id", requireAuth, async (c) => {
  const orgId = await requireOrgMember(c)
  if (typeof orgId !== "string") return orgId

  const id = c.req.param("id")
  const [item] = await db
    .select()
    .from(giveaway)
    .where(and(eq(giveaway.id, id), eq(giveaway.organizationId, orgId)))
    .limit(1)

  if (!item) return c.json({ error: "Giveaway not found" }, 404)
  return c.json({ giveaway: item })
})

/** POST /api/giveaways – create a new giveaway (auto-generates slug from name) */
giveawaysRoutes.post("/giveaways", requireAuth, async (c) => {
  const orgId = await requireOrgMember(c)
  if (typeof orgId !== "string") return orgId

  const body = await c.req.json()
  const { name, slug, description, image, endTime, timezone } = body

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return c.json({ error: "Name is required" }, 400)
  }
  if (!endTime || typeof endTime !== "string") {
    return c.json({ error: "End time is required" }, 400)
  }

  // Auto-generate a URL-safe slug if none provided
  const giveawaySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  // Slug must be unique within the org
  const [existing] = await db
    .select({ id: giveaway.id })
    .from(giveaway)
    .where(and(eq(giveaway.organizationId, orgId), eq(giveaway.slug, giveawaySlug)))
    .limit(1)

  if (existing) {
    return c.json({ error: "A giveaway with this slug already exists" }, 409)
  }

  const [created] = await db
    .insert(giveaway)
    .values({
      id: crypto.randomUUID(),
      name: name.trim(),
      slug: giveawaySlug,
      description: description || "",
      image: image || null,
      endTime: new Date(endTime),
      timezone: timezone || "UTC",
      status: "draft",
      organizationId: orgId,
    })
    .returning()

  return c.json({ giveaway: created }, 201)
})

/** PUT /api/giveaways/:id – partial update of a giveaway */
giveawaysRoutes.put("/giveaways/:id", requireAuth, async (c) => {
  const orgId = await requireOrgMember(c)
  if (typeof orgId !== "string") return orgId

  const id = c.req.param("id")
  const [existing] = await db
    .select({ id: giveaway.id })
    .from(giveaway)
    .where(and(eq(giveaway.id, id), eq(giveaway.organizationId, orgId)))
    .limit(1)

  if (!existing) return c.json({ error: "Giveaway not found" }, 404)

  const body = await c.req.json()
  const updates: Record<string, any> = {}

  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.slug !== undefined) updates.slug = body.slug
  if (body.description !== undefined) updates.description = body.description
  if (body.image !== undefined) updates.image = body.image
  if (body.endTime !== undefined) updates.endTime = new Date(body.endTime)
  if (body.timezone !== undefined) updates.timezone = body.timezone
  if (body.status !== undefined) updates.status = body.status

  const [updated] = await db
    .update(giveaway)
    .set(updates)
    .where(eq(giveaway.id, id))
    .returning()

  return c.json({ giveaway: updated })
})

/** DELETE /api/giveaways/:id – permanently delete a giveaway (cascades entries) */
giveawaysRoutes.delete("/giveaways/:id", requireAuth, async (c) => {
  const orgId = await requireOrgMember(c)
  if (typeof orgId !== "string") return orgId

  const id = c.req.param("id")
  const [existing] = await db
    .select({ id: giveaway.id })
    .from(giveaway)
    .where(and(eq(giveaway.id, id), eq(giveaway.organizationId, orgId)))
    .limit(1)

  if (!existing) return c.json({ error: "Giveaway not found" }, 404)

  await db.delete(giveaway).where(eq(giveaway.id, id))
  return c.json({ success: true })
})

/** GET /api/giveaways/:id/entries – list all entries for a giveaway (newest first) */
giveawaysRoutes.get("/giveaways/:id/entries", requireAuth, async (c) => {
  const orgId = await requireOrgMember(c)
  if (typeof orgId !== "string") return orgId

  const id = c.req.param("id")
  const [g] = await db
    .select({ id: giveaway.id })
    .from(giveaway)
    .where(and(eq(giveaway.id, id), eq(giveaway.organizationId, orgId)))
    .limit(1)

  if (!g) return c.json({ error: "Giveaway not found" }, 404)

  const entries = await db
    .select()
    .from(giveawayEntry)
    .where(eq(giveawayEntry.giveawayId, id))
    .orderBy(desc(giveawayEntry.createdAt))

  return c.json({ entries, total: entries.length })
})

export default giveawaysRoutes
