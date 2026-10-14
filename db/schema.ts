import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  legacyContactPhone: text("legacy_contact_phone").notNull().default(""),
  phone: text("phone"),
  phoneVerifiedAt: text("phone_verified_at"),
  email: text("email").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  accessRole: text("access_role").notNull().default("member"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  playerId: text('player_id'),
  phoneVerified: integer('phone_verified').notNull().default(0),
  status: text('status').notNull().default('active'),
  lastLoginAt: text('last_login_at'),
}, (table) => [uniqueIndex("idx_members_username").on(table.username), uniqueIndex('idx_members_player_id').on(table.playerId), uniqueIndex('idx_members_verified_phone').on(table.phone).where(sql`${table.phoneVerifiedAt} IS NOT NULL`)]);

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

export const systemSettings = sqliteTable('system_settings', {
  id: integer('id').primaryKey(),
  storeOnline: integer('store_online').notNull().default(1),
  doorAccessEnabled: integer('door_access_enabled').notNull().default(0),
  cardDrawEnabled: integer('card_draw_enabled').notNull().default(1),
  registrationEnabled: integer('registration_enabled').notNull().default(1),
  maintenanceMessage: text('maintenance_message').notNull().default(''),
  doorPin: text('door_pin'),
  doorPinDisplaySeconds: integer('door_pin_display_seconds').notNull().default(15),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [check('single_settings', sql`${t.id} = 1`), check('display_seconds_range', sql`${t.doorPinDisplaySeconds} BETWEEN 5 AND 60`)]);
export const playerHistory = sqliteTable('player_history', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => members.id),
  type: text('type').notNull(), value: text('value').notNull(), createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [index('idx_player_history_user').on(t.userId, t.createdAt)]);
export const doorAccessLogs = sqliteTable('door_access_logs', {
  id: text('id').primaryKey(), userId: text('user_id').references(() => members.id), sessionId: text('session_id'),
  accessedAt: text('accessed_at').notNull().default(sql`CURRENT_TIMESTAMP`), result: text('result').notNull(),
}, t => [index('idx_door_access_time').on(t.accessedAt)]);
export const adminLogs = sqliteTable('admin_logs', {
  id: text('id').primaryKey(), adminId: text('admin_id').notNull().references(() => members.id),
  action: text('action').notNull(), createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const guestDraws = sqliteTable('guest_draws', {
  id: text('id').primaryKey(), sessionId: text('session_id').notNull(), role: text('role').notNull(), reward: text('reward').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [index('idx_guest_draws_time').on(t.createdAt)]);
export const rewardClaims = sqliteTable('reward_claims', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => members.id), rewardKey: text('reward_key').notNull(),
  status: text('status').notNull().default('available'), redeemedAt: text('redeemed_at'), createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`), claimedAt: text('claimed_at'),
}, t => [check('claim_status', sql`${t.status} IN ('unlocked','available','claimed','redeemed','expired')`)]);
export const otpChallenges = sqliteTable('otp_challenges', {
  id: text('id').primaryKey(), userId: text('user_id').references(() => members.id), purpose: text('purpose').notNull().default('recover'), recoveryHash: text('recovery_hash'), phone: text('phone').notNull(), codeHash: text('code_hash').notNull(),
  expiresAt: integer('expires_at').notNull(), attempts: integer('attempts').notNull().default(0),
  consumed: integer('consumed').notNull().default(0), sent: integer('sent').notNull().default(0),
}, t => [index('idx_otp_phone').on(t.phone, t.expiresAt)]);
export const otpLimits = sqliteTable('otp_limits', {
  key: text('key').primaryKey(), attempts: integer('attempts').notNull(), expiresAt: integer('expires_at').notNull(),
});

export const rewardDefinitions = sqliteTable('reward_definitions', {
  rewardKey: text('reward_key').primaryKey(), requiresPhoneVerification: integer('requires_phone_verification').notNull().default(1), oneTime: integer('one_time').notNull().default(1),
}, t => [check('reward_requires_phone_boolean', sql`${t.requiresPhoneVerification} IN (0,1)`), check('reward_one_time_boolean', sql`${t.oneTime} IN (0,1)`)]);
export const rewardClaimLocks = sqliteTable('reward_claim_locks', {
  userId: text('user_id').notNull().references(() => members.id), rewardKey: text('reward_key').notNull(), claimId: text('claim_id').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.rewardKey] })]);

export const menuExplorations = sqliteTable('menu_explorations', {
  memberId: text('member_id').notNull().references(() => members.id),
  drinkId: text('drink_id').notNull(),
  status: text('status').notNull().default('pending'),
  requestedAt: text('requested_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  confirmedAt: text('confirmed_at'), confirmedBy: text('confirmed_by').references(() => members.id),
  revision: integer('revision').notNull().default(1), lastEventId: text('last_event_id'),
}, t => [
  primaryKey({ columns: [t.memberId,t.drinkId] }),
  check('menu_drink_id', sql`${t.drinkId} IN ('role-01-drink-1','role-01-drink-2','role-01-drink-3','role-02-drink-1','role-02-drink-2','role-02-drink-3','role-04-drink-1','role-04-drink-2','role-04-drink-3','role-03-drink-1','role-03-drink-2','role-03-drink-3')`),
  check('menu_status', sql`${t.status} IN ('pending','completed','revoked')`),
  check('menu_confirmed', sql`${t.status} != 'completed' OR (${t.confirmedAt} IS NOT NULL AND ${t.confirmedBy} IS NOT NULL)`),
]);
export const menuExplorationEvents = sqliteTable('menu_exploration_events', {
  id: text('id').primaryKey(), memberId: text('member_id').notNull().references(() => members.id),
  drinkId: text('drink_id').notNull(), actorId: text('actor_id').notNull().references(() => members.id),
  action: text('action').notNull(), reason: text('reason').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [index('idx_menu_events_member').on(t.memberId,t.createdAt),check('menu_event_action',sql`${t.action} IN ('confirm','revoke')`)]);
export const menuVouchers = sqliteTable('menu_vouchers', {
  memberId: text('member_id').primaryKey().references(() => members.id),
  code: text('code').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  redeemedAt: text('redeemed_at'), redeemedBy: text('redeemed_by').references(() => members.id),
});
