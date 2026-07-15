/**
 * v29: Multiverse 3's boss (fought after clearing stage30, unlocks Multiverse
 * 4) + Multiverse 4 placeholder stages.
 *
 * - BossStage gets a new `summonIntervalMs` column (defaults to 15000 for
 *   every existing row — see src/lib/google/bossStage.ts) so a boss's minion
 *   cadence can differ per multiverse instead of the old hardcoded 15s used
 *   by every boss.
 * - New Multiverse 3 boss row: wields the Gatling gun, hp 30000, 3x damage
 *   (applied on top of the Gatling's own base damage — see
 *   src/app/api/game/start/route.ts's `bossWeaponBase.damage * damageMultiplier`),
 *   summons an AK47-wielding enemy every 10s (summonIntervalMs=10000, vs the
 *   15000 default), fought on the new swamp_terrain.svg background.
 * - Multiverse 4: placeholder story stages (stage31-40), comingSoon=true —
 *   same pattern used for Multiverse 2 in init-sheets.ts before its real
 *   layouts were designed. Shows up in the multiverse tab list once unlocked
 *   (after Multiverse 3's boss is cleared) but isn't playable yet.
 *
 * Run with: npx tsx scripts/migrate-v29.ts
 */
import "dotenv/config";
import { getSheetsClient, getSpreadsheetId } from "../src/lib/google/google";
import { getHeaders, readSheetRaw, appendRow } from "../src/lib/google/sheet";

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

async function main() {
  await ensureColumn("BossStage", "summonIntervalMs");

  const { rows: bossRows } = await readSheetRaw("BossStage");
  const hasMv3 = bossRows.some((r) => r.multiverse === "3" || r.bossId === "boss_03");
  if (!hasMv3) {
    await appendRow("BossStage", {
      bossId: "boss_03",
      hp: 30000,
      weaponId: "gatling",
      rocketCount: 5,
      growthPercent: 10,
      occursEveryNStages: 10,
      multiverse: 3,
      minionEnemyId: "enemy_ak47",
      damageMultiplier: 3,
      background: "/assets/sprites/background/swamp_terrain.svg",
      summonIntervalMs: 10000,
    });
    console.log("  Added Multiverse 3 boss row: gatling, hp=30000, damageMultiplier=3, minion=enemy_ak47 every 10s, swamp background");
  } else {
    console.log("  Multiverse 3 boss row already present, skipping");
  }

  const { rows: stageRows } = await readSheetRaw("Stage");
  const hasMv4 = stageRows.some((r) => r.multiverse === "4");
  if (!hasMv4) {
    for (let i = 0; i < 10; i++) {
      const n = 31 + i;
      await appendRow("Stage", {
        id: `stage${String(n).padStart(2, "0")}`,
        name: `Stage ${n}`,
        isRepeatable: false,
        width: 1280,
        height: 720,
        background: "/assets/sprites/background/swamp_terrain.svg",
        rewardCoin: 125,
        rewardExp: 175,
        playerSpawnX: 0,
        playerSpawnY: 0,
        multiverse: 4,
        comingSoon: true,
      });
    }
    console.log("  Added Multiverse 4 placeholder stages (stage31-40, comingSoon=true)");
  } else {
    console.log("  Multiverse 4 stages already present, skipping");
  }

  console.log("\nMigration v29 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
