/**
 * v52: boss balance pass —
 * - Multiverse 3 boss hp: 30000 -> 60000.
 * (Boss bullet-range tripling is a pure code change, in
 * src/game/scenes/GameScene.ts's boss-spawn weapon stats — no sheet edit
 * needed for that part.)
 *
 * Run with: npx tsx scripts/migrate-v52-boss-balance.ts
 */
import "dotenv/config";
import { readSheetRaw, updateRow } from "../src/lib/google/sheet";

async function main() {
  const { rows: bossRows } = await readSheetRaw("BossStage");
  const mv3Idx = bossRows.findIndex((r) => r.multiverse === "3" || r.bossId === "boss_03");
  if (mv3Idx === -1) throw new Error("Multiverse 3 boss row not found — run migrate-v29.ts first");

  await updateRow("BossStage", mv3Idx, { hp: 60000 });
  console.log("  Multiverse 3 boss: hp 30000 -> 60000");
  console.log("\nMigration v52 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
