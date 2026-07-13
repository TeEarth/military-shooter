/**
 * v26 migration: wall orientation for stage01-20.
 *
 * Root cause of "walls don't stand right / don't match the PDF": the wall
 * cover type only ever rendered as a fixed landscape rectangle (100x44) —
 * there was no way to represent the vertical wall columns the stage-layout
 * PDF actually draws in several stages (e.g. stage03's and stage05's L-shaped
 * barriers). CoverObject/StageCover now support a `rotation` field (0 or 90)
 * that rotates the sprite and swaps its hitbox footprint (see
 * src/game/entities/CoverObject.ts). The x/y positions already seeded in
 * init-sheets.ts were traced from the PDF and are correct — only the missing
 * orientation needed fixing.
 *
 * This adds the "rotation" column, then auto-detects which existing wall
 * rows are meant to be vertical columns vs horizontal rows: for each stage,
 * two wall rows sharing roughly the same x (within 20px) but a meaningfully
 * different y (more than 40px apart) are a vertical pair — every wall row
 * that pairs with at least one other wall row that way gets rotation=90;
 * everything else (isolated walls, or walls that instead share a y with
 * another wall = a horizontal row) stays rotation=0 (the default).
 *
 * Run with: npx tsx scripts/migrate-v26.ts
 */
import "dotenv/config";
import { getSheetsClient, getSpreadsheetId } from "../src/lib/google/google";
import { readSheetRaw, updateRow } from "../src/lib/google/sheet";

async function ensureColumn(sheetName: string, columnName: string) {
  const { headers } = await readSheetRaw(sheetName);
  if (headers.includes(columnName)) return;

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const nextColIdx = headers.length;
  const colLetter = String.fromCharCode(65 + nextColIdx);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${colLetter}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[columnName]] },
  });
  console.log(`  Added column "${columnName}" to ${sheetName} at ${colLetter}1`);
}

async function main() {
  await ensureColumn("StageCover", "rotation");

  const { rows } = await readSheetRaw("StageCover");

  const stageIds = Array.from(new Set(rows.map((r) => r.stageId)));
  let verticalCount = 0;

  for (const stageId of stageIds) {
    const wallIndices = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.stageId === stageId && r.coverType === "wall");

    for (const { r, i } of wallIndices) {
      const x = Number(r.x);
      const y = Number(r.y);
      const hasVerticalPartner = wallIndices.some(({ r: other }) => {
        if (other === r) return false;
        const ox = Number(other.x);
        const oy = Number(other.y);
        return Math.abs(ox - x) <= 20 && Math.abs(oy - y) > 40;
      });

      if (hasVerticalPartner) {
        await updateRow("StageCover", i, { rotation: 90 });
        verticalCount++;
      }
    }
  }

  console.log(`  Marked ${verticalCount} wall row(s) as vertical (rotation=90) across ${stageIds.length} stage(s)`);
  console.log("\nMigration v26 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
