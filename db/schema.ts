import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  accessRole: text("access_role").notNull().default("member"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_members_username").on(table.username)]);

export const memberSessions = sqliteTable("member_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_member_sessions_expiry").on(table.expiresAt)]);

export const authLimits = sqliteTable("auth_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_auth_limits_expiry").on(table.expiresAt)]);

export const rewardDraws = sqliteTable(
  "reward_draws",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: text("member_id").notNull(),
    memberName: text("member_name").notNull().default("測試會員"),
    role: text("role").notNull(),
    reward: text("reward").notNull(),
    used: integer("used", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_reward_draws_member_created").on(table.memberId, table.createdAt)],
);
