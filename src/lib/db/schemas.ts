/**
 * Database schema definitions using Drizzle ORM.
 *
 * Tables:
 *   - user, session, account, verification    <- Better Auth core
 *   - organization, member, invitation        <- Better Auth org plugin
 *   - api_key                                 <- custom API key plugin
 *   - giveaway, giveaway_entry, giveaway_page <- giveaway system
 *
 * Each table is a Drizzle pgTable with relations defined at the bottom.
 */

import { defineRelations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ── Better Auth core tables ─────────────────────────────────── */

/** Registered users */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/** User sessions (one user can have many sessions) */
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

/** OAuth or password accounts linked to a user */
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

/** Email verification tokens / password reset tokens */
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/* ── Better Auth organization plugin tables ──────────────────── */

/** Organizations (tenants). Each org has its own members & giveaways */
export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
  },
  (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)],
);

/** Org membership join table (user <-> organization) */
export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
  ],
);

/** Pending invitations to join an org */
export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);

/* ── Custom plugin tables ────────────────────────────────────── */

/** API keys for external integrations (WordPress plugin, etc.) */
export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    domain: text("domain").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("api_key_organizationId_idx").on(table.organizationId)],
)

/* ── Giveaway system tables ──────────────────────────────────── */

/**
 * A giveaway created by an organization.
 * Status lifecycle: draft -> active -> ended.
 * The timezone field records the creator's local timezone at creation time.
 */
export const giveaway = pgTable(
  "giveaway",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    image: text("image"),                 // R2 URL
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    status: text("status").notNull().default("draft"), // draft | active | ended
    winnerId: text("winner_id")
      .references(() => giveawayEntry.id, { onDelete: "set null" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("giveaway_organizationId_idx").on(table.organizationId),
    uniqueIndex("giveaway_org_slug_uidx").on(table.organizationId, table.slug),
  ],
)

/** A single entry (name + email) submitted to a giveaway */
export const giveawayEntry = pgTable(
  "giveaway_entry",
  {
    id: text("id").primaryKey(),
    giveawayId: text("giveaway_id")
      .notNull()
      .references(() => giveaway.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("giveaway_entry_giveawayId_idx").on(table.giveawayId),
  ],
)

/**
 * Custom page settings per organization.
 * Slug is auto-set to the org slug. Colors can be customized.
 * published = true means the page is "in use" (publicly accessible).
 */
export const giveawayPage = pgTable(
  "giveaway_page",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" })
      .unique(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    primaryColor: text("primary_color").default("#3b82f6"),
    backgroundColor: text("background_color").default("#030712"),
    textColor: text("text_color").default("#f8fafc"),
    customDomain: text("custom_domain"),
    published: boolean("published").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("giveaway_page_slug_uidx").on(table.slug),
    uniqueIndex("giveaway_page_org_uidx").on(table.organizationId),
  ],
)

/* ── Relations ────────────────────────────────────────────────── */

export const relations = defineRelations(
  {
    user,
    session,
    account,
    verification,
    organization,
    member,
    invitation,
    giveaway,
    giveawayEntry,
    giveawayPage,
  },
  (r) => ({
    user: {
      sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
      accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
      members: r.many.member({ from: r.user.id, to: r.member.userId }),
      invitations: r.many.invitation({ from: r.user.id, to: r.invitation.inviterId }),
    },
    session: {
      user: r.one.user({ from: r.session.userId, to: r.user.id }),
      activeOrganization: r.one.organization({ from: r.session.activeOrganizationId, to: r.organization.id }),
    },
    account: {
      user: r.one.user({ from: r.account.userId, to: r.user.id }),
    },
    organization: {
      members: r.many.member({ from: r.organization.id, to: r.member.organizationId }),
      invitations: r.many.invitation({ from: r.organization.id, to: r.invitation.organizationId }),
      giveaways: r.many.giveaway({ from: r.organization.id, to: r.giveaway.organizationId }),
      giveawayPage: r.one.giveawayPage({ from: r.organization.id, to: r.giveawayPage.organizationId }),
    },
    member: {
      user: r.one.user({ from: r.member.userId, to: r.user.id }),
      organization: r.one.organization({ from: r.member.organizationId, to: r.organization.id }),
    },
    invitation: {
      organization: r.one.organization({ from: r.invitation.organizationId, to: r.organization.id }),
      inviter: r.one.user({ from: r.invitation.inviterId, to: r.user.id }),
    },
    giveaway: {
      organization: r.one.organization({ from: r.giveaway.organizationId, to: r.organization.id }),
      entries: r.many.giveawayEntry({ from: r.giveaway.id, to: r.giveawayEntry.giveawayId }),
      winner: r.one.giveawayEntry({ from: r.giveaway.winnerId, to: r.giveawayEntry.id }),
    },
    giveawayEntry: {
      giveaway: r.one.giveaway({ from: r.giveawayEntry.giveawayId, to: r.giveaway.id }),
    },
    giveawayPage: {
      organization: r.one.organization({ from: r.giveawayPage.organizationId, to: r.organization.id }),
    },
  }),
);
