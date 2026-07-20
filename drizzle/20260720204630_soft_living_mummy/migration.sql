CREATE TABLE "api_key" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"domain" text NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "api_key_organizationId_idx" ON "api_key" ("organization_id");--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;