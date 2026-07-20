import bcrypt from "bcryptjs";
import { getSupabaseClient } from "../supabase/client";
import { ECONOMY_CONFIG } from "../../../config/economy";
import { grantWeaponToPlayer, setWeaponEquipped } from "./inventory";
import { computeVipProgress } from "../google/vip";

const TABLE = "players";

export interface Player {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  coin: number;
  diamond: number;
  ticket: number;
  level: number;
  exp: number;
  currentStage: number;
  currentCharacter: string;
  currentWeapon: string;
  isGuest: boolean;
  isBanned: boolean;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
  vipLevel: number;
  vipExp: number;
  farmStageMaxWave: number;
  personalMilestoneTier: number;
  personalMilestoneGreenTier: number;
  isTestAccount: boolean;
  /** v16: requires scripts/sql/003_v16_schema.sql — held back until confirmed run. */
  isAdmin: boolean;
  /** v16: leaderboard's OWN wave counter, reset weekly — separate from the
   *  permanent farmStageMaxWave (which gates Azzure + farm_wave missions
   *  forever and must never be reset). */
  weeklyFarmMaxWave: number;
  /** v36: coin earned during the specific run that set weeklyFarmMaxWave —
   *  what the leaderboard actually displays, not the player's overall coin
   *  balance (which was only ever a tiebreaker). Requires
   *  scripts/sql/005_v36_leaderboard_coin.sql. */
  weeklyFarmMaxWaveCoin: number;
  /** v16: daily TrueMoney withdrawal cap tracking (100 baht/day), reset lazily
   *  like this project's other daily counters (ammo, missions). */
  dailyWithdrawnBaht: number;
  dailyWithdrawnDate: string;
  /** v35: requires scripts/sql/004_v35_perks.sql — held back until confirmed
   *  run. One-time ticket-purchased perks, see src/lib/perks.ts. */
  perkSpareWeapon: boolean;
  perkRegen: boolean;
  perkSuperShield: boolean;
  perkOneShot: boolean;
  /** v50: requires scripts/sql/014_v50_invisible_never_died_perks.sql —
   *  held back until confirmed run. See src/lib/perks.ts. */
  perkInvisible: boolean;
  perkNeverDied: boolean;
  /** v35: which OWNED weapon (other than currentWeapon) is loaded into the
   *  swap slot — only meaningful once perkSpareWeapon is true. Empty string
   *  if never set. */
  spareWeaponId: string;
  /** v42: requires scripts/sql/010_v42_per_character_skins.sql — held back
   *  until confirmed run. Currently-equipped skin id, PER CHARACTER id (see
   *  src/lib/characterSkins.ts) — e.g. {"bob": "desert"}. A character with
   *  no entry (or an entry Object.keys never touched) is "default". v60:
   *  values used to be color-tint ids (red/blue/...); now they're real
   *  sprite-asset skin ids — same jsonb column reused, stale old color ids
   *  simply fail isSkinId and fall back to "default" harmlessly. Replaces
   *  the old global skin_color column (008_v38_skins.sql, kept but unused —
   *  sharing one skin across every character was the actual bug). */
  skinColors: Record<string, string>;
  /** v42: every skin id ever purchased, PER CHARACTER id — e.g.
   *  {"bob": ["desert", "elite"]}. Replaces the old global owned_skins column. */
  ownedSkinsByCharacter: Record<string, string[]>;
  /** v39: requires scripts/sql/009_v39_tutorial.sql — held back until confirmed
   *  run. Gates the first-time Training Mode flow (see src/game/scenes/TutorialScene.ts). */
  tutorialCompleted: boolean;
  /** v39: last tutorial state reached — quitting mid-tutorial resumes here
   *  instead of restarting (see TutorialState in TutorialScene.ts). */
  tutorialStep: string;
  /** v45: requires scripts/sql/011_v45_ad_coin_reward.sql — held back until
   *  confirmed run. "Watch Ad for 30 Coin" daily count, same lazy
   *  reset-on-read pattern as dailyWithdrawnBaht/Date above. */
  dailyAdCoinWatches: number;
  dailyAdCoinDate: string;
  /** v46: requires scripts/sql/012_v46_character_upgrade.sql — held back
   *  until confirmed run. Permanent, uncapped, PER CHARACTER HP upgrade level
   *  (see src/lib/characterUpgrade.ts) — e.g. {"bob": 12}. Missing/0 = never
   *  upgraded. */
  characterUpgradeLevels: Record<string, number>;
  /** v47: requires scripts/sql/013_v47_weapon_upgrade.sql — held back until
   *  confirmed run. Permanent, uncapped, PER WEAPON damage upgrade level (see
   *  src/lib/weaponUpgrade.ts) — e.g. {"pistol": 8}. Missing/0 = never upgraded. */
  weaponUpgradeLevels: Record<string, number>;
  /** v66: requires scripts/sql/015_v66_daily_login_reward.sql — held back
   *  until confirmed run. The LAST claimed day of the 7-day repeating Daily
   *  Login Reward cycle (see src/lib/dailyLoginRewards.ts) — 0 means never
   *  claimed, so the next claim is day 1. Wraps 7 -> 1 automatically; missing
   *  a day never resets this, the player just claims the next day whenever
   *  they come back (see src/lib/db/dailyLogin.ts). */
  dailyLoginDay: number;
  /** v66: UTC "YYYY-MM-DD" of the last claim — gates "once per day", same
   *  lazy server-time pattern as dailyWithdrawnDate/dailyAdCoinDate above. */
  dailyLoginLastClaimDate: string;
}

/** DB row (snake_case) -> app-facing Player (camelCase) — same shape callers
 *  already expect from the old src/lib/google/player.ts, so every route that
 *  switches its import keeps working unchanged. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPlayer(row: any): Player {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash ?? "",
    coin: Number(row.coin ?? 0),
    diamond: Number(row.diamond ?? 0),
    ticket: Number(row.ticket ?? 0),
    level: Number(row.level ?? 1),
    exp: Number(row.exp ?? 0),
    currentStage: Number(row.current_stage ?? 1),
    currentCharacter: row.current_character ?? "bob",
    currentWeapon: row.current_weapon ?? "pistol",
    isGuest: Boolean(row.is_guest),
    isBanned: Boolean(row.is_banned),
    lastLogin: row.last_login ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    vipLevel: Number(row.vip_level ?? 0),
    vipExp: Number(row.vip_exp ?? 0),
    farmStageMaxWave: Number(row.farm_stage_max_wave ?? 0),
    personalMilestoneTier: Number(row.personal_milestone_tier ?? 0),
    personalMilestoneGreenTier: Number(row.personal_milestone_green_tier ?? 0),
    isTestAccount: Boolean(row.is_test_account),
    isAdmin: Boolean(row.is_admin),
    weeklyFarmMaxWave: Number(row.weekly_farm_max_wave ?? 0),
    weeklyFarmMaxWaveCoin: Number(row.weekly_farm_max_wave_coin ?? 0),
    dailyWithdrawnBaht: Number(row.daily_withdrawn_baht ?? 0),
    dailyWithdrawnDate: row.daily_withdrawn_date ?? "",
    perkSpareWeapon: Boolean(row.perk_spare_weapon),
    perkRegen: Boolean(row.perk_regen),
    perkSuperShield: Boolean(row.perk_super_shield),
    perkOneShot: Boolean(row.perk_one_shot),
    perkInvisible: Boolean(row.perk_invisible),
    perkNeverDied: Boolean(row.perk_never_died),
    spareWeaponId: row.spare_weapon_id ?? "",
    skinColors: (row.skin_colors && typeof row.skin_colors === "object" && !Array.isArray(row.skin_colors)) ? row.skin_colors : {},
    ownedSkinsByCharacter: (row.owned_skins_by_character && typeof row.owned_skins_by_character === "object" && !Array.isArray(row.owned_skins_by_character)) ? row.owned_skins_by_character : {},
    tutorialCompleted: Boolean(row.tutorial_completed),
    tutorialStep: row.tutorial_step ?? "MOVE",
    dailyAdCoinWatches: Number(row.daily_ad_coin_watches ?? 0),
    dailyAdCoinDate: row.daily_ad_coin_date ?? "",
    characterUpgradeLevels: (row.character_upgrade_levels && typeof row.character_upgrade_levels === "object" && !Array.isArray(row.character_upgrade_levels)) ? row.character_upgrade_levels : {},
    weaponUpgradeLevels: (row.weapon_upgrade_levels && typeof row.weapon_upgrade_levels === "object" && !Array.isArray(row.weapon_upgrade_levels)) ? row.weapon_upgrade_levels : {},
    dailyLoginDay: Number(row.daily_login_day ?? 0),
    dailyLoginLastClaimDate: row.daily_login_last_claim_date ?? "",
  };
}

export async function getAllPlayers(): Promise<Player[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw new Error(`getAllPlayers: ${error.message}`);
  return (data ?? []).map(rowToPlayer);
}

export async function getPlayerByEmail(email: string): Promise<Player | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("*").ilike("email", email).maybeSingle();
  if (error) throw new Error(`getPlayerByEmail: ${error.message}`);
  return data ? rowToPlayer(data) : null;
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getPlayerById: ${error.message}`);
  return data ? rowToPlayer(data) : null;
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function createPlayer(params: { email: string; username: string; password?: string; isGuest?: boolean; isTestAccount?: boolean }): Promise<Player> {
  const existing = await getPlayerByEmail(params.email);
  if (existing) throw new Error("Email already in use");

  const now = new Date().toISOString();
  const passwordHash = params.password ? await bcrypt.hash(params.password, 10) : "";

  const player: Player = {
    id: genId("player"),
    email: params.email,
    username: params.username,
    passwordHash,
    coin: ECONOMY_CONFIG.startingCoin,
    diamond: ECONOMY_CONFIG.startingDiamond,
    ticket: ECONOMY_CONFIG.startingTicket,
    level: 1,
    exp: 0,
    currentStage: 1,
    currentCharacter: "bob",
    currentWeapon: "pistol",
    isGuest: params.isGuest ?? false,
    isBanned: false,
    lastLogin: now,
    createdAt: now,
    updatedAt: now,
    vipLevel: 0,
    vipExp: 0,
    farmStageMaxWave: 0,
    personalMilestoneTier: 0,
    personalMilestoneGreenTier: 0,
    isTestAccount: params.isTestAccount ?? false,
    // v16: NOT included in the .insert() call below — these columns have
    // their own defaults at the DB level (see 003_v16_schema.sql), so the
    // insert works identically whether or not that migration has been run
    // yet. This object's values are just for the in-memory return below.
    isAdmin: false,
    weeklyFarmMaxWave: 0,
    weeklyFarmMaxWaveCoin: 0,
    dailyWithdrawnBaht: 0,
    dailyWithdrawnDate: "",
    // v35: also not included in .insert() below — DB-level defaults (see
    // 004_v35_perks.sql), same reasoning as the v16 fields above.
    perkSpareWeapon: false,
    perkRegen: false,
    perkSuperShield: false,
    perkOneShot: false,
    perkInvisible: false,
    perkNeverDied: false,
    spareWeaponId: "",
    // v42: also not included in .insert() below — DB-level defaults (see
    // 010_v42_per_character_skins.sql), same reasoning as the v16/v35 fields above.
    skinColors: {},
    ownedSkinsByCharacter: {},
    // v39: also not included in .insert() below — DB-level defaults (see
    // 009_v39_tutorial.sql), same reasoning as the v16/v35/v38 fields above.
    tutorialCompleted: false,
    tutorialStep: "MOVE",
    // v45: also not included in .insert() below — DB-level defaults (see
    // 011_v45_ad_coin_reward.sql), same reasoning as the fields above.
    dailyAdCoinWatches: 0,
    dailyAdCoinDate: "",
    // v46: also not included in .insert() below — DB-level default (see
    // 012_v46_character_upgrade.sql), same reasoning as the fields above.
    characterUpgradeLevels: {},
    // v47: also not included in .insert() below — DB-level default (see
    // 013_v47_weapon_upgrade.sql), same reasoning as the fields above.
    weaponUpgradeLevels: {},
    // v66: also not included in .insert() below — DB-level default (see
    // 015_v66_daily_login_reward.sql), same reasoning as the fields above.
    dailyLoginDay: 0,
    dailyLoginLastClaimDate: "",
  };

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).insert({
    id: player.id,
    email: player.email,
    username: player.username,
    password_hash: player.passwordHash,
    coin: player.coin,
    diamond: player.diamond,
    ticket: player.ticket,
    level: player.level,
    exp: player.exp,
    current_stage: player.currentStage,
    current_character: player.currentCharacter,
    current_weapon: player.currentWeapon,
    is_guest: player.isGuest,
    is_banned: player.isBanned,
    last_login: player.lastLogin,
    created_at: player.createdAt,
    updated_at: player.updatedAt,
    vip_level: player.vipLevel,
    vip_exp: player.vipExp,
    farm_stage_max_wave: player.farmStageMaxWave,
    personal_milestone_tier: player.personalMilestoneTier,
    personal_milestone_green_tier: player.personalMilestoneGreenTier,
    is_test_account: player.isTestAccount,
  });
  if (error) throw new Error(`createPlayer: ${error.message}`);

  // v7 #4: every new player starts with Pistol already equipped (not just
  // "ownable") so they can enter the first stage immediately.
  await grantWeaponToPlayer(player.id, "pistol");
  await setWeaponEquipped(player.id, "pistol");

  return player;
}

export async function verifyPassword(email: string, password: string): Promise<Player | null> {
  const player = await getPlayerByEmail(email);
  if (!player || !player.passwordHash) return null;
  const valid = await bcrypt.compare(password, player.passwordHash);
  return valid ? player : null;
}

const CAMEL_TO_SNAKE: Record<string, string> = {
  currentStage: "current_stage",
  currentCharacter: "current_character",
  currentWeapon: "current_weapon",
  isGuest: "is_guest",
  isBanned: "is_banned",
  lastLogin: "last_login",
  createdAt: "created_at",
  updatedAt: "updated_at",
  vipLevel: "vip_level",
  vipExp: "vip_exp",
  farmStageMaxWave: "farm_stage_max_wave",
  personalMilestoneTier: "personal_milestone_tier",
  personalMilestoneGreenTier: "personal_milestone_green_tier",
  isTestAccount: "is_test_account",
  passwordHash: "password_hash",
  isAdmin: "is_admin",
  weeklyFarmMaxWave: "weekly_farm_max_wave",
  weeklyFarmMaxWaveCoin: "weekly_farm_max_wave_coin",
  dailyWithdrawnBaht: "daily_withdrawn_baht",
  dailyWithdrawnDate: "daily_withdrawn_date",
  perkSpareWeapon: "perk_spare_weapon",
  perkRegen: "perk_regen",
  perkSuperShield: "perk_super_shield",
  perkOneShot: "perk_one_shot",
  perkInvisible: "perk_invisible",
  perkNeverDied: "perk_never_died",
  spareWeaponId: "spare_weapon_id",
  skinColors: "skin_colors",
  ownedSkinsByCharacter: "owned_skins_by_character",
  tutorialCompleted: "tutorial_completed",
  tutorialStep: "tutorial_step",
  dailyAdCoinWatches: "daily_ad_coin_watches",
  dailyAdCoinDate: "daily_ad_coin_date",
  characterUpgradeLevels: "character_upgrade_levels",
  weaponUpgradeLevels: "weapon_upgrade_levels",
  dailyLoginDay: "daily_login_day",
  dailyLoginLastClaimDate: "daily_login_last_claim_date",
};

function toSnakeUpdates(updates: Record<string, string | number | boolean | string[] | Record<string, string> | Record<string, string[]> | Record<string, number>>): Record<string, string | number | boolean | string[] | Record<string, string> | Record<string, string[]> | Record<string, number>> {
  const out: Record<string, string | number | boolean | string[] | Record<string, string> | Record<string, string[]> | Record<string, number>> = {};
  for (const [key, value] of Object.entries(updates)) {
    out[CAMEL_TO_SNAKE[key] ?? key] = value;
  }
  return out;
}

export async function updatePlayerByEmail(email: string, updates: Record<string, string | number | boolean | string[] | Record<string, string> | Record<string, string[]> | Record<string, number>>): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ ...toSnakeUpdates(updates), updated_at: new Date().toISOString() })
    .ilike("email", email);
  if (error) throw new Error(`updatePlayerByEmail: ${error.message}`);
}

export async function updatePlayer(id: string, updates: Partial<Record<keyof Player, string | number | boolean | string[] | Record<string, string> | Record<string, string[]> | Record<string, number>>>): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ ...toSnakeUpdates(updates), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`updatePlayer: ${error.message}`);
}

/**
 * Permanently deletes a player account. Every player-scoped Supabase table
 * (player_weapon, player_character, player_equipment, player_equipment_level,
 * player_passive, player_weapon_ammo, player_stage_progress, player_mission,
 * player_income, player_boss_progress) references players(id) with
 * `on delete cascade` (see scripts/sql/001_runtime_schema.sql), so deleting
 * the players row alone cleans up everything there. Mail/WithdrawalRequest
 * rows (Google Sheets, not Supabase) are left behind, orphaned but harmless —
 * nobody can read them again since they're keyed by a playerId that no
 * longer resolves to any account.
 */
export async function deletePlayer(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(`deletePlayer: ${error.message}`);
}

/** Records a new personal-best farm wave — also used to gate Azzure's SPECIAL unlock. */
export async function recordFarmWave(playerId: string, waveReached: number): Promise<void> {
  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");
  if (waveReached > player.farmStageMaxWave) {
    await updatePlayer(playerId, { farmStageMaxWave: waveReached });
  }
}

/**
 * v16: `exp` no longer feeds the old separate character level/exp system —
 * that was a second, hidden progression bar players never saw broken down
 * meaningfully (just a lone star icon), running alongside VIP which already
 * tracked the exact same kind of progress. Every exp grant (missions, farm-
 * wave milestones, stage clears) now goes straight into vipExp/vipLevel, so
 * there's a single unified progression number instead of two.
 */
export async function addCurrency(playerId: string, delta: { coin?: number; diamond?: number; ticket?: number; exp?: number }): Promise<Player> {
  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");

  const updates: Partial<Player> = {
    coin: player.coin + (delta.coin ?? 0),
    diamond: player.diamond + (delta.diamond ?? 0),
    ticket: player.ticket + (delta.ticket ?? 0),
  };

  if (delta.exp) {
    const newVipExp = player.vipExp + delta.exp;
    const vipProgress = await computeVipProgress(newVipExp);
    updates.vipExp = newVipExp;
    updates.vipLevel = vipProgress.level;
  }

  await updatePlayer(playerId, updates);
  return { ...player, ...updates };
}

/** Strips passwordHash before sending player data to the client. */
export function toPublicPlayer(player: Player): Omit<Player, "passwordHash"> {
  const { passwordHash: _passwordHash, ...pub } = player;
  return pub;
}
