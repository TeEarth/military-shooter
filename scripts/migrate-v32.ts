/**
 * v32 migration: real farm_02 (Multiverse 2 farm) cover layout, from the
 * user's "stage farm multiverse 2.pdf". farm_02 previously had zero
 * StageCover rows at all (GameScene's random-scatter fallback ran instead) —
 * this adds the actual fixed layout the user designed: 3 houses, 8 crates
 * (round + square icons in the PDF both map to the game's "crate" cover
 * type — see the PDF's own legend, which duplicates the "obstacle_house"
 * label by copy-paste error onto what's visibly the game's actual crate
 * icon), 5 sandbags, 3 camp tents. Positions were template-matched off the
 * rendered PDF page (not eyeballed) and scaled from its 1920x1080 render
 * frame to farm_02's 1280x900 arena. The player spawn point in the PDF
 * (640, 450) already matches the existing seeded value exactly, so no
 * change needed there.
 *
 * Run with: npx tsx scripts/migrate-v32.ts
 */
import "dotenv/config";
import { readSheetRaw, appendRows } from "../src/lib/google/sheet";

const LAYOUT: { coverType: string; points: [number, number][] }[] = [
  { coverType: "house", points: [[960, 79], [1105, 147], [1203, 281]] },
  {
    coverType: "crate",
    points: [
      [1111, 723], [511, 97], [323, 146], // round-icon crates
      [313, 504], [923, 658], [739, 734], [563, 732], [421, 653], // square-icon crates
    ],
  },
  { coverType: "sandbag", points: [[418, 273], [237, 325], [843, 340], [1012, 472], [623, 238]] },
  { coverType: "camp_tent", points: [[110, 535], [187, 722], [365, 800]] },
];

async function main() {
  const { rows: existing } = await readSheetRaw("StageCover");
  if (existing.some((r) => r.stageId === "farm_02")) {
    console.log("  farm_02 StageCover rows already present, skipping");
    return;
  }

  const rows: Record<string, string | number>[] = [];
  for (const { coverType, points } of LAYOUT) {
    for (const [x, y] of points) rows.push({ stageId: "farm_02", coverType, x, y, rotation: 0 });
  }
  await appendRows("StageCover", rows);
  console.log(`  Added ${rows.length} StageCover rows for farm_02`);
  console.log("\nMigration v32 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
