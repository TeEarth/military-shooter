/**
 * v20 migration: Multiverse 2 real content.
 *
 * - Adds a "damageMultiplier" column to the Enemies sheet (defaults to 1 for
 *   every existing row via rowToEnemy's fallback — nothing already seeded
 *   needs editing) and 4 new Multiverse-2 enemy types that hit 1.5x their
 *   weapon's base damage.
 * - Unlocks stage11-20 (previously comingSoon placeholders from init-sheets.ts)
 *   with real StageEnemy spawn layouts. Background/dimensions were already
 *   seeded (rock_terrain.svg, 1280x720, matching the boss arena) — this just
 *   flips comingSoon off and populates real enemy spawns.
 * - Adds farm_02, Multiverse 2's farm stage — same repeatable-wave mechanic as
 *   farm_01, but its StageEnemy rows restrict the roster to exactly 5 types
 *   (see the v20 change in src/app/api/game/start/route.ts that treats a farm
 *   stage's StageEnemy rows as a roster whitelist instead of positions).
 *
 * Run with: npx tsx scripts/migrate-v20.ts
 */
import "dotenv/config";
import { getSheetsClient, getSpreadsheetId } from "../src/lib/google/google";
import { getHeaders, readSheetRaw, updateRow, appendRow, appendRows } from "../src/lib/google/sheet";

async function ensureColumn(sheetName: string, columnName: string) {
  const headers = await getHeaders(sheetName);
  if (headers.includes(columnName)) return;

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const nextColIdx = headers.length; // 0-based
  const colLetter = String.fromCharCode(65 + nextColIdx); // fine for < 26 columns
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${colLetter}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[columnName]] },
  });
  console.log(`  Added column "${columnName}" to ${sheetName} at ${colLetter}1`);
}

/** Deterministic pseudo-random in [min, max), seeded so re-running this
 *  script produces the exact same layout instead of a new random one each time. */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

async function main() {
  // ---------- 1. Enemies: damageMultiplier column + 4 new Multiverse-2 types ----------
  await ensureColumn("Enemies", "damageMultiplier");

  const { rows: existingEnemies } = await readSheetRaw("Enemies");
  const NEW_ENEMIES = [
    { id: "enemy_double_pistol", weaponId: "double_pistol", hp: 400, coinReward: 8, sprite: "/assets/sprites/enemy/enemy_double_pistol.svg", immobile: false, damageMultiplier: 1.5 },
    { id: "enemy_m16a4", weaponId: "m16a4", hp: 500, coinReward: 10, sprite: "/assets/sprites/enemy/enemy_m16a4.svg", immobile: false, damageMultiplier: 1.5 },
    { id: "enemy_grenade_launcher", weaponId: "grenade_launcher", hp: 750, coinReward: 15, sprite: "/assets/sprites/enemy/enemy_grenade_launcher.svg", immobile: false, damageMultiplier: 1.5 },
    { id: "enemy_rasor_gun", weaponId: "rasor_gun", hp: 600, coinReward: 15, sprite: "/assets/sprites/enemy/enemy_rasor_gun.svg", immobile: false, damageMultiplier: 1.5 },
  ];
  const toAddEnemies = NEW_ENEMIES.filter((e) => !existingEnemies.some((r) => r.id === e.id));
  if (toAddEnemies.length > 0) {
    await appendRows("Enemies", toAddEnemies);
    console.log(`  Added ${toAddEnemies.length} new enemy row(s) to Enemies`);
  } else {
    console.log("  New enemy rows already present, skipping");
  }

  // ---------- 2. Unlock stage11-20 (Multiverse 2 story) ----------
  const { rows: stageRows } = await readSheetRaw("Stage");
  const MV2_STAGE_IDS = Array.from({ length: 10 }, (_, i) => `stage${String(11 + i).padStart(2, "0")}`);

  // Escalating roster per stage: early stages reuse the familiar story-mode
  // enemies, later ones mix in the new Multiverse-2 weapon types so the world
  // feels like a real difficulty step up, not a reskin.
  const MV2_ENEMY_TIERS: string[][] = [
    ["enemy_pistol", "enemy_ak47"],
    ["enemy_pistol", "enemy_ak47", "enemy_shotgun"],
    ["enemy_ak47", "enemy_shotgun", "enemy_sniper"],
    ["enemy_shotgun", "enemy_sniper", "enemy_double_pistol"],
    ["enemy_sniper", "enemy_double_pistol", "enemy_m16a4"],
    ["enemy_double_pistol", "enemy_m16a4", "enemy_rocket"],
    ["enemy_m16a4", "enemy_rocket", "enemy_rasor_gun"],
    ["enemy_rocket", "enemy_rasor_gun", "enemy_grenade_launcher"],
    ["enemy_rasor_gun", "enemy_grenade_launcher", "enemy_turret"],
    ["enemy_grenade_launcher", "enemy_turret", "enemy_m16a4", "enemy_rasor_gun"], // stage20: mini-gauntlet before the Multiverse 2 boss
  ];

  const newStageEnemyRows: Record<string, string | number>[] = [];
  const spawnPointsUpdates: { id: string; x: number; y: number }[] = [];

  MV2_STAGE_IDS.forEach((stageId, i) => {
    const rand = seededRandom(1000 + i);
    const stageNum = 11 + i;
    const enemyCount = 4 + Math.floor(i / 2); // 4 enemies at stage11, up to 8-9 by stage20
    const tier = MV2_ENEMY_TIERS[i];

    const spawnX = 140 + Math.floor(rand() * 60);
    const spawnY = 360 + Math.floor(rand() * 200) - 100;
    spawnPointsUpdates.push({ id: stageId, x: spawnX, y: spawnY });

    for (let e = 0; e < enemyCount; e++) {
      const enemyId = tier[Math.floor(rand() * tier.length)];
      // Keep spawns away from the player's spawn corner (left edge) — scatter
      // across the right ~80% of a 1280x720 arena.
      const x = Math.round(400 + rand() * 800);
      const y = Math.round(80 + rand() * 560);
      newStageEnemyRows.push({ stageId, enemyId, spawnX: x, spawnY: y });
    }
    console.log(`  ${stageId}: ${enemyCount} enemies from [${tier.join(", ")}]`);
  });

  for (const s of spawnPointsUpdates) {
    const idx = stageRows.findIndex((r) => r.id === s.id);
    if (idx === -1) {
      console.warn(`  ${s.id} not found in Stage sheet, skipping unlock`);
      continue;
    }
    await updateRow("Stage", idx, { comingSoon: false, playerSpawnX: s.x, playerSpawnY: s.y });
  }
  console.log(`  Unlocked (comingSoon=false) stage11-20`);

  const { rows: existingStageEnemy } = await readSheetRaw("StageEnemy");
  const alreadyHasMv2StoryEnemies = existingStageEnemy.some((r) => MV2_STAGE_IDS.includes(r.stageId));
  if (!alreadyHasMv2StoryEnemies && newStageEnemyRows.length > 0) {
    await appendRows("StageEnemy", newStageEnemyRows);
    console.log(`  Added ${newStageEnemyRows.length} StageEnemy rows for stage11-20`);
  } else {
    console.log("  stage11-20 StageEnemy rows already present, skipping");
  }

  // ---------- 3. farm_02 — Multiverse 2's farm stage ----------
  const FARM_02_ID = "farm_02";
  const hasFarm02 = stageRows.some((r) => r.id === FARM_02_ID);
  if (!hasFarm02) {
    await appendRow("Stage", {
      id: FARM_02_ID,
      name: "Wasteland Grounds",
      isRepeatable: true,
      width: 1280,
      height: 900,
      background: "/assets/sprites/background/rock_terrain.svg",
      rewardCoin: 100,
      rewardExp: 10,
      playerSpawnX: 640,
      playerSpawnY: 450,
      multiverse: 2,
      comingSoon: false,
    });
    console.log(`  Added Stage row for ${FARM_02_ID}`);
  } else {
    console.log(`  ${FARM_02_ID} already exists, skipping`);
  }

  const alreadyHasFarm02Roster = existingStageEnemy.some((r) => r.stageId === FARM_02_ID);
  if (!alreadyHasFarm02Roster) {
    // spawnX/spawnY are unused for farm stages (see GameScene.spawnWave) — these
    // rows exist purely to whitelist which 5 enemy ids are eligible to spawn.
    await appendRows(
      "StageEnemy",
      ["enemy_turret", "enemy_double_pistol", "enemy_m16a4", "enemy_grenade_launcher", "enemy_rasor_gun"].map((enemyId) => ({
        stageId: FARM_02_ID,
        enemyId,
        spawnX: 0,
        spawnY: 0,
      }))
    );
    console.log(`  Added StageEnemy roster whitelist for ${FARM_02_ID}`);
  } else {
    console.log(`  ${FARM_02_ID} StageEnemy roster already present, skipping`);
  }

  console.log("\nMigration v20 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
