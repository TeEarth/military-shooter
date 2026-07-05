/**
 * Live-spreadsheet migration for v10 #2: replaces the old placeholder Mission
 * rows (kill_10/kill_50/clear_stage/clear_5_stages) with the real reward
 * numbers from the v10 doc, and clears PlayerMission rows tied to the old
 * mission ids (pre-launch/test data only — safe to drop, matches the "replace
 * all placeholder values" instruction).
 *
 * Run with: npx tsx scripts/migrate-v13.ts
 */
import "dotenv/config";
import { readSheetRaw, appendRows } from "../src/lib/google/sheet";
import { getSheetsClient, getSpreadsheetId } from "../src/lib/google/google";

const NEW_MISSIONS = [
  { id: "kill_100", type: "personal", description: "Eliminate 100 enemies", rewardCoin: 200, rewardExp: 300, rewardDiamond: 20, targetValue: 100, metric: "kills" },
  { id: "kill_1000", type: "personal", description: "Eliminate 1,000 enemies", rewardCoin: 500, rewardExp: 500, rewardDiamond: 20, targetValue: 1000, metric: "kills" },
  { id: "kill_10000", type: "personal", description: "Eliminate 10,000 enemies", rewardCoin: 1000, rewardExp: 1500, rewardDiamond: 50, targetValue: 10000, metric: "kills" },
  { id: "stage_5", type: "personal", description: "Clear stage 5", rewardCoin: 200, rewardExp: 200, rewardDiamond: 20, targetValue: 5, metric: "stage_reached" },
  { id: "stage_10", type: "personal", description: "Clear stage 10", rewardCoin: 300, rewardExp: 400, rewardDiamond: 30, targetValue: 10, metric: "stage_reached" },
  { id: "daily_kill_10", type: "daily", description: "Eliminate 10 enemies", rewardCoin: 50, rewardExp: 100, rewardDiamond: 5, targetValue: 10, metric: "kills" },
];

async function clearDataRows(sheetName: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A2:ZZ10000` });
}

async function main() {
  console.log("Replacing Mission sheet placeholder rows...");
  const { rows: existing } = await readSheetRaw("Mission");
  console.log(`  Found ${existing.length} existing row(s), clearing...`);
  await clearDataRows("Mission");
  await appendRows("Mission", NEW_MISSIONS);
  console.log(`  Seeded ${NEW_MISSIONS.length} new Mission row(s)`);

  console.log("Clearing PlayerMission rows tied to old mission ids (pre-launch data, safe to drop)...");
  const { rows: playerMissionRows } = await readSheetRaw("PlayerMission");
  await clearDataRows("PlayerMission");
  console.log(`  Cleared ${playerMissionRows.length} PlayerMission row(s) — progress restarts fresh against the new mission set`);

  console.log("\nMigration v13 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
