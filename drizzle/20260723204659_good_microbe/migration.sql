CREATE TABLE "giveaway_winner" (
	"id" text PRIMARY KEY,
	"giveaway_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "giveaway" DROP CONSTRAINT "giveaway_winner_id_giveaway_entry_id_fkey";--> statement-breakpoint
ALTER TABLE "giveaway" ADD COLUMN "winners_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "giveaway" DROP COLUMN "winner_id";--> statement-breakpoint
CREATE INDEX "giveaway_winner_giveawayId_idx" ON "giveaway_winner" ("giveaway_id");--> statement-breakpoint
ALTER TABLE "giveaway_winner" ADD CONSTRAINT "giveaway_winner_giveaway_id_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "giveaway"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "giveaway_winner" ADD CONSTRAINT "giveaway_winner_entry_id_giveaway_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "giveaway_entry"("id") ON DELETE CASCADE;