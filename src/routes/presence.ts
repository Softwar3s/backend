import { Hono } from "hono"
import { eq, inArray } from "drizzle-orm"
import db from "../lib/db"
import { userPresence, member } from "../lib/db/schemas"
import { requireAuth, type AuthVariables } from "../middlewares/auth"

const presenceRoutes = new Hono<{ Variables: AuthVariables }>()

presenceRoutes.post("/presence/heartbeat", requireAuth, async (c) => {
  const user = c.get("user")
  await db
    .insert(userPresence)
    .values({ userId: user!.id, lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: userPresence.userId, set: { lastSeenAt: new Date() } })
  return c.json({ success: true })
})

presenceRoutes.get("/presence/org/:organizationId", requireAuth, async (c) => {
  const { organizationId } = c.req.param()

  const userIds = await db
    .select({ userId: member.userId })
    .from(member)
    .where(eq(member.organizationId, organizationId))

  if (userIds.length === 0) {
    return c.json({ presence: {} })
  }

  const presences = await db
    .select()
    .from(userPresence)
    .where(
      inArray(userPresence.userId, userIds.map((u) => u.userId)),
    )

  const presenceMap: Record<string, string> = {}
  for (const p of presences) {
    presenceMap[p.userId] = p.lastSeenAt.toISOString()
  }

  return c.json({ presence: presenceMap })
})

export default presenceRoutes