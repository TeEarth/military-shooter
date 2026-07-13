/**
 * v24: per-multiverse boss config + Rasor Gun's farm-wave unlock.
 *
 * - BossStage sheet gets 4 new columns (multiverse, minionEnemyId,
 *   damageMultiplier, background) so each multiverse's boss can have its own
 *   explicit stats instead of everything being a multiplier off Multiverse 1's
 *   numbers (see src/lib/google/bossStage.ts's rework).
 *   - Multiverse 1 boss: hp bumped to 10000 (was 4000).
 *   - Multiverse 2 boss (new row): hp 25000, summons enemy_double_pistol
 *     (was enemy_pistol), damageMultiplier 3x, fights on sand_terrain.svg.
 * - Weapons sheet: Rasor Gun switches from a flat 1099-ticket purchase to
 *   unlockType "FARM_WAVE" (unlocks once the player's all-time best farm wave,
 *   from ANY multiverse's farm stage, reaches unlockValue) — still costs
 *   1099 tickets to actually buy once unlocked, same as before, just gated
 *   behind a wave milestone first. Picked wave 15 as the threshold (a couple
 *   tiers past the point Farm 2's toughest enemies start appearing) — easy to
 *   change later, it's just one cell.
 *
 * Run with: npx tsx scripts/migrate-v24.ts
 */
import "dotenv/config";
import { getSheetsClient, getSpreadsheetId } from "../src/lib/google/google";
import { getHeaders, readSheetRaw, updateRow, appendRow } from "../src/lib/google/sheet";

async function ensureColumn(sheetName: string, columnName: string) {
  const headers = await getHeaders(sheetName);
  if (headers.includes(columnName)) return;
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const colLetter = String.fromCharCode(65 + headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${colLetter}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[columnName]] },
  });
  console.log(`  Added column "${columnName}" to ${sheetName} at ${colLetter}1`);
}

const RASOR_GUN_UNLOCK_WAVE = 15;

async function main() {
  for (const col of ["multiverse", "minionEnemyId", "damageMultiplier", "background"]) {
    await ensureColumn("BossStage", col);
  }

  const { rows: bossRows } = await readSheetRaw("BossStage");
  const mv1Idx = bossRows.findIndex((r) => r.bossId === "boss_01");
  if (mv1Idx === -1) throw new Error("boss_01 row not found");
  await updateRow("BossStage", mv1Idx, {
    hp: 10000,
    multiverse: 1,
    minionEnemyId: "enemy_pistol",
    damageMultiplier: 1,
    background: "/assets/sprites/background/rock_terrain.svg",
  });
  console.log("  Multiverse 1 boss: hp=10000, minion=enemy_pistol, damageMultiplier=1");

  const hasMv2 = bossRows.some((r) => r.multiverse === "2" || r.bossId === "boss_02");
  if (!hasMv2) {
    await appendRow("BossStage", {
      bossId: "boss_02",
      hp: 25000,
      weaponId: "double_pistol",
      rocketCount: 5,
      growthPercent: 10,
      occursEveryNStages: 10,
      multiverse: 2,
      minionEnemyId: "enemy_double_pistol",
      damageMultiplier: 3,
      background: "/assets/sprites/background/sand_terrain.svg",
    });
    console.log("  Added Multiverse 2 boss row: hp=25000, minion=enemy_double_pistol, damageMultiplier=3, sand background");
  } else {
    console.log("  Multiverse 2 boss row already present, skipping");
  }

  const { rows: weaponRows } = await readSheetRaw("Weapons");
  const rasorIdx = weaponRows.findIndex((r) => r.id === "rasor_gun");
  if (rasorIdx === -1) throw new Error("rasor_gun row not found");
  await updateRow("Weapons", rasorIdx, { unlockType: "FARM_WAVE", unlockValue: RASOR_GUN_UNLOCK_WAVE });
  console.log(`  Rasor Gun: unlockType=FARM_WAVE, unlockValue=${RASOR_GUN_UNLOCK_WAVE} (still ${weaponRows[rasorIdx].priceTicket} tickets to buy once unlocked)`);

  console.log("\nMigration v24 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
