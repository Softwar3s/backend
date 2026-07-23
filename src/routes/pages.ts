/**
 * Custom page settings routes (session-auth required).
 *
 * Each organization can have one custom giveaway page.
 * The slug is auto-set from the organization slug.
 *
 * GET /api/giveaway-page – get the current org's page settings (or null)
 * PUT /api/giveaway-page – create or update the page settings
 */

import { Hono } from "hono"
import { eq, and } from "drizzle-orm"
import * as crypto from "node:crypto"
import db from "../lib/db"
import { giveawayPage, member, organization } from "../lib/db/schemas"
import { requireAuth, type AuthVariables } from "../middlewares/auth"

const pagesRoutes = new Hono<{ Variables: AuthVariables }>()

/**
 * Helper: ensures the request comes from a member of the active org.
 * Returns orgId on success, Response on failure.
 */
async function requireOrgMember(c: any) {
  const user = c.get("user")
  const session = c.get("session")
  if (!user || !session) return c.json({ error: "Unauthorized" }, 401)
  const orgId = session.activeOrganizationId
  if (!orgId) return c.json({ error: "No active organization" }, 400)
  const [mem] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, user.id), eq(member.organizationId, orgId)))
    .limit(1)
  if (!mem) return c.json({ error: "Not a member" }, 403)
  return orgId
}

/** GET /api/giveaway-page – returns the org's custom page config (or null) */
pagesRoutes.get("/giveaway-page", requireAuth, async (c) => {
  const orgId = await requireOrgMember(c)
  if (typeof orgId !== "string") return orgId

  const [page] = await db
    .select()
    .from(giveawayPage)
    .where(eq(giveawayPage.organizationId, orgId))
    .limit(1)

  return c.json({ page: page || null })
})

/**
 * PUT /api/giveaway-page – creates or updates the org's custom page.
 * If no slug is provided, falls back to the org slug.
 */
pagesRoutes.put("/giveaway-page", requireAuth, async (c) => {
  const orgId = await requireOrgMember(c)
  if (typeof orgId !== "string") return orgId

  const body = await c.req.json()
  const { slug, title, description, primaryColor, backgroundColor, textColor, customDomain, published } = body

  // Check if a page already exists for this org
  const [existing] = await db
    .select({ id: giveawayPage.id })
    .from(giveawayPage)
    .where(eq(giveawayPage.organizationId, orgId))
    .limit(1)

  if (existing) {
    // Update existing page
    if (slug) {
      const [dup] = await db
        .select({ id: giveawayPage.id })
        .from(giveawayPage)
        .where(and(eq(giveawayPage.slug, slug), eq(giveawayPage.organizationId, orgId)))
        .limit(1)
      if (dup && dup.id !== existing.id) {
        return c.json({ error: "Slug already taken" }, 409)
      }
    }

    const updates: Record<string, any> = {}
    if (slug !== undefined) updates.slug = slug
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (primaryColor !== undefined) updates.primaryColor = primaryColor
    if (backgroundColor !== undefined) updates.backgroundColor = backgroundColor
    if (textColor !== undefined) updates.textColor = textColor
    if (customDomain !== undefined) updates.customDomain = customDomain
    if (published !== undefined) updates.published = published

    const [updated] = await db
      .update(giveawayPage)
      .set(updates)
      .where(eq(giveawayPage.id, existing.id))
      .returning()

    return c.json({ page: updated })
  }

  // Create new page – derive slug from org if not provided
  let pageSlug = slug
  if (!pageSlug) {
    const [org] = await db
      .select({ slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1)
    pageSlug = org?.slug || orgId
  }

  if (!title) {
    return c.json({ error: "Title is required" }, 400)
  }

  const [dup] = await db
    .select({ id: giveawayPage.id })
    .from(giveawayPage)
    .where(eq(giveawayPage.slug, pageSlug))
    .limit(1)

  if (dup) return c.json({ error: "Slug already taken" }, 409)

  const [created] = await db
    .insert(giveawayPage)
    .values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      slug: pageSlug,
      title: title || "Giveaways",
      description: description || "",
      primaryColor: primaryColor || "#3b82f6",
      backgroundColor: backgroundColor || "#030712",
      textColor: textColor || "#f8fafc",
      customDomain: customDomain || null,
      published: published || false,
    })
    .returning()

  return c.json({ page: created }, 201)
})

export default pagesRoutes
