import { getSupabaseClient } from "../supabase/client";
import { addCurrency, getPlayerById } from "./player";
// Passive TIER config is game-balance data — still Google Sheets. Only the
// per-player currentTier below lives in Supabase.
export { getAllPassiveConfigs, MAX_PASSIVE_TIER, type PassiveId, type PassiveCurrency, type PassiveConfigRow } from "../google/passive";
import { getAllPassiveConfigs, MAX_PASSIVE_TIER, type PassiveId, type PassiveCurrency } from "../google/passive";

const TABLE = "player_passive";

export interface PlayerPassiveRow {
  playerId: string;
  passiveId: PassiveId;
  currentTier: number;
}

export async function getPlayerPassives(playerId: string): Promise<PlayerPassiveRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("player_id", playerId);
  if (error) throw new Error(`getPlayerPassives: ${error.message}`);
  return (data ?? []).map((r) => ({ playerId: r.player_id, passiveId: r.passive_id as PassiveId, currentTier: Number(r.current_tier ?? 0) }));
}

async function getCurrentTier(playerId: string, passiveId: PassiveId): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("current_tier").eq("player_id", playerId).eq("passive_id", passiveId).maybeSingle();
  if (error) throw new Error(`getCurrentTier: ${error.message}`);
  return Number(data?.current_tier ?? 0);
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

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).upsert({ player_id: playerId, passive_id: passiveId, current_tier: nextTier });
  if (error) throw new Error(`upgradePassive: ${error.message}`);

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
