/**
 * Live-spreadsheet migration for v12 correction: the stage-layout PDF's
 * description pages (one per stage) give the REAL stage name + reward, which
 * I'd previously dismissed as repeated boilerplate text — it isn't. Replaces
 * the invented names/rewards on stage01-10 with the real ones. Farm and
 * StageEnemy/StageCover data are untouched (already correct from migrate-v14).
 *
 * Also stage10's description explicitly calls out that enemy #5 (Rocket)
 * should have 5x its normal HP on that map — implemented as a special case
 * in src/app/api/game/start/route.ts, not stored in a sheet column.
 *
 * Run with: npx tsx scripts/migrate-v15.ts
 */
import "dotenv/config";
import { readSheetRaw, updateRow } from "../src/lib/google/sheet";

const REAL_STAGE_DATA: Record<string, { name: string; rewardCoin: number; rewardExp: number }> = {
  stage01: { name: "The Forest", rewardCoin: 50, rewardExp: 100 },
  stage02: { name: "The Mansion", rewardCoin: 50, rewardExp: 100 },
  stage03: { name: "House", rewardCoin: 50, rewardExp: 100 },
  stage04: { name: "The Camping", rewardCoin: 50, rewardExp: 100 },
  stage05: { name: "Shotgun", rewardCoin: 50, rewardExp: 100 },
  stage06: { name: "Strong Mansion", rewardCoin: 75, rewardExp: 150 },
  stage07: { name: "Sniper", rewardCoin: 75, rewardExp: 150 },
  stage08: { name: "Rocket", rewardCoin: 75, rewardExp: 150 },
  stage09: { name: "Enemy Mansion", rewardCoin: 75, rewardExp: 150 },
  stage10: { name: "Boss 1", rewardCoin: 100, rewardExp: 200 },
};

async function main() {
  const { rows } = await readSheetRaw("Stage");
  for (const [stageId, data] of Object.entries(REAL_STAGE_DATA)) {
    const idx = rows.findIndex((r) => r.id === stageId);
    if (idx === -1) {
      console.warn(`  ${stageId} not found in Stage sheet, skipping`);
      continue;
    }
    await updateRow("Stage", idx, data);
    console.log(`  ${stageId}: name="${data.name}", rewardCoin=${data.rewardCoin}, rewardExp=${data.rewardExp}`);
  }
  console.log("\nMigration v15 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
