/**
 * v5 migration — Master Change Request v3:
 *  - Azzure speed 80 -> 8 (was a typo, not a special case)
 *  - Weapons: add spreadDegrees column, fix gatling to single-shot-rapid-fire,
 *    narrow shotgun/gatling spread, remap bullet sprites to the 4 new bullet assets
 *  - Equipment: fully replaced with the new 4-rarity x 3-slot percent-bonus schema
 *  - New sheets: GachaConfig, PlayerEquipmentLevel
 *  - Removed sheet: Shop (equipment is gacha-only now)
 *
 * Safe to run once. Re-run is idempotent for the additive parts; the Equipment
 * sheet clear+reseed will just reproduce the same 12 rows again.
 */
import "dotenv/config";
import { ensureSheetExists, findRow, updateRow, appendRows, readSheetRaw } from "../src/lib/google/sheet";
import { getSheetsClient, getSpreadsheetId } from "../src/lib/google/google";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deleteSheet(sheetName: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    console.log(`  ${sheetName}: not found, skipping delete`);
    return;
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteSheet: { sheetId: sheet.properties.sheetId } }] },
  });
  console.log(`  Deleted sheet: ${sheetName}`);
}

async function clearSheetData(sheetName: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A1:ZZ10000` });
}

async function main() {
  // --- 1. Azzure speed typo fix ---
  console.log("Fixing Azzure speed 80 -> 8...");
  const azzure = await findRow("Characters", (r) => r.id === "azzure");
  if (azzure) {
    await updateRow("Characters", azzure.rowIndex, { speed: 8 });
    console.log("  Fixed");
  }
  await sleep(800);

  // --- 2. Weapons: new spreadDegrees column + gatling fix + bullet sprite remap ---
  console.log("Extending Weapons schema (spreadDegrees) + fixing gatling/shotgun/bullets...");
  await clearSheetData("Weapons");
  await sleep(800);
  await ensureSheetExists("Weapons", [
    "id", "name", "unlockType", "unlockValue", "priceCoin", "priceDiamond", "priceTicket",
    "damage", "fireRate", "fireMode", "projectileCount", "accuracy", "magazineSize", "reloadTime",
    "critChance", "critDamage", "dailyAmmo", "spreadDegrees", "sprite",
  ]);
  await sleep(1200);

  const roundBullet = "/assets/sprites/bullets/bullet_round.svg";
  await appendRows("Weapons", [
    { id: "pistol", name: "Pistol", unlockType: "FREE", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 0, damage: 20, fireRate: 1, fireMode: "single", projectileCount: 1, accuracy: 50, magazineSize: 8, reloadTime: 5, critChance: 8, critDamage: 300, dailyAmmo: 80, spreadDegrees: 3, sprite: roundBullet },
    { id: "double_pistol", name: "Double Pistol", unlockType: "STAGE", unlockValue: 10, priceCoin: 0, priceDiamond: 0, priceTicket: 0, damage: 20, fireRate: 2, fireMode: "single", projectileCount: 1, accuracy: 50, magazineSize: 16, reloadTime: 5, critChance: 8, critDamage: 300, dailyAmmo: 80, spreadDegrees: 4, sprite: roundBullet },
    { id: "m16a1", name: "M16A1", unlockType: "PURCHASE", unlockValue: 0, priceCoin: 1500, priceDiamond: 0, priceTicket: 0, damage: 15, fireRate: 5, fireMode: "single", projectileCount: 1, accuracy: 50, magazineSize: 30, reloadTime: 6, critChance: 10, critDamage: 250, dailyAmmo: 150, spreadDegrees: 2, sprite: roundBullet },
    { id: "m16a4", name: "M16A4", unlockType: "PURCHASE", unlockValue: 0, priceCoin: 4000, priceDiamond: 0, priceTicket: 0, damage: 20, fireRate: 1, fireMode: "burst", projectileCount: 3, accuracy: 60, magazineSize: 30, reloadTime: 6, critChance: 15, critDamage: 300, dailyAmmo: 150, spreadDegrees: 3, sprite: roundBullet },
    { id: "shotgun", name: "Shotgun", unlockType: "PURCHASE", unlockValue: 0, priceCoin: 15000, priceDiamond: 0, priceTicket: 0, damage: 20, fireRate: 1, fireMode: "spread", projectileCount: 16, accuracy: 50, magazineSize: 16, reloadTime: 5, critChance: 10, critDamage: 300, dailyAmmo: 160, spreadDegrees: 5, sprite: roundBullet },
    { id: "ak47", name: "AK47", unlockType: "DIAMOND", unlockValue: 0, priceCoin: 0, priceDiamond: 150, priceTicket: 0, damage: 30, fireRate: 4, fireMode: "single", projectileCount: 1, accuracy: 45, magazineSize: 40, reloadTime: 8, critChance: 20, critDamage: 400, dailyAmmo: 120, spreadDegrees: 4, sprite: roundBullet },
    // Gatling: was firing 12 pellets simultaneously (wrong) — now fires one bullet
    // per trigger like every other "single" weapon, just at a very high fireRate
    // (12/s), with a narrow 2-degree spread.
    { id: "gatling", name: "Gatling", unlockType: "DIAMOND", unlockValue: 0, priceCoin: 0, priceDiamond: 1800, priceTicket: 0, damage: 15, fireRate: 12, fireMode: "single", projectileCount: 1, accuracy: 45, magazineSize: 100, reloadTime: 20, critChance: 5, critDamage: 300, dailyAmmo: 500, spreadDegrees: 2, sprite: roundBullet },
    { id: "sniper", name: "Sniper", unlockType: "TICKET", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 399, damage: 100, fireRate: 0.5, fireMode: "single", projectileCount: 1, accuracy: 80, magazineSize: 5, reloadTime: 8, critChance: 40, critDamage: 450, dailyAmmo: 50, spreadDegrees: 0.5, sprite: roundBullet },
    { id: "rocket_launcher", name: "Rocket Launcher", unlockType: "TICKET", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 899, damage: 320, fireRate: 0.125, fireMode: "aoe", projectileCount: 1, accuracy: 100, magazineSize: 1, reloadTime: 8, critChance: 0, critDamage: 0, dailyAmmo: 10, spreadDegrees: 1, sprite: "/assets/sprites/bullets/bullet_rocket.svg" },
    { id: "grenade_launcher", name: "Grenade Launcher", unlockType: "TICKET", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 899, damage: 200, fireRate: 1, fireMode: "lob", projectileCount: 1, accuracy: 100, magazineSize: 6, reloadTime: 15, critChance: 0, critDamage: 0, dailyAmmo: 60, spreadDegrees: 1, sprite: "/assets/sprites/bullets/bullet_grenade.svg" },
    { id: "rasor_gun", name: "Rasor Gun", unlockType: "TICKET", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 1099, damage: 30, fireRate: 8, fireMode: "single", projectileCount: 1, accuracy: 70, magazineSize: 40, reloadTime: 8, critChance: 20, critDamage: 400, dailyAmmo: 160, spreadDegrees: 2, sprite: "/assets/sprites/bullets/bullet_razor.svg" },
  ]);
  await sleep(1200);
  console.log("  Weapons reseeded (11 rows)");

  // --- 3. Equipment: full schema replacement (4 rarities x 3 slots, percent bonuses) ---
  console.log("Replacing Equipment sheet with the new rarity/percent-bonus schema...");
  await clearSheetData("Equipment");
  await sleep(800);
  await ensureSheetExists("Equipment", ["id", "name", "slot", "rarity", "hpPercent", "damagePercent", "critChancePercent", "critDamagePercent", "sprite"]);
  await sleep(1200);

  // No dedicated rare/legendary art exists yet — reuse the closest available
  // sprite (common for rare, epic for legendary) until real art is provided.
  await appendRows("Equipment", [
    { id: "helmet_common", name: "Common Helmet", slot: "helmet", rarity: "common", hpPercent: 4, damagePercent: 0, critChancePercent: 0, critDamagePercent: 0, sprite: "/assets/sprites/equipment/helmet_common.svg" },
    { id: "helmet_rare", name: "Rare Helmet", slot: "helmet", rarity: "rare", hpPercent: 8, damagePercent: 8, critChancePercent: 0, critDamagePercent: 0, sprite: "/assets/sprites/equipment/helmet_common.svg" },
    { id: "helmet_epic", name: "Epic Helmet", slot: "helmet", rarity: "epic", hpPercent: 16, damagePercent: 16, critChancePercent: 0, critDamagePercent: 20, sprite: "/assets/sprites/equipment/helmet_epic.svg" },
    { id: "helmet_legendary", name: "Legendary Helmet", slot: "helmet", rarity: "legendary", hpPercent: 25, damagePercent: 25, critChancePercent: 4, critDamagePercent: 40, sprite: "/assets/sprites/equipment/helmet_epic.svg" },

    { id: "vest_common", name: "Common Vest", slot: "vest", rarity: "common", hpPercent: 5, damagePercent: 0, critChancePercent: 0, critDamagePercent: 0, sprite: "/assets/sprites/equipment/vest_common.svg" },
    { id: "vest_rare", name: "Rare Vest", slot: "vest", rarity: "rare", hpPercent: 10, damagePercent: 10, critChancePercent: 0, critDamagePercent: 0, sprite: "/assets/sprites/equipment/vest_common.svg" },
    { id: "vest_epic", name: "Epic Vest", slot: "vest", rarity: "epic", hpPercent: 20, damagePercent: 20, critChancePercent: 0, critDamagePercent: 10, sprite: "/assets/sprites/equipment/vest_epic.svg" },
    { id: "vest_legendary", name: "Legendary Vest", slot: "vest", rarity: "legendary", hpPercent: 30, damagePercent: 30, critChancePercent: 3, critDamagePercent: 30, sprite: "/assets/sprites/equipment/vest_epic.svg" },

    { id: "boots_common", name: "Common Boots", slot: "boots", rarity: "common", hpPercent: 3, damagePercent: 0, critChancePercent: 0, critDamagePercent: 0, sprite: "/assets/sprites/equipment/boots_common.svg" },
    { id: "boots_rare", name: "Rare Boots", slot: "boots", rarity: "rare", hpPercent: 6, damagePercent: 6, critChancePercent: 0, critDamagePercent: 0, sprite: "/assets/sprites/equipment/boots_common.svg" },
    { id: "boots_epic", name: "Epic Boots", slot: "boots", rarity: "epic", hpPercent: 12, damagePercent: 12, critChancePercent: 0, critDamagePercent: 30, sprite: "/assets/sprites/equipment/boots_epic.svg" },
    { id: "boots_legendary", name: "Legendary Boots", slot: "boots", rarity: "legendary", hpPercent: 20, damagePercent: 20, critChancePercent: 5, critDamagePercent: 50, sprite: "/assets/sprites/equipment/boots_epic.svg" },
  ]);
  await sleep(1200);
  console.log("  Equipment reseeded (12 rows)");

  // --- 4. New sheets: GachaConfig, PlayerEquipmentLevel ---
  console.log("Creating GachaConfig + PlayerEquipmentLevel sheets...");
  await ensureSheetExists("GachaConfig", ["poolId", "currency", "cost", "rewardType", "rarity", "rewardCurrency", "rewardAmount", "dropRate"]);
  await sleep(1200);
  await ensureSheetExists("PlayerEquipmentLevel", ["playerId", "equipmentId", "upgradeLevel"]);
  await sleep(1200);

  const { rows: existingGacha } = await readSheetRaw("GachaConfig");
  if (existingGacha.length === 0) {
    await appendRows("GachaConfig", [
      { poolId: "diamond_pool", currency: "diamond", cost: 100, rewardType: "equipment", rarity: "epic", rewardCurrency: "", rewardAmount: "", dropRate: 0.05 },
      { poolId: "diamond_pool", currency: "diamond", cost: 100, rewardType: "equipment", rarity: "rare", rewardCurrency: "", rewardAmount: "", dropRate: 0.20 },
      { poolId: "diamond_pool", currency: "diamond", cost: 100, rewardType: "equipment", rarity: "common", rewardCurrency: "", rewardAmount: "", dropRate: 0.35 },
      { poolId: "diamond_pool", currency: "diamond", cost: 100, rewardType: "currency", rarity: "", rewardCurrency: "coin", rewardAmount: 100, dropRate: 0.40 },

      { poolId: "ticket_pool", currency: "ticket", cost: 100, rewardType: "equipment", rarity: "legendary", rewardCurrency: "", rewardAmount: "", dropRate: 0.05 },
      { poolId: "ticket_pool", currency: "ticket", cost: 100, rewardType: "equipment", rarity: "epic", rewardCurrency: "", rewardAmount: "", dropRate: 0.20 },
      { poolId: "ticket_pool", currency: "ticket", cost: 100, rewardType: "equipment", rarity: "rare", rewardCurrency: "", rewardAmount: "", dropRate: 0.35 },
      { poolId: "ticket_pool", currency: "ticket", cost: 100, rewardType: "currency", rarity: "", rewardCurrency: "diamond", rewardAmount: 100, dropRate: 0.40 },
    ]);
    console.log("  GachaConfig seeded (8 rows)");
  } else {
    console.log("  GachaConfig already has data, skipping seed");
  }

  // --- 5. Remove the Shop sheet (equipment is gacha-only now) ---
  console.log("Removing Shop sheet (superseded by GachaConfig)...");
  await deleteSheet("Shop");

  // --- 6. Existing players' equipment ownership is now invalid (schema changed) ---
  console.log("Clearing PlayerEquipment (old schema's equipment ids no longer exist)...");
  await clearSheetData("PlayerEquipment");
  await sleep(800);
  await ensureSheetExists("PlayerEquipment", ["playerId", "equipmentId", "slot", "equipped"]);

  console.log("\nMigration v5 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
