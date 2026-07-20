import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  PORT: z
    .string()
    .refine(
      (port) => parseInt(port) > 0 && parseInt(port) < 65536,
      "PORT must be a valid port number between 1 and 65535",
    ),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters long"),
  BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),
  DATABASE_URL: z.url("DATABASE_URL must be a valid URL"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  RESEND_API_KEY: z.string().optional().default(""),
  FROM_EMAIL: z.string().email().default("onboarding@resend.dev"),
  FRONTEND_URL: z.url().default("http://localhost:3000"),
  POLAR_ACCESS_TOKEN: z.string().optional().default(""),
  POLAR_WEBHOOK_SECRET: z.string().optional().default(""),
  POLAR_SERVER: z.enum(["sandbox", "production"]).optional().default("sandbox"),
});

export default envSchema.parse(process.env);
