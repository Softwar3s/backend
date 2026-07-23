/**
 * Public giveaway API – for external integrations (WordPress plugin, etc.).
 *
 * All endpoints require a valid API key (x-api-key header).
 * Scoped to the organization that owns the API key.
 *
 * These are server-to-server endpoints. The public-facing custom page
 * uses a separate set of unauthenticated endpoints (see public-page.ts).
 *
 * GET  /api/public/giveaways          – list giveaways (filter by ?status=)
 * GET  /api/public/giveaways/:slug    – single giveaway by slug
 * POST /api/public/giveaways/:slug/enter – enter a giveaway (name + email)
 * GET  /api/public/page/:slug         – custom page data + giveaways
 */

import { Hono } from "hono"
import { z } from "zod"
import { eq, and, desc } from "drizzle-orm"
import * as crypto from "node:crypto"
import db from "../lib/db"
import { giveaway, giveawayEntry, giveawayPage } from "../lib/db/schemas"
import { requireApiKey, type ApiKeyVariables } from "../middlewares/api-key"

const publicRoutes = new Hono<{ Variables: ApiKeyVariables }>()

/** GET /api/public/giveaways – list giveaways (default: active) */
publicRoutes.get("/public/giveaways", requireApiKey, async (c) => {
  const orgId = c.get("apiKeyOrgId")
  const status = c.req.query("status") || "active"

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
    .where(and(eq(giveaway.organizationId, orgId), eq(giveaway.status, status)))
    .orderBy(desc(giveaway.createdAt))

  return c.json({ giveaways: items })
})

/** GET /api/public/giveaways/:slug – single giveaway by slug */
publicRoutes.get("/public/giveaways/:slug", requireApiKey, async (c) => {
  const orgId = c.get("apiKeyOrgId")
  const slug = c.req.param("slug")

  const [item] = await db
    .select()
    .from(giveaway)
    .where(and(eq(giveaway.organizationId, orgId), eq(giveaway.slug, slug)))
    .limit(1)

  if (!item) return c.json({ error: "Giveaway not found" }, 404)
  return c.json({ giveaway: item })
})

const enterSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email is required"),
})

/** POST /api/public/giveaways/:slug/enter – submit an entry (name + email) */
publicRoutes.post("/public/giveaways/:slug/enter", requireApiKey, async (c) => {
  const orgId = c.get("apiKeyOrgId")

  const slug = c.req.param("slug")
  const [g] = await db
    .select({ id: giveaway.id, status: giveaway.status })
    .from(giveaway)
    .where(and(eq(giveaway.organizationId, orgId), eq(giveaway.slug, slug)))
    .limit(1)

  if (!g) return c.json({ error: "Giveaway not found" }, 404)
  if (g.status !== "active") return c.json({ error: "Giveaway is not active" }, 400)

  const body = await c.req.json()
  const parsed = enterSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400)
  }

  const { name, email } = parsed.data

  // Prevent duplicate entries by email
  const [existing] = await db
    .select({ id: giveawayEntry.id })
    .from(giveawayEntry)
    .where(and(eq(giveawayEntry.giveawayId, g.id), eq(giveawayEntry.email, email)))
    .limit(1)

  if (existing) {
    return c.json({ error: "This email has already entered this giveaway" }, 409)
  }

  const [entry] = await db
    .insert(giveawayEntry)
    .values({
      id: crypto.randomUUID(),
      giveawayId: g.id,
      name,
      email,
    })
    .returning()

  return c.json({ entry }, 201)
})

/**
 * GET /api/public/page/:slug – custom page data + active giveaways.
 * Requires API key (for WordPress plugin integration).
 * The public-facing page uses a different unauthenticated endpoint.
 */
publicRoutes.get("/public/page/:slug", requireApiKey, async (c) => {
  const orgId = c.get("apiKeyOrgId")
  const slug = c.req.param("slug")

  const [page] = await db
    .select()
    .from(giveawayPage)
    .where(and(eq(giveawayPage.organizationId, orgId), eq(giveawayPage.slug, slug)))
    .limit(1)

  if (!page) return c.json({ error: "Page not found" }, 404)
  if (!page.published) return c.json({ error: "Page is not published" }, 404)

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
    })
    .from(giveaway)
    .where(and(eq(giveaway.organizationId, orgId), eq(giveaway.status, "active")))
    .orderBy(desc(giveaway.createdAt))

  return c.json({
    page: {
      title: page.title,
      description: page.description,
      slug: page.slug,
    },
    giveaways: items,
  })
})

export default publicRoutes
