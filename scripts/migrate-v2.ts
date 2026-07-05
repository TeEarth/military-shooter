/**
 * v2 migration: enemy weapon variety, harder/pricier balance, VIP + TrueMoney
 * redeem fields on Players, loot box sheets, and the owner's admin account.
 * Safe to re-run for the idempotent parts (ensureSheetExists, admin account
 * lookup-before-create); the price/stat overwrites are NOT idempotent —
 * running twice re-applies the same target numbers, which is harmless.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { ensureSheetExists, findRow, updateRow, appendRow, appendRows, readSheetRaw } from "../src/lib/google/sheet";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // --- 1. Enemies: add weaponType column + harder stats ---
  console.log("Updating Enemies sheet (weaponType + harder stats)...");
  await ensureSheetExists("Enemies", ["id", "name", "hp", "damage", "accuracy", "speed", "rewardCoin", "rewardExp", "dropRate", "sprite", "weaponType"]);
  await sleep(1200);

  const enemyUpdates: Record<string, Record<string, string | number>> = {
    "normal-soldier": { hp: 90, damage: 16, accuracy: 65, weaponType: "rifle" },
    "heavy-soldier": { hp: 320, damage: 30, accuracy: 70, weaponType: "shotgun" },
    "sniper-enemy": { hp: 110, damage: 85, accuracy: 95, weaponType: "sniper" },
    "rocket-soldier": { hp: 180, damage: 130, accuracy: 75, weaponType: "rocket" },
    "boss": { hp: 1800, damage: 60, accuracy: 85, weaponType: "rifle" },
  };
  for (const [id, updates] of Object.entries(enemyUpdates)) {
    const found = await findRow("Enemies", (r) => r.id === id);
    if (found) await updateRow("Enemies", found.rowIndex, updates);
    await sleep(800);
  }

  // --- 2. Characters: pricier ---
  console.log("Raising Character prices...");
  const characterPriceUpdates: Record<string, Record<string, number>> = {
    "m16a1": { priceCoin: 6000 },
    "m16a4": { priceCoin: 9000 },
    "ak47": { priceDiamond: 280 },
    "shotgun": { priceCoin: 12000 },
    "sniper": { priceDiamond: 550 },
    "rocket": { priceDiamond: 900 },
    "grenade-launcher": { priceDiamond: 1500 },
  };
  for (const [id, updates] of Object.entries(characterPriceUpdates)) {
    const found = await findRow("Characters", (r) => r.id === id);
    if (found) await updateRow("Characters", found.rowIndex, updates);
    await sleep(800);
  }

  // --- 3. Equipment: pricier ---
  console.log("Raising Equipment prices...");
  const equipmentPriceUpdates: Record<string, Record<string, number>> = {
    "helmet_common_01": { priceCoin: 800 },
    "helmet_rare_01": { priceCoin: 3200 },
    "armor_common_01": { priceCoin: 1000 },
    "armor_rare_01": { priceCoin: 4000 },
    "glove_common_01": { priceCoin: 500 },
    "boot_common_01": { priceCoin: 600 },
    "backpack_common_01": { priceCoin: 700 },
    "acc_common_01": { priceCoin: 500 },
    "acc_epic_01": { priceDiamond: 220 },
  };
  for (const [id, updates] of Object.entries(equipmentPriceUpdates)) {
    const found = await findRow("Equipment", (r) => r.id === id);
    if (found) await updateRow("Equipment", found.rowIndex, updates);
    await sleep(800);
  }

  // --- 4. Players: VIP + TrueMoney redeem fields ---
  console.log("Extending Players sheet with VIP/redeem columns...");
  await ensureSheetExists("Players", [
    "id", "email", "username", "passwordHash", "coin", "diamond", "ticket", "level", "exp",
    "currentStage", "currentCharacter", "ammo", "ammoDate", "adsWatchedToday", "isGuest", "isBanned",
    "lastLogin", "createdAt", "updatedAt",
    "totalTopupThb", "vipLevel", "ticketRedeemedToday", "ticketRedeemDate", "trueMoneyNumber",
  ]);
  await sleep(1200);

  // --- 4b. Redeem: add trueMoneyNumber column ---
  console.log("Extending Redeem sheet with trueMoneyNumber column...");
  await ensureSheetExists("Redeem", ["id", "playerId", "ticket", "status", "createdAt", "trueMoneyNumber"]);
  await sleep(1200);

  // --- 5. Config: VIP tiers + daily redeem cap ---
  console.log("Adding VIP/redeem Config keys...");
  const { rows: configRows } = await readSheetRaw("Config");
  const existingKeys = new Set(configRows.map((r) => r.key));
  const newConfigRows = [
    { key: "ticketRedeemMaxPerDay", value: "200" },
    { key: "vipTopupThresholds", value: "500:1,2000:2,5000:3,15000:4,50000:5" },
    { key: "vipRedeemBonusPerLevel", value: "100" },
  ].filter((r) => !existingKeys.has(r.key));
  if (newConfigRows.length > 0) await appendRows("Config", newConfigRows);
  await sleep(1200);

  // --- 6. Loot box sheets ---
  console.log("Creating LootBox + LootBoxItem sheets...");
  await ensureSheetExists("LootBox", ["id", "name", "priceCoin", "priceDiamond", "sprite"]);
  await sleep(1200);
  await ensureSheetExists("LootBoxItem", ["lootBoxId", "rewardType", "rewardValue", "amount", "weight"]);
  await sleep(1200);

  const { rows: existingBoxes } = await readSheetRaw("LootBox");
  if (existingBoxes.length === 0) {
    await appendRows("LootBox", [
      { id: "box_normal", name: "Normal Crate", priceCoin: 500, priceDiamond: 0, sprite: "/assets/sprites/ui/box_normal.png" },
      { id: "box_premium", name: "Premium Crate", priceCoin: 0, priceDiamond: 80, sprite: "/assets/sprites/ui/box_premium.png" },
      { id: "box_legendary", name: "Legendary Crate", priceCoin: 0, priceDiamond: 250, sprite: "/assets/sprites/ui/box_legendary.png" },
    ]);
    await sleep(1200);
  }

  const { rows: existingBoxItems } = await readSheetRaw("LootBoxItem");
  if (existingBoxItems.length === 0) {
    await appendRows("LootBoxItem", [
      // box_normal — mostly coin/small diamond, common equipment
      { lootBoxId: "box_normal", rewardType: "coin", rewardValue: "", amount: 300, weight: 40 },
      { lootBoxId: "box_normal", rewardType: "diamond", rewardValue: "", amount: 5, weight: 15 },
      { lootBoxId: "box_normal", rewardType: "equipment", rewardValue: "helmet_common_01", amount: 1, weight: 20 },
      { lootBoxId: "box_normal", rewardType: "equipment", rewardValue: "glove_common_01", amount: 1, weight: 20 },
      { lootBoxId: "box_normal", rewardType: "ticket", rewardValue: "", amount: 1, weight: 5 },

      // box_premium — better odds, rare equipment, chance of diamonds
      { lootBoxId: "box_premium", rewardType: "coin", rewardValue: "", amount: 1500, weight: 25 },
      { lootBoxId: "box_premium", rewardType: "diamond", rewardValue: "", amount: 20, weight: 25 },
      { lootBoxId: "box_premium", rewardType: "equipment", rewardValue: "helmet_rare_01", amount: 1, weight: 20 },
      { lootBoxId: "box_premium", rewardType: "equipment", rewardValue: "armor_rare_01", amount: 1, weight: 20 },
      { lootBoxId: "box_premium", rewardType: "ticket", rewardValue: "", amount: 3, weight: 10 },

      // box_legendary — guaranteed high value, chance at premium characters
      { lootBoxId: "box_legendary", rewardType: "diamond", rewardValue: "", amount: 100, weight: 30 },
      { lootBoxId: "box_legendary", rewardType: "equipment", rewardValue: "acc_epic_01", amount: 1, weight: 25 },
      { lootBoxId: "box_legendary", rewardType: "character", rewardValue: "ak47", amount: 1, weight: 15 },
      { lootBoxId: "box_legendary", rewardType: "character", rewardValue: "sniper", amount: 1, weight: 10 },
      { lootBoxId: "box_legendary", rewardType: "ticket", rewardValue: "", amount: 10, weight: 20 },
    ]);
    await sleep(1200);
  }

  // --- 7. Owner admin account ---
  console.log("Creating admin account Earth_npn...");
  const adminEmail = "earth_npn@admin.local";
  const existingAdmin = await findRow("Players", (r) => r.email === adminEmail);
  if (!existingAdmin) {
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash("Earth629629", 10);
    await appendRow("Players", {
      id: `player_admin_${Date.now().toString(36)}`,
      email: adminEmail,
      username: "Earth_npn",
      passwordHash,
      coin: 999999,
      diamond: 999999,
      ticket: 999999,
      level: 1,
      exp: 0,
      currentStage: 1,
      currentCharacter: "pistol",
      ammo: 100,
      ammoDate: now.split("T")[0],
      adsWatchedToday: 0,
      isGuest: false,
      isBanned: false,
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
      totalTopupThb: 0,
      vipLevel: 5,
      ticketRedeemedToday: 0,
      ticketRedeemDate: "",
      trueMoneyNumber: "",
    });
    console.log("  Created player row for Earth_npn (login email: earth_npn@admin.local / password: Earth629629)");
  } else {
    console.log("  Earth_npn already exists, skipping creation.");
  }
  await sleep(800);

  const adminConfig = await findRow("Config", (r) => r.key === "adminEmails");
  if (adminConfig) {
    const emails = adminConfig.row.value ? adminConfig.row.value.split(",").map((e) => e.trim()).filter(Boolean) : [];
    if (!emails.includes(adminEmail)) {
      emails.push(adminEmail);
      await updateRow("Config", adminConfig.rowIndex, { value: emails.join(",") });
      console.log("  Added earth_npn@admin.local to adminEmails");
    }
  }

  console.log("\nMigration v2 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
