/**
 * Cloudflare R2 file upload helper.
 *
 * Uses the S3-compatible API to upload giveaway images to R2.
 * Falls back to returning null if R2 env vars are not configured.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import env from "./env"

let r2Client: S3Client | null = null

/** Lazily initialises the S3 client for R2 */
function getClient() {
  if (!r2Client) {
    if (!env.CLOUDFLARE_R2_ACCOUNT_ID || !env.CLOUDFLARE_R2_ACCESS_KEY_ID || !env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
      return null
    }
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    })
  }
  return r2Client
}

/**
 * Uploads a file buffer to R2 under the `giveaways/` prefix.
 * Returns the public URL or null if R2 is not configured.
 */
export async function uploadFile(
  buffer: ArrayBuffer,
  fileName: string,
  contentType: string,
): Promise<string | null> {
  const client = getClient()
  if (!client) return null

  const ext = fileName.split(".").pop() || "bin"
  const key = `giveaways/${crypto.randomUUID()}.${ext}`

  await client.send(
    new PutObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
    }),
  )

  const publicUrl = env.CLOUDFLARE_R2_PUBLIC_URL
  if (publicUrl) {
    return `${publicUrl}/${key}`
  }

  return `${env.BETTER_AUTH_URL}/api/files/${key}`
}

/** Deletes a file from R2 by its object key */
export async function deleteFile(key: string): Promise<void> {
  const client = getClient()
  if (!client) return

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
    }),
  )
}
