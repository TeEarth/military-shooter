/**
 * Double Pistol's unlock requirement: stage 5 -> stage 3, per user request.
 *
 * Run with: npx tsx scripts/migrate-double-pistol-stage3.ts
 */
import "dotenv/config";
import { readSheetRaw, updateRow } from "../src/lib/google/sheet";

async function main() {
  const { rows } = await readSheetRaw("Weapons");
  const idx = rows.findIndex((r) => r.id === "double_pistol");
  if (idx === -1) { console.log("  double_pistol not found, skipping"); return; }
  const current = rows[idx].unlockValue;
  await updateRow("Weapons", idx, { unlockValue: 3 });
  console.log(`  double_pistol unlockValue: ${current} -> 3`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
