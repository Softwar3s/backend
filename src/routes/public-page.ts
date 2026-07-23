/**
 * Public-facing custom page endpoints (no auth required).
 *
 * These are the endpoints the browser hits when a visitor navigates
 * to /giveaways/:slug. They do NOT require an API key.
 *
 * GET  /api/page/:slug       – page meta + active giveaways
 * POST /api/page/:slug/enter – enter a giveaway (name + email + giveawaySlug)
 */

import { Hono } from "hono"
import { z } from "zod"
import { eq, and, desc } from "drizzle-orm"
import * as crypto from "node:crypto"
import db from "../lib/db"
import { giveaway, giveawayEntry, giveawayPage } from "../lib/db/schemas"

const publicPageRoutes = new Hono()

/** GET /api/page/:slug – returns page settings + active giveaways */
publicPageRoutes.get("/page/:slug", async (c) => {
  const slug = c.req.param("slug")

  // Look up page by slug (slug = org slug)
  const [page] = await db
    .select()
    .from(giveawayPage)
    .where(eq(giveawayPage.slug, slug))
    .limit(1)

  if (!page) return c.json({ error: "Page not found" }, 404)
  if (!page.published) return c.json({ error: "Page is not published" }, 404)

  // Fetch active giveaways belonging to the page's org
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
    .where(
      and(eq(giveaway.organizationId, page.organizationId), eq(giveaway.status, "active")),
    )
    .orderBy(desc(giveaway.createdAt))

  return c.json({
    page: {
      title: page.title,
      description: page.description,
      slug: page.slug,
      primaryColor: page.primaryColor,
      backgroundColor: page.backgroundColor,
      textColor: page.textColor,
    },
    giveaways: items,
  })
})

const enterSchema = z.object({
  giveawaySlug: z.string().min(1),
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email is required"),
})

/** POST /api/page/:slug/enter – submit an entry to a specific giveaway */
publicPageRoutes.post("/page/:slug/enter", async (c) => {
  const pageSlug = c.req.param("slug")

  // Resolve the page to get the org ID
  const [page] = await db
    .select({
      id: giveawayPage.id,
      organizationId: giveawayPage.organizationId,
      published: giveawayPage.published,
    })
    .from(giveawayPage)
    .where(eq(giveawayPage.slug, pageSlug))
    .limit(1)

  if (!page || !page.published) return c.json({ error: "Page not found" }, 404)

  const body = await c.req.json()
  const parsed = enterSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0].message }, 400)
  }

  const { giveawaySlug, name, email } = parsed.data

  // Find the giveaway by slug within the page's org
  const [g] = await db
    .select({ id: giveaway.id, status: giveaway.status })
    .from(giveaway)
    .where(
      and(eq(giveaway.organizationId, page.organizationId), eq(giveaway.slug, giveawaySlug)),
    )
    .limit(1)

  if (!g) return c.json({ error: "Giveaway not found" }, 404)
  if (g.status !== "active") return c.json({ error: "Giveaway is not active" }, 400)

  // One entry per email per giveaway
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

export default publicPageRoutes
