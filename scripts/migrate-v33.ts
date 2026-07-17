/**
 * v33 migration: fix farm_02's 3 tree positions.
 *
 * The user's "stage farm multiverse 2.pdf" legend had two labeling errors on
 * its 6 cover icons: the square wood-crate icon was mislabeled
 * "obstacle_house" (a copy-paste duplicate of the actual house label), and —
 * confirmed by the user after seeing the deployed map — the round green-ball
 * icon was mislabeled "cover_crate" when it was meant to be "tree" (its
 * rounded-foliage shape matches the game's actual tree sprite, not the
 * square wood-box crate sprite). v32 took the PDF legend's text at face
 * value and added all 8 round+square icons as coverType "crate" — this
 * corrects just the 3 round-icon positions to coverType "tree".
 *
 * Run with: npx tsx scripts/migrate-v33.ts
 */
import "dotenv/config";
import { readSheetRaw, appendRows, deleteRowsWhere } from "../src/lib/google/sheet";

const ROUND_ICON_POSITIONS: [number, number][] = [[1111, 723], [511, 97], [323, 146]];

async function main() {
  const { rows } = await readSheetRaw("StageCover");
  const alreadyTree = rows.some(
    (r) => r.stageId === "farm_02" && r.coverType === "tree"
      && ROUND_ICON_POSITIONS.some(([x, y]) => Number(r.x) === x && Number(r.y) === y)
  );
  if (alreadyTree) {
    console.log("  farm_02 tree fix already applied, skipping");
    return;
  }

  const removed = await deleteRowsWhere(
    "StageCover",
    (r) => r.stageId === "farm_02" && r.coverType === "crate"
      && ROUND_ICON_POSITIONS.some(([x, y]) => Number(r.x) === x && Number(r.y) === y)
  );
  console.log(`  Removed ${removed} mislabeled crate rows`);

  const rowsToAdd = ROUND_ICON_POSITIONS.map(([x, y]) => ({ stageId: "farm_02", coverType: "tree", x, y, rotation: 0 }));
  await appendRows("StageCover", rowsToAdd);
  console.log(`  Added ${rowsToAdd.length} tree rows for farm_02`);
  console.log("\nMigration v33 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
