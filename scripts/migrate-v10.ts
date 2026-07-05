/**
 * Live-spreadsheet migration for v8 #5: appends stage06-10 (placeholder maps
 * reusing stage01-05's enemy-spawn patterns) so story progression has a full
 * 10 stages — needed for the "boss every 10 stages" gate (v4) to be testable
 * at all. Pure row appends, no schema/column changes, so this is safe to run
 * even if stage06-10 already exist (findRow guards against duplicate inserts).
 *
 * Run with: npx tsx scripts/migrate-v10.ts
 */
import "dotenv/config";
import { findRow, appendRows } from "../src/lib/google/sheet";

const NEW_STAGES = [
  { id: "stage06", name: "Coastal Defense (placeholder)", isRepeatable: false, width: 1280, height: 720, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 550, rewardExp: 750 },
  { id: "stage07", name: "Mountain Pass (placeholder)", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 600, rewardExp: 800 },
  { id: "stage08", name: "Night Raid (placeholder)", isRepeatable: false, width: 1440, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 650, rewardExp: 850 },
  { id: "stage09", name: "Fortress Siege (placeholder)", isRepeatable: false, width: 1600, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 700, rewardExp: 900 },
  { id: "stage10", name: "Final Stand (placeholder)", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 1000, rewardExp: 1400 },
];

const NEW_STAGE_ENEMIES = [
  { stageId: "stage06", enemyId: "enemy_pistol", spawnX: 500, spawnY: 300 },
  { stageId: "stage06", enemyId: "enemy_pistol", spawnX: 900, spawnY: 500 },
  { stageId: "stage06", enemyId: "enemy_pistol", spawnX: 1100, spawnY: 300 },

  { stageId: "stage07", enemyId: "enemy_pistol", spawnX: 500, spawnY: 300 },
  { stageId: "stage07", enemyId: "enemy_ak47", spawnX: 900, spawnY: 500 },
  { stageId: "stage07", enemyId: "enemy_pistol", spawnX: 1200, spawnY: 400 },
  { stageId: "stage07", enemyId: "enemy_sniper", spawnX: 1350, spawnY: 200 },

  { stageId: "stage08", enemyId: "enemy_ak47", spawnX: 500, spawnY: 400 },
  { stageId: "stage08", enemyId: "enemy_shotgun", spawnX: 900, spawnY: 600 },
  { stageId: "stage08", enemyId: "enemy_sniper", spawnX: 1200, spawnY: 300 },
  { stageId: "stage08", enemyId: "enemy_pistol", spawnX: 1350, spawnY: 700 },

  { stageId: "stage09", enemyId: "enemy_ak47", spawnX: 500, spawnY: 400 },
  { stageId: "stage09", enemyId: "enemy_shotgun", spawnX: 900, spawnY: 600 },
  { stageId: "stage09", enemyId: "enemy_rocket", spawnX: 1300, spawnY: 400 },
  { stageId: "stage09", enemyId: "enemy_sniper", spawnX: 1500, spawnY: 250 },

  { stageId: "stage10", enemyId: "enemy_ak47", spawnX: 500, spawnY: 400 },
  { stageId: "stage10", enemyId: "enemy_shotgun", spawnX: 800, spawnY: 600 },
  { stageId: "stage10", enemyId: "enemy_sniper", spawnX: 1100, spawnY: 250 },
  { stageId: "stage10", enemyId: "enemy_rocket", spawnX: 1350, spawnY: 500 },
];

async function main() {
  const existingStage06 = await findRow("Stage", (r) => r.id === "stage06");
  if (existingStage06) {
    console.log("stage06 already exists — skipping (migration already applied).");
    return;
  }

  console.log("Appending stage06-10 to Stage...");
  await appendRows("Stage", NEW_STAGES);
  console.log("Appending stage06-10 spawns to StageEnemy...");
  await appendRows("StageEnemy", NEW_STAGE_ENEMIES);

  console.log("\nMigration v10 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
