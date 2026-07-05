/**
 * v4 migration — the "Master Change Request" rewrite. Deletes sheets that no
 * longer exist in the schema (Redeem, Config, Analytics, StageReward,
 * DailyMission, LootBox, LootBoxItem), clears out data for every sheet whose
 * column layout changed (Players, Characters, Weapons, Enemies, Equipment,
 * Stage, StageEnemy, Shop, PlayerCharacter, PlayerWeapon, PlayerEquipment),
 * and rewrites their headers to the new schema. After this runs,
 * `npm run sheets:init` reseeds everything fresh (it only seeds sheets it
 * finds empty, which every cleared sheet now is).
 *
 * Safe to run once. Only the admin account (earth_npn@admin.local) existed in
 * Players at migration time, and item 0's reset-player.ts resets it anyway,
 * so no data preservation logic is needed here.
 */
import "dotenv/config";
import { getSheetsClient, getSpreadsheetId } from "../src/lib/google/google";
import { ensureSheetExists } from "../src/lib/google/sheet";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SHEETS_TO_DELETE = ["Redeem", "Config", "Analytics", "StageReward", "DailyMission", "LootBox", "LootBoxItem", "Inventory"];

const NEW_HEADERS: Record<string, string[]> = {
  Players: [
    "id", "email", "username", "passwordHash", "coin", "diamond", "ticket", "level", "exp",
    "currentStage", "currentCharacter", "currentWeapon", "vipLevel", "farmStageMaxWave",
    "isGuest", "isBanned", "lastLogin", "createdAt", "updatedAt",
  ],
  Characters: [
    "id", "name", "rank", "unlockType", "unlockValue", "vipRequirement", "waveRequirement",
    "hpCurrent", "hpMax", "speed", "accuracy", "regenPer5s", "armorPercent", "critChance", "critDamage", "sprite",
  ],
  Weapons: [
    "id", "name", "unlockType", "unlockValue", "priceCoin", "priceDiamond", "priceTicket",
    "damage", "fireRate", "fireMode", "projectileCount", "accuracy", "magazineSize", "reloadTime",
    "critChance", "critDamage", "dailyAmmo", "sprite",
  ],
  Equipment: ["id", "name", "slot", "rarity", "hp", "armorPercent", "damage", "critChance", "accuracy", "speed", "sprite"],
  Enemies: ["id", "weaponId", "hp", "coinReward", "sprite"],
  Stage: ["id", "name", "isRepeatable", "width", "height", "background", "rewardCoin", "rewardExp"],
  StageEnemy: ["stageId", "enemyId", "spawnX", "spawnY"],
  Shop: ["id", "equipmentId", "priceCoin", "priceDiamond", "priceTicket"],
  PlayerCharacter: ["playerId", "characterId", "owned"],
  PlayerWeapon: ["playerId", "weaponId", "owned", "equipped"],
  PlayerEquipment: ["playerId", "equipmentId", "slot", "equipped"],
};

async function clearSheetData(sheetName: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A2:ZZ10000` });
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

async function main() {
  console.log("Deleting obsolete sheets...");
  for (const name of SHEETS_TO_DELETE) {
    await deleteSheet(name);
    await sleep(1000);
  }

  console.log("\nClearing + rewriting headers for sheets with a new schema...");
  for (const [name, headers] of Object.entries(NEW_HEADERS)) {
    await clearSheetData(name);
    await sleep(800);
    await ensureSheetExists(name, headers);
    await sleep(1200);
    console.log(`  ✓ ${name} (cleared + new header)`);
  }

  console.log("\nMigration v4 complete. Run `npm run sheets:init` next to reseed everything.");
}

main().catch((e) => { console.error(e); process.exit(1); });
