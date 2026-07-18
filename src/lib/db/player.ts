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
  /** v35: which OWNED weapon (other than currentWeapon) is loaded into the
   *  swap slot — only meaningful once perkSpareWeapon is true. Empty string
   *  if never set. */
  spareWeaponId: string;
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
    spareWeaponId: row.spare_weapon_id ?? "",
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
    spareWeaponId: "",
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
  spareWeaponId: "spare_weapon_id",
};

function toSnakeUpdates(updates: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(updates)) {
    out[CAMEL_TO_SNAKE[key] ?? key] = value;
  }
  return out;
}

export async function updatePlayerByEmail(email: string, updates: Record<string, string | number | boolean>): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ ...toSnakeUpdates(updates), updated_at: new Date().toISOString() })
    .ilike("email", email);
  if (error) throw new Error(`updatePlayerByEmail: ${error.message}`);
}

export async function updatePlayer(id: string, updates: Partial<Record<keyof Player, string | number | boolean>>): Promise<void> {
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
