/**
 * v28 migration: restrict Multiverse 1's farm stage (farm_01) to enemy types
 * 1-6 only (pistol, ak47, shotgun, sniper, rocket, turret).
 *
 * Root cause: unlike farm_02 (types 6-10, see migrate-v20) and farm_03 (all
 * _mv3 types, see migrate-v25), farm_01 was never given a StageEnemy roster
 * whitelist — /api/game/start/route.ts's own comment says as much: "if none
 * (e.g. the original farm_01), every enemy is eligible." That's exactly why
 * types 7-10 (double_pistol/m16a4/grenade_launcher/rasor_gun) were showing up
 * in Multiverse 1's farm stage, which the user explicitly never wants.
 *
 * The existing FARM_ENEMY_UNLOCK_WAVE table in GameScene.ts already gates
 * wave1->{pistol,ak47}, wave2->+shotgun, wave3->+sniper, wave4->+rocket,
 * wave5->+turret (then stays 1-6 forever after) — exactly the progression
 * the user described — so this migration only needs to add the roster
 * whitelist; no code change needed for the wave-gating itself.
 *
 * Run with: npx tsx scripts/migrate-v28.ts
 */
import "dotenv/config";
import { readSheetRaw, appendRows } from "../src/lib/google/sheet";

const FARM_01_ROSTER = ["enemy_pistol", "enemy_ak47", "enemy_shotgun", "enemy_sniper", "enemy_rocket", "enemy_turret"];

async function main() {
  const { rows: existingStageEnemy } = await readSheetRaw("StageEnemy");
  const alreadyHasRoster = existingStageEnemy.some((r) => r.stageId === "farm_01");

  if (alreadyHasRoster) {
    console.log("  farm_01 StageEnemy roster already present, skipping");
  } else {
    await appendRows(
      "StageEnemy",
      FARM_01_ROSTER.map((enemyId) => ({ stageId: "farm_01", enemyId, spawnX: 0, spawnY: 0 }))
    );
    console.log(`  Added StageEnemy roster whitelist for farm_01 (${FARM_01_ROSTER.length} types: ${FARM_01_ROSTER.join(", ")})`);
  }

  console.log("\nMigration v28 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
