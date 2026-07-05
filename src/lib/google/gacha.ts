import { getCachedSheet } from "./cache";
import { addCurrency, getPlayerById } from "./player";
import {
  getAllEquipment,
  ownsEquipment,
  grantEquipmentToPlayer,
  incrementEquipmentUpgradeLevel,
  type EquipmentSlot,
  type Rarity,
} from "./inventory";

const SHEET = "GachaConfig";

export type GachaCurrency = "diamond" | "ticket";
export type GachaRewardType = "equipment" | "currency";

export interface GachaConfigRow {
  poolId: string;
  currency: GachaCurrency;
  cost: number;
  rewardType: GachaRewardType;
  /** Only meaningful when rewardType === "equipment". */
  rarity: Rarity | "";
  /** Only meaningful when rewardType === "currency". */
  rewardCurrency: "coin" | "diamond" | "";
  rewardAmount: number;
  dropRate: number;
}

function rowToConfig(row: Record<string, string>): GachaConfigRow {
  return {
    poolId: row.poolId,
    currency: row.currency as GachaCurrency,
    cost: Number(row.cost || 0),
    rewardType: (row.rewardType || "equipment") as GachaRewardType,
    rarity: (row.rarity || "") as Rarity | "",
    rewardCurrency: (row.rewardCurrency || "") as "coin" | "diamond" | "",
    rewardAmount: Number(row.rewardAmount || 0),
    dropRate: Number(row.dropRate || 0),
  };
}

export async function getGachaPools(): Promise<GachaConfigRow[]> {
  const { rows } = await getCachedSheet(SHEET);
  return rows.map(rowToConfig);
}

export async function getGachaPool(poolId: string): Promise<GachaConfigRow[]> {
  const all = await getGachaPools();
  return all.filter((r) => r.poolId === poolId);
}

function weightedPick(entries: GachaConfigRow[]): GachaConfigRow {
  const total = entries.reduce((sum, e) => sum + e.dropRate, 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= entry.dropRate;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

const SLOTS: EquipmentSlot[] = ["helmet", "vest", "boots"];

export interface GachaPullResult {
  rewardType: GachaRewardType;
  rarity?: Rarity;
  slot?: EquipmentSlot;
  equipmentId?: string;
  equipmentName?: string;
  isDupe?: boolean;
  newUpgradeLevel?: number;
  rewardCurrency?: "coin" | "diamond";
  rewardAmount?: number;
}

/** v10 #1: x10 pull costs 10x the single-pull price minus a flat 5% discount
 *  (e.g. 100/pull diamond pool -> 1000 * 0.95 = 950 for the x10 button). */
const MULTI_PULL_COUNT = 10;
const MULTI_PULL_DISCOUNT = 0.05;

/** Resolves one weighted roll against an already-fetched pool into a reward,
 *  mutating equipment ownership/currency as a side effect — shared by both
 *  the single-pull and x10-pull paths so dupe/upgrade logic never diverges
 *  between them. Does NOT touch the pull cost currency; callers deduct that
 *  once upfront (a single pull's cost, or the discounted x10 total). */
async function rollOnce(playerId: string, pool: GachaConfigRow[]): Promise<GachaPullResult> {
  const picked = weightedPick(pool);

  if (picked.rewardType === "currency") {
    const rewardCurrency = picked.rewardCurrency as "coin" | "diamond";
    await addCurrency(playerId, { [rewardCurrency]: picked.rewardAmount } as Record<string, number>);
    return { rewardType: "currency", rewardCurrency, rewardAmount: picked.rewardAmount };
  }

  const rarity = picked.rarity as Rarity;
  const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];

  const catalog = await getAllEquipment();
  const item = catalog.find((e) => e.slot === slot && e.rarity === rarity);
  if (!item) throw new Error(`No equipment configured for slot=${slot} rarity=${rarity}`);

  const alreadyOwned = await ownsEquipment(playerId, item.id);

  if (alreadyOwned) {
    const newUpgradeLevel = await incrementEquipmentUpgradeLevel(playerId, item.id);
    return { rewardType: "equipment", rarity, slot, equipmentId: item.id, equipmentName: item.name, isDupe: true, newUpgradeLevel };
  }

  await grantEquipmentToPlayer(playerId, item.id);
  return { rewardType: "equipment", rarity, slot, equipmentId: item.id, equipmentName: item.name, isDupe: false };
}

/**
 * Pulls once from a gacha pool: rolls the weighted rarity/currency table, then
 * for equipment rewards rolls a random slot and resolves to the matching
 * (slot, rarity) item. A dupe (already owned) grants +1 PlayerEquipmentLevel
 * instead of a new inventory entry — the level-up IS the "value" of the dupe,
 * no extra cost.
 */
export async function pullGacha(playerId: string, poolId: string): Promise<GachaPullResult> {
  const pool = await getGachaPool(poolId);
  if (pool.length === 0) throw new Error("Gacha pool not found");

  const cost = pool[0].cost;
  const currency = pool[0].currency;

  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");

  const balance = currency === "diamond" ? player.diamond : player.ticket;
  if (balance < cost) throw new Error(`Not enough ${currency}`);

  await addCurrency(playerId, { [currency]: -cost } as Record<string, number>);
  return rollOnce(playerId, pool);
}

/** x10 pull: one discounted deduction upfront, then 10 independent rolls
 *  against the same pool — each roll's dupe/upgrade check runs against
 *  whatever the previous rolls in this same batch already granted, so two
 *  dupes of the same item within one x10 batch correctly stack their
 *  upgrade levels instead of colliding. */
export async function pullGachaMulti(playerId: string, poolId: string): Promise<GachaPullResult[]> {
  const pool = await getGachaPool(poolId);
  if (pool.length === 0) throw new Error("Gacha pool not found");

  const currency = pool[0].currency;
  const singleCost = pool[0].cost;
  const totalCost = Math.round(singleCost * MULTI_PULL_COUNT * (1 - MULTI_PULL_DISCOUNT));

  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");

  const balance = currency === "diamond" ? player.diamond : player.ticket;
  if (balance < totalCost) throw new Error(`Not enough ${currency}`);

  await addCurrency(playerId, { [currency]: -totalCost } as Record<string, number>);

  const results: GachaPullResult[] = [];
  for (let i = 0; i < MULTI_PULL_COUNT; i++) {
    results.push(await rollOnce(playerId, pool));
  }
  return results;
}
