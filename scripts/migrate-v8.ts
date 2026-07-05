/**
 * Live-spreadsheet migration for v6 (weapon balance tweaks): shotgun spread
 * widened to 10°, gatling reload shortened to 12s, grenade launcher reload
 * lengthened to 16s. All three are plain value updates on existing Weapons
 * rows — no header/schema change, so no column-shift risk.
 *
 * Run with: npx tsx scripts/migrate-v8.ts
 */
import "dotenv/config";
import { findRow, updateRow } from "../src/lib/google/sheet";

async function main() {
  const updates: Array<{ id: string; changes: Record<string, number> }> = [
    { id: "shotgun", changes: { spreadDegrees: 10 } },
    { id: "gatling", changes: { reloadTime: 12 } },
    { id: "grenade_launcher", changes: { reloadTime: 16 } },
  ];

  for (const { id, changes } of updates) {
    const found = await findRow("Weapons", (r) => r.id === id);
    if (!found) {
      console.log(`  ${id}: not found — skipping`);
      continue;
    }
    await updateRow("Weapons", found.rowIndex, changes);
    console.log(`  ${id}: ${JSON.stringify(changes)}`);
  }

  console.log("\nMigration v8 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
