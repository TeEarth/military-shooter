import bcrypt from "bcryptjs";
import { getCachedSheet, invalidateSheetCache } from "./cache";
import { appendRow, findRow, updateRow, parseBool } from "./sheet";
import { ECONOMY_CONFIG } from "../../../config/economy";
import { grantWeaponToPlayer, setWeaponEquipped } from "./inventory";

const SHEET = "Players";

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
  /** v9 #2: derived from vipExp via VipConfig (src/lib/google/vip.ts) — kept in
   *  sync on every vipExp gain in /api/game/complete, not set by hand anymore. */
  vipLevel: number;
  /** Cumulative exp earned from story/farm stage-clear rewardExp ONLY (never
   *  decreases) — the sole source VIP level is computed from. */
  vipExp: number;
  /** Highest wave ever reached in the repeatable farm stage — also gates Azzure's unlock. */
  farmStageMaxWave: number;
  /** How many 5-stage personal milestones (5, 10, 15, ...) have already been paid out — prevents re-granting. */
  personalMilestoneTier: number;
  /** How many 5-milestone green-banknote batches have already been paid out — prevents re-granting. */
  personalMilestoneGreenTier: number;
  /** v9 #4: marks accounts created by scripts/reset-test-account.ts so the
   *  script's bulk-wipe can safely find every past test account without ever
   *  touching a real player's row. Never set true by normal register/guest signup. */
  isTestAccount: boolean;
}

function rowToPlayer(row: Record<string, string>): Player {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.passwordHash,
    coin: Number(row.coin || 0),
    diamond: Number(row.diamond || 0),
    ticket: Number(row.ticket || 0),
    level: Number(row.level || 1),
    exp: Number(row.exp || 0),
    currentStage: Number(row.currentStage || 1),
    currentCharacter: row.currentCharacter || "bob",
    currentWeapon: row.currentWeapon || "pistol",
    isGuest: parseBool(row.isGuest),
    isBanned: parseBool(row.isBanned),
    lastLogin: row.lastLogin || "",
    createdAt: row.createdAt || "",
    updatedAt: row.updatedAt || "",
    vipLevel: Number(row.vipLevel || 0),
    vipExp: Number(row.vipExp || 0),
    farmStageMaxWave: Number(row.farmStageMaxWave || 0),
    personalMilestoneTier: Number(row.personalMilestoneTier || 0),
    personalMilestoneGreenTier: Number(row.personalMilestoneGreenTier || 0),
    isTestAccount: parseBool(row.isTestAccount),
  };
}

export async function getAllPlayers(): Promise<Player[]> {
  const { rows } = await getCachedSheet(SHEET);
  return rows.map(rowToPlayer);
}

export async function getPlayerByEmail(email: string): Promise<Player | null> {
  const players = await getAllPlayers();
  return players.find((p) => p.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const players = await getAllPlayers();
  return players.find((p) => p.id === id) ?? null;
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
  };

  await appendRow(SHEET, {
    id: player.id,
    email: player.email,
    username: player.username,
    passwordHash: player.passwordHash,
    coin: player.coin,
    diamond: player.diamond,
    ticket: player.ticket,
    level: player.level,
    exp: player.exp,
    currentStage: player.currentStage,
    currentCharacter: player.currentCharacter,
    currentWeapon: player.currentWeapon,
    isGuest: player.isGuest,
    isBanned: player.isBanned,
    lastLogin: player.lastLogin,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
    vipLevel: player.vipLevel,
    vipExp: player.vipExp,
    farmStageMaxWave: player.farmStageMaxWave,
    personalMilestoneTier: player.personalMilestoneTier,
    personalMilestoneGreenTier: player.personalMilestoneGreenTier,
    isTestAccount: player.isTestAccount,
  });

  invalidateSheetCache(SHEET);

  // v7 #4: every new player starts with Pistol already equipped (not just
  // "ownable") so they can enter the first stage immediately without a trip
  // to the Character/Weapon page first.
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

async function updatePlayerByEmail(email: string, updates: Record<string, string | number | boolean>) {
  const found = await findRow(SHEET, (r) => r.email.toLowerCase() === email.toLowerCase());
  if (!found) throw new Error("Player not found");
  await updateRow(SHEET, found.rowIndex, { ...updates, updatedAt: new Date().toISOString() });
  invalidateSheetCache(SHEET);
}

export async function updatePlayer(id: string, updates: Partial<Record<keyof Player, string | number | boolean>>) {
  const found = await findRow(SHEET, (r) => r.id === id);
  if (!found) throw new Error("Player not found");
  await updateRow(SHEET, found.rowIndex, { ...updates, updatedAt: new Date().toISOString() });
  invalidateSheetCache(SHEET);
}

/** Records a new personal-best farm wave — also used to gate Azzure's SPECIAL unlock. */
export async function recordFarmWave(playerId: string, waveReached: number): Promise<void> {
  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");
  if (waveReached > player.farmStageMaxWave) {
    await updatePlayer(playerId, { farmStageMaxWave: waveReached });
  }
}

export async function addCurrency(playerId: string, delta: { coin?: number; diamond?: number; ticket?: number; exp?: number }): Promise<Player> {
  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");

  let newExp = player.exp + (delta.exp ?? 0);
  let newLevel = player.level;
  while (newExp >= ECONOMY_CONFIG.expPerLevel(newLevel) && newLevel < 100) {
    newExp -= ECONOMY_CONFIG.expPerLevel(newLevel);
    newLevel++;
  }

  const updates = {
    coin: player.coin + (delta.coin ?? 0),
    diamond: player.diamond + (delta.diamond ?? 0),
    ticket: player.ticket + (delta.ticket ?? 0),
    exp: newExp,
    level: newLevel,
  };

  await updatePlayer(playerId, updates);
  return { ...player, ...updates };
}

export { updatePlayerByEmail };

/** Strips passwordHash before sending player data to the client. */
export function toPublicPlayer(player: Player): Omit<Player, "passwordHash"> {
  const { passwordHash: _passwordHash, ...pub } = player;
  return pub;
}
