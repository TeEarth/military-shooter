/**
 * v25 migration: Multiverse 3 real content (stage21-30 + farm_03).
 *
 * - Adds a "_mv3" boosted variant of every existing enemy type (+500 flat hp,
 *   3x damageMultiplier on top of whatever the base row already had) — this
 *   is what "every enemy is +500 hp and hits 3x harder in Multiverse 3"
 *   actually means mechanically: a distinct enemy row, not a runtime hack.
 * - Creates stage21-30 (Stage sheet has no placeholder rows for these yet,
 *   unlike stage11-20 which init-sheets.ts pre-seeded — these are brand new
 *   rows), multiverse=3, sand_terrain.svg background. Access is already
 *   gated for free by the existing "stage.multiverse > 1 + bossEncounterCount"
 *   check in /api/game/start — nothing to change there.
 * - Unlike Multiverse 2's escalating enemy-type tiers, every stage here draws
 *   from the FULL _mv3 roster (any type can appear, no gating) per the ask.
 * - Adds farm_03, Multiverse 3's farm stage, same unrestricted _mv3 roster.
 *
 * Run with: npx tsx scripts/migrate-v25.ts
 */
import "dotenv/config";
import { readSheetRaw, updateRow, appendRow, appendRows } from "../src/lib/google/sheet";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

async function main() {
  // ---------- 1. Enemies: _mv3 boosted variant of every existing type ----------
  const { rows: existingEnemies } = await readSheetRaw("Enemies");
  const baseEnemies = existingEnemies.filter((e) => e.id && e.id !== "enemy_boss" && !e.id.endsWith("_mv3"));

  const NEW_ENEMIES = baseEnemies.map((e) => ({
    id: `${e.id}_mv3`,
    weaponId: e.weaponId,
    hp: Number(e.hp || 100) + 500,
    coinReward: Number(e.coinReward || 1),
    sprite: e.sprite || "",
    immobile: e.immobile === "true" || e.immobile === "TRUE" ? true : false,
    damageMultiplier: (Number(e.damageMultiplier) || 1) * 3,
  }));

  const toAddEnemies = NEW_ENEMIES.filter((e) => !existingEnemies.some((r) => r.id === e.id));
  if (toAddEnemies.length > 0) {
    await appendRows("Enemies", toAddEnemies);
    console.log(`  Added ${toAddEnemies.length} Multiverse-3 enemy row(s) to Enemies`);
  } else {
    console.log("  Multiverse-3 enemy rows already present, skipping");
  }

  const MV3_ENEMY_IDS = NEW_ENEMIES.map((e) => e.id);

  // ---------- 2. stage21-30 (Multiverse 3 story) ----------
  const { rows: stageRows } = await readSheetRaw("Stage");
  const MV3_STAGE_IDS = Array.from({ length: 10 }, (_, i) => `stage${String(21 + i).padStart(2, "0")}`);

  const newStageRows: Record<string, string | number | boolean>[] = [];
  const newStageEnemyRows: Record<string, string | number>[] = [];

  MV3_STAGE_IDS.forEach((stageId, i) => {
    const rand = seededRandom(2000 + i);
    const stageNum = 21 + i;
    const existingIdx = stageRows.findIndex((r) => r.id === stageId);

    const spawnX = 140 + Math.floor(rand() * 60);
    const spawnY = 360 + Math.floor(rand() * 200) - 100;

    if (existingIdx === -1) {
      newStageRows.push({
        id: stageId,
        name: `Stage ${stageNum}`,
        isRepeatable: false,
        width: 1280,
        height: 720,
        background: "/assets/sprites/background/sand_terrain.svg",
        rewardCoin: 125 + i * 5,
        rewardExp: 175 + i * 5,
        playerSpawnX: spawnX,
        playerSpawnY: spawnY,
        multiverse: 3,
        comingSoon: false,
      });
    } else {
      console.log(`  ${stageId} already exists in Stage sheet, will just ensure it's unlocked`);
    }

    // Any enemy type, no tier gating — 6 to 15 spawns, scaling up across the
    // ten stages so stage30 feels like a real gauntlet before the next boss.
    const enemyCount = 6 + Math.floor(i * 1.0);
    for (let e = 0; e < enemyCount; e++) {
      const enemyId = MV3_ENEMY_IDS[Math.floor(rand() * MV3_ENEMY_IDS.length)];
      const x = Math.round(400 + rand() * 800);
      const y = Math.round(80 + rand() * 560);
      newStageEnemyRows.push({ stageId, enemyId, spawnX: x, spawnY: y });
    }
    console.log(`  ${stageId}: ${enemyCount} enemies from the full Multiverse-3 roster`);
  });

  if (newStageRows.length > 0) {
    await appendRows("Stage", newStageRows);
    console.log(`  Added ${newStageRows.length} new Stage row(s) for stage21-30`);
  }
  // Any stage21-30 row that already existed as a comingSoon placeholder gets flipped on.
  for (const stageId of MV3_STAGE_IDS) {
    const idx = stageRows.findIndex((r) => r.id === stageId);
    if (idx !== -1) {
      await updateRow("Stage", idx, { comingSoon: false, multiverse: 3, background: "/assets/sprites/background/sand_terrain.svg" });
    }
  }

  const { rows: existingStageEnemy } = await readSheetRaw("StageEnemy");
  const alreadyHasMv3StoryEnemies = existingStageEnemy.some((r) => MV3_STAGE_IDS.includes(r.stageId));
  if (!alreadyHasMv3StoryEnemies && newStageEnemyRows.length > 0) {
    await appendRows("StageEnemy", newStageEnemyRows);
    console.log(`  Added ${newStageEnemyRows.length} StageEnemy rows for stage21-30`);
  } else {
    console.log("  stage21-30 StageEnemy rows already present, skipping");
  }

  // ---------- 3. farm_03 — Multiverse 3's farm stage ----------
  const FARM_03_ID = "farm_03";
  const hasFarm03 = stageRows.some((r) => r.id === FARM_03_ID);
  if (!hasFarm03) {
    await appendRow("Stage", {
      id: FARM_03_ID,
      name: "Desert Siege",
      isRepeatable: true,
      width: 1280,
      height: 900,
      background: "/assets/sprites/background/sand_terrain.svg",
      rewardCoin: 120,
      rewardExp: 10,
      playerSpawnX: 640,
      playerSpawnY: 450,
      multiverse: 3,
      comingSoon: false,
    });
    console.log(`  Added Stage row for ${FARM_03_ID}`);
  } else {
    console.log(`  ${FARM_03_ID} already exists, skipping`);
  }

  const alreadyHasFarm03Roster = existingStageEnemy.some((r) => r.stageId === FARM_03_ID);
  if (!alreadyHasFarm03Roster) {
    // Unrestricted roster (every _mv3 type) — spawnX/spawnY are unused for farm
    // stages, these rows only whitelist which enemy ids are eligible to spawn.
    await appendRows(
      "StageEnemy",
      MV3_ENEMY_IDS.map((enemyId) => ({ stageId: FARM_03_ID, enemyId, spawnX: 0, spawnY: 0 }))
    );
    console.log(`  Added StageEnemy roster whitelist for ${FARM_03_ID} (${MV3_ENEMY_IDS.length} types)`);
  } else {
    console.log(`  ${FARM_03_ID} StageEnemy roster already present, skipping`);
  }

  console.log("\nMigration v25 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
