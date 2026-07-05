import { getCachedSheet, invalidateSheetCache } from "./cache";
import { appendRow, findRow, findRows, updateRow } from "./sheet";
import { addCurrency, getPlayerById } from "./player";

const PASSIVE_CONFIG_SHEET = "PassiveConfig";
const PLAYER_PASSIVE_SHEET = "PlayerPassive";

export type PassiveCurrency = "coin" | "diamond" | "ticket";

export type PassiveId =
  | "hpPercent"
  | "critChance"
  | "accuracy"
  | "damagePercent"
  | "reloadSpeedPercent"
  | "fireRatePercent"
  | "dailyAmmoPercent"
  | "critDamagePercent";

export const MAX_PASSIVE_TIER = 10;

export interface PassiveConfigRow {
  passiveId: PassiveId;
  tier: number;
  cost: number;
  currency: PassiveCurrency;
  bonusPercent: number;
}

function rowToPassiveConfig(row: Record<string, string>): PassiveConfigRow {
  return {
    passiveId: row.passiveId as PassiveId,
    tier: Number(row.tier || 1),
    cost: Number(row.cost || 0),
    currency: (row.currency || "coin") as PassiveCurrency,
    bonusPercent: Number(row.bonusPercent || 0),
  };
}

export async function getAllPassiveConfigs(): Promise<PassiveConfigRow[]> {
  const { rows } = await getCachedSheet(PASSIVE_CONFIG_SHEET);
  return rows.map(rowToPassiveConfig).sort((a, b) => a.passiveId.localeCompare(b.passiveId) || a.tier - b.tier);
}

export interface PlayerPassiveRow {
  playerId: string;
  passiveId: PassiveId;
  currentTier: number;
}

export async function getPlayerPassives(playerId: string): Promise<PlayerPassiveRow[]> {
  const rows = await findRows(PLAYER_PASSIVE_SHEET, (r) => r.playerId === playerId);
  return rows.map((r) => ({ playerId: r.playerId, passiveId: r.passiveId as PassiveId, currentTier: Number(r.currentTier || 0) }));
}

async function getCurrentTier(playerId: string, passiveId: PassiveId): Promise<number> {
  const found = await findRow(PLAYER_PASSIVE_SHEET, (r) => r.playerId === playerId && r.passiveId === passiveId);
  return found ? Number(found.row.currentTier || 0) : 0;
}

export async function upgradePassive(playerId: string, passiveId: PassiveId): Promise<{ newTier: number; cost: number; currency: PassiveCurrency }> {
  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");

  const currentTier = await getCurrentTier(playerId, passiveId);
  if (currentTier >= MAX_PASSIVE_TIER) throw new Error("Already at max tier");

  const nextTier = currentTier + 1;
  const configs = await getAllPassiveConfigs();
  const config = configs.find((c) => c.passiveId === passiveId && c.tier === nextTier);
  if (!config) throw new Error("Passive tier config not found");

  const balance = config.currency === "coin" ? player.coin : config.currency === "diamond" ? player.diamond : player.ticket;
  if (balance < config.cost) throw new Error(`Not enough ${config.currency}`);

  await addCurrency(playerId, { [config.currency]: -config.cost } as Record<string, number>);

  const found = await findRow(PLAYER_PASSIVE_SHEET, (r) => r.playerId === playerId && r.passiveId === passiveId);
  if (found) {
    await updateRow(PLAYER_PASSIVE_SHEET, found.rowIndex, { currentTier: nextTier });
  } else {
    await appendRow(PLAYER_PASSIVE_SHEET, { playerId, passiveId, currentTier: nextTier });
  }
  invalidateSheetCache(PLAYER_PASSIVE_SHEET);

  return { newTier: nextTier, cost: config.cost, currency: config.currency };
}

export type PassiveTotals = Record<PassiveId, number>;

/** Sums bonusPercent across every tier owned (1..currentTier) for each passive — these are the global multipliers applied at game start. */
export async function getPassiveTotals(playerId: string): Promise<PassiveTotals> {
  const [playerPassives, configs] = await Promise.all([getPlayerPassives(playerId), getAllPassiveConfigs()]);

  const totals = {
    hpPercent: 0, critChance: 0, accuracy: 0, damagePercent: 0,
    reloadSpeedPercent: 0, fireRatePercent: 0, dailyAmmoPercent: 0, critDamagePercent: 0,
  } as Record<PassiveId, number>;

  for (const pp of playerPassives) {
    const tiersOwned = configs.filter((c) => c.passiveId === pp.passiveId && c.tier <= pp.currentTier);
    totals[pp.passiveId] = tiersOwned.reduce((sum, c) => sum + c.bonusPercent, 0);
  }

  return totals;
}
