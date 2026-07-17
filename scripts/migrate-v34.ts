/**
 * v34 migration: grenade_launcher and rocket_launcher explosion radius x1.5,
 * per the user's request. Previous values: rocket_launcher=90, grenade_launcher=45
 * (grenade was intentionally half of rocket's — kept that same ratio).
 *
 * Run with: npx tsx scripts/migrate-v34.ts
 */
import "dotenv/config";
import { readSheetRaw, updateRow } from "../src/lib/google/sheet";

const MULTIPLIER = 1.5;
const TARGETS = ["grenade_launcher", "rocket_launcher"];

async function main() {
  const { rows } = await readSheetRaw("Weapons");
  for (const id of TARGETS) {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) { console.log(`  ${id} not found, skipping`); continue; }
    const current = Number(rows[idx].explosionRadius);
    const next = Math.round(current * MULTIPLIER);
    await updateRow("Weapons", idx, { explosionRadius: next });
    console.log(`  ${id}: ${current} -> ${next}`);
  }
  console.log("\nMigration v34 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
