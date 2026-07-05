import { invalidateSheetCache } from "./cache";
import { appendRow, findRow, updateRow } from "./sheet";
import { getWeaponById } from "./weapon";
import { addCurrency, getPlayerById } from "./player";

const SHEET = "PlayerWeaponAmmo";

// v7 #3: ad refill lowered 10% -> 5%, diamond refill cost raised 30 -> 40.
const DIAMOND_REFILL_COST = 40;
const AD_REFILL_PERCENT = 0.05;
const MAX_AD_REFILLS_PER_DAY = 5;

export interface PlayerWeaponAmmoRow {
  playerId: string;
  weaponId: string;
  remainingAmmo: number;
  lastResetDate: string;
  adRefillsToday: number;
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

async function getRow(playerId: string, weaponId: string) {
  return findRow(SHEET, (r) => r.playerId === playerId && r.weaponId === weaponId);
}

/**
 * Returns today's remaining ammo for a weapon, resetting to the full daily quota
 * if the date rolled over. `effectiveDailyAmmo` lets the caller apply the
 * dailyAmmoPercent passive bonus on top of the weapon's base `dailyAmmo` —
 * defaults to the weapon's raw quota if not provided.
 */
export async function getRemainingAmmo(playerId: string, weaponId: string, effectiveDailyAmmo?: number): Promise<number> {
  const weapon = await getWeaponById(weaponId);
  if (!weapon) throw new Error("Weapon not found");
  const quota = effectiveDailyAmmo ?? weapon.dailyAmmo;

  const today = todayString();
  const found = await getRow(playerId, weaponId);

  if (!found) {
    await appendRow(SHEET, { playerId, weaponId, remainingAmmo: quota, lastResetDate: today, adRefillsToday: 0 });
    invalidateSheetCache(SHEET);
    return quota;
  }

  if (found.row.lastResetDate !== today) {
    await updateRow(SHEET, found.rowIndex, { remainingAmmo: quota, lastResetDate: today, adRefillsToday: 0 });
    invalidateSheetCache(SHEET);
    return quota;
  }

  return Number(found.row.remainingAmmo || 0);
}

export async function deductWeaponAmmo(playerId: string, weaponId: string, amount: number): Promise<number> {
  const remaining = await getRemainingAmmo(playerId, weaponId);
  const next = Math.max(0, remaining - amount);
  const found = await getRow(playerId, weaponId);
  if (found) await updateRow(SHEET, found.rowIndex, { remainingAmmo: next });
  invalidateSheetCache(SHEET);
  return next;
}

/** Watch a rewarded ad: +5% of the weapon's daily ammo quota, capped at 5 ad-refills/day per weapon. */
export async function refillAmmoViaAd(playerId: string, weaponId: string, effectiveDailyAmmo?: number): Promise<number> {
  const weapon = await getWeaponById(weaponId);
  if (!weapon) throw new Error("Weapon not found");
  const quota = effectiveDailyAmmo ?? weapon.dailyAmmo;

  const remaining = await getRemainingAmmo(playerId, weaponId, quota);
  const found = await getRow(playerId, weaponId);
  const adRefillsToday = found ? Number(found.row.adRefillsToday || 0) : 0;
  if (adRefillsToday >= MAX_AD_REFILLS_PER_DAY) throw new Error("Daily ad-refill limit reached for this weapon");

  const bonus = Math.round(quota * AD_REFILL_PERCENT);
  const next = Math.min(quota, remaining + bonus);

  if (found) await updateRow(SHEET, found.rowIndex, { remainingAmmo: next, adRefillsToday: adRefillsToday + 1 });
  invalidateSheetCache(SHEET);
  return next;
}

/** Pay 40 diamonds to instantly refill this weapon's ammo to 100% of its daily quota. */
export async function refillAmmoViaDiamond(playerId: string, weaponId: string, effectiveDailyAmmo?: number): Promise<number> {
  const weapon = await getWeaponById(weaponId);
  if (!weapon) throw new Error("Weapon not found");
  const quota = effectiveDailyAmmo ?? weapon.dailyAmmo;

  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");
  if (player.diamond < DIAMOND_REFILL_COST) throw new Error("Not enough diamonds");

  await addCurrency(playerId, { diamond: -DIAMOND_REFILL_COST });

  // Ensure a row exists (also handles the daily-reset check) before overwriting it to full.
  await getRemainingAmmo(playerId, weaponId, quota);
  const found = await getRow(playerId, weaponId);
  if (found) await updateRow(SHEET, found.rowIndex, { remainingAmmo: quota, lastResetDate: todayString() });
  invalidateSheetCache(SHEET);
  return quota;
}

export { DIAMOND_REFILL_COST };
