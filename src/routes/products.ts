import { Hono } from "hono"
import { Polar } from "@polar-sh/sdk"
import env from "../lib/env"
import { requireAuth } from "../middlewares/auth"

const polarClient = env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: env.POLAR_ACCESS_TOKEN,
      server: env.POLAR_SERVER,
    })
  : null

const productsRoutes = new Hono()

productsRoutes.get("/products", requireAuth, async (c) => {
  if (!polarClient) {
    return c.json({ products: [] })
  }
  try {
    const iterator = await polarClient.products.list({
      isArchived: false,
      sorting: ["price_amount"],
    })
    const res = iterator as any
    const items = res.result?.items ?? res.data ?? []
    const products = items.map((p: any) => {
      const price = Array.isArray(p.prices) ? p.prices[0] : p.price ?? {}
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        priceAmount: price.priceAmount ?? price.amount ?? 0,
        priceCurrency: price.priceCurrency ?? price.currency ?? "usd",
        recurringInterval: price.recurringInterval ?? null,
        metadata: p.metadata ?? {},
      }
    })
    return c.json({ products })
  } catch (e: any) {
    return c.json({ error: e?.message ?? "Failed to fetch products" }, 500)
  }
})

export default productsRoutes
