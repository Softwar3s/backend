CREATE TABLE "giveaway" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image" text,
	"end_time" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giveaway_entry" (
	"id" text PRIMARY KEY,
	"giveaway_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giveaway_page" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL UNIQUE,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"custom_domain" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "giveaway_organizationId_idx" ON "giveaway" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "giveaway_org_slug_uidx" ON "giveaway" ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "giveaway_entry_giveawayId_idx" ON "giveaway_entry" ("giveaway_id");--> statement-breakpoint
CREATE UNIQUE INDEX "giveaway_page_slug_uidx" ON "giveaway_page" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "giveaway_page_org_uidx" ON "giveaway_page" ("organization_id");--> statement-breakpoint
ALTER TABLE "giveaway" ADD CONSTRAINT "giveaway_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "giveaway_entry" ADD CONSTRAINT "giveaway_entry_giveaway_id_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "giveaway"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "giveaway_page" ADD CONSTRAINT "giveaway_page_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;