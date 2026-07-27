import * as crypto from "node:crypto";
import db from "./lib/db";
import { giveaway, giveawayEntry, giveawayWinner } from "./lib/db/schemas";
import { and, eq, lte, sql } from "drizzle-orm";

const POLL_INTERVAL = 30_000;

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startScheduler() {
  if (intervalId) return;

  const poll = async () => {
    try {
      const expired = await db
        .select({ id: giveaway.id, name: giveaway.name, winnersCount: giveaway.winnersCount })
        .from(giveaway)
        .where(and(eq(giveaway.status, "active"), lte(giveaway.endTime, new Date())));

      if (expired.length === 0) return;

      for (const g of expired) {
        const winners = await db
          .select({ id: giveawayEntry.id })
          .from(giveawayEntry)
          .where(eq(giveawayEntry.giveawayId, g.id))
          .orderBy(sql`RANDOM() ^ (1.0 / NULLIF(${giveawayEntry.tickets}, 0)) DESC`)
          .limit(g.winnersCount);

        if (winners.length > 0) {
          await db.insert(giveawayWinner).values(
            winners.map((w, i) => ({
              id: crypto.randomUUID(),
              giveawayId: g.id,
              entryId: w.id,
              position: i + 1,
            })),
          );
        }

        await db
          .update(giveaway)
          .set({ status: "ended" })
          .where(eq(giveaway.id, g.id));

        const winnerList = winners.map((w, i) => `#${i + 1}: ${w.id}`).join(", ");
        console.log(`[scheduler] Ended "${g.name}"${winnerList ? `, winners: ${winnerList}` : " (no entries)"}`);
      }
    } catch (err) {
      console.error("[scheduler] Failed to end expired giveaways:", err);
    }
  };

  poll();
  intervalId = setInterval(poll, POLL_INTERVAL);

  console.log(`[scheduler] Started (polling every ${POLL_INTERVAL / 1000}s)`);
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[scheduler] Stopped");
  }
}
