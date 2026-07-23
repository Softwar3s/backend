/**
 * File upload route (session-auth required).
 *
 * Accepts multipart/form-data with a single "file" field.
 * Validates file type (JPEG, PNG, WebP, GIF) and size (max 5MB),
 * then uploads to Cloudflare R2 and returns the public URL.
 *
 * POST /api/upload
 */

import { Hono } from "hono"
import { uploadFile } from "../lib/r2"
import { requireAuth, type AuthVariables } from "../middlewares/auth"

const uploadRoutes = new Hono<{ Variables: AuthVariables }>()

/** POST /api/upload – upload an image file to R2 */
uploadRoutes.post("/upload", requireAuth, async (c) => {
  const contentType = c.req.header("content-type") || ""

  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "Expected multipart/form-data" }, 400)
  }

  const formData = await c.req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return c.json({ error: "No file provided" }, 400)
  }

  // Only allow image types
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: "File must be an image (JPEG, PNG, WebP, or GIF)" }, 400)
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: "File must be under 5MB" }, 400)
  }

  const buffer = await file.arrayBuffer()
  const url = await uploadFile(buffer, file.name, file.type)

  if (!url) {
    return c.json({ error: "R2 not configured. Set CLOUDFLARE_R2_* env vars." }, 500)
  }

  return c.json({ url })
})

export default uploadRoutes
