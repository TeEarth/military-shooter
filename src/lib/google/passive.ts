import { getConfigRows } from "../db/configCache";

const PASSIVE_CONFIG_SHEET = "PassiveConfig";

// v16: this file used to also contain PlayerPassive read/write functions
// backed directly by Google Sheets — those were fully superseded by the
// Supabase-backed versions in src/lib/db/passive.ts during the v12 migration
// and had been dead code (zero imports) ever since. Removed as part of the
// v16 cleanup; this file now only holds the Passive TIER config catalog.

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
  const rows = await getConfigRows(PASSIVE_CONFIG_SHEET);
  return rows.map(rowToPassiveConfig).sort((a, b) => a.passiveId.localeCompare(b.passiveId) || a.tier - b.tier);
}
