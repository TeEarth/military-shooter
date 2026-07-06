import { getSupabaseClient } from "../supabase/client";
import { getWeaponById } from "../google/weapon";
import { addCurrency, getPlayerById } from "./player";

const TABLE = "player_weapon_ammo";

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
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("player_id", playerId).eq("weapon_id", weaponId).maybeSingle();
  if (error) throw new Error(`getRow(weaponAmmo): ${error.message}`);
  return data;
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
  const supabase = getSupabaseClient();

  if (!found) {
    const { error } = await supabase.from(TABLE).insert({ player_id: playerId, weapon_id: weaponId, remaining_ammo: quota, last_reset_date: today, ad_refills_today: 0 });
    if (error) throw new Error(`getRemainingAmmo (insert): ${error.message}`);
    return quota;
  }

  if (found.last_reset_date !== today) {
    const { error } = await supabase.from(TABLE).update({ remaining_ammo: quota, last_reset_date: today, ad_refills_today: 0 }).eq("player_id", playerId).eq("weapon_id", weaponId);
    if (error) throw new Error(`getRemainingAmmo (reset): ${error.message}`);
    return quota;
  }

  return Number(found.remaining_ammo ?? 0);
}

export async function deductWeaponAmmo(playerId: string, weaponId: string, amount: number): Promise<number> {
  const remaining = await getRemainingAmmo(playerId, weaponId);
  const next = Math.max(0, remaining - amount);
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).update({ remaining_ammo: next }).eq("player_id", playerId).eq("weapon_id", weaponId);
  if (error) throw new Error(`deductWeaponAmmo: ${error.message}`);
  return next;
}

/** Watch a rewarded ad: +5% of the weapon's daily ammo quota, capped at 5 ad-refills/day per weapon. */
export async function refillAmmoViaAd(playerId: string, weaponId: string, effectiveDailyAmmo?: number): Promise<number> {
  const weapon = await getWeaponById(weaponId);
  if (!weapon) throw new Error("Weapon not found");
  const quota = effectiveDailyAmmo ?? weapon.dailyAmmo;

  const remaining = await getRemainingAmmo(playerId, weaponId, quota);
  const found = await getRow(playerId, weaponId);
  const adRefillsToday = found ? Number(found.ad_refills_today ?? 0) : 0;
  if (adRefillsToday >= MAX_AD_REFILLS_PER_DAY) throw new Error("Daily ad-refill limit reached for this weapon");

  const bonus = Math.round(quota * AD_REFILL_PERCENT);
  const next = Math.min(quota, remaining + bonus);

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).update({ remaining_ammo: next, ad_refills_today: adRefillsToday + 1 }).eq("player_id", playerId).eq("weapon_id", weaponId);
  if (error) throw new Error(`refillAmmoViaAd: ${error.message}`);
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
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).update({ remaining_ammo: quota, last_reset_date: todayString() }).eq("player_id", playerId).eq("weapon_id", weaponId);
  if (error) throw new Error(`refillAmmoViaDiamond: ${error.message}`);
  return quota;
}

export { DIAMOND_REFILL_COST };
