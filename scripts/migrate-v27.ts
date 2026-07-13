/**
 * v27 migration: Multiverse 2 stage names + stage20 cover layout.
 *
 * - Renames stage11-20 from their init-sheets.ts placeholder names ("Stage 11"
 *   etc, never updated after MV2's real content was designed in migrate-v20)
 *   to the real names from the stage-layout PDF.
 * - stage20 ("Mini Boss") is the one Multiverse-2 stage the PDF actually draws
 *   fixed cover for — two long wall rows plus scattered crates/tree/house —
 *   every other MV2 stage (11-19) shows only enemy-position circles with no
 *   cover icons, so those correctly keep GameScene's random scatter (no
 *   StageCover rows needed there). stage20's enemy #10 (Rasor Gun) getting 5x
 *   hp / 2x damage is handled in src/app/api/game/start/route.ts, not here.
 *
 * Run with: npx tsx scripts/migrate-v27.ts
 */
import "dotenv/config";
import { readSheetRaw, updateRow, appendRows } from "../src/lib/google/sheet";

const MV2_STAGE_NAMES: Record<string, string> = {
  stage11: "The Rocky",
  stage12: "Gatling Protection",
  stage13: "Enemy Respawn",
  stage14: "Rocky Mansion",
  stage15: "Bombing",
  stage16: "News Enemy",
  stage17: "Circle Enemy",
  stage18: "Rasorrrr!!!",
  stage19: "Rocky House",
  stage20: "Mini Boss",
};

async function main() {
  const { rows: stageRows } = await readSheetRaw("Stage");

  let renamed = 0;
  for (const [stageId, name] of Object.entries(MV2_STAGE_NAMES)) {
    const idx = stageRows.findIndex((r) => r.id === stageId);
    if (idx === -1) {
      console.warn(`  ${stageId} not found in Stage sheet, skipping rename`);
      continue;
    }
    if (stageRows[idx].name === name) continue;
    await updateRow("Stage", idx, { name });
    renamed++;
  }
  console.log(`  Renamed ${renamed} Multiverse-2 stage(s)`);

  // ---------- stage20 cover layout: two long wall rows + scattered cover ----------
  const { rows: existingCovers } = await readSheetRaw("StageCover");
  const hasStage20Covers = existingCovers.some((r) => r.stageId === "stage20");

  if (!hasStage20Covers) {
    const rows: Record<string, string | number>[] = [];

    // Two wall rows partitioning the arena, each with one gap for a sightline/
    // passage rather than a fully sealed corridor.
    const rowY = [300, 460];
    const wallXs = [130, 250, 370, 490, 730, 850, 970, 1090]; // gap left around x=610
    for (const y of rowY) {
      for (const x of wallXs) rows.push({ stageId: "stage20", coverType: "wall", x, y, rotation: 0 });
    }

    const scattered: { coverType: string; x: number; y: number }[] = [
      { coverType: "house", x: 160, y: 150 },
      { coverType: "crate", x: 220, y: 600 },
      { coverType: "crate", x: 340, y: 640 },
      { coverType: "crate", x: 620, y: 610 },
      { coverType: "tree", x: 470, y: 690 },
      { coverType: "tree", x: 900, y: 660 },
      { coverType: "sandbag", x: 960, y: 180 },
      { coverType: "sandbag", x: 1080, y: 240 },
      { coverType: "camp_tent", x: 1190, y: 150 },
    ];
    for (const c of scattered) rows.push({ stageId: "stage20", ...c, rotation: 0 });

    await appendRows("StageCover", rows);
    console.log(`  Added ${rows.length} StageCover rows for stage20`);
  } else {
    console.log("  stage20 StageCover rows already present, skipping");
  }

  console.log("\nMigration v27 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
