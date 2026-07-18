/**
 * Root-cause fix for the HP display/gameplay mismatch: the Characters sheet
 * has always had TWO HP columns — hpCurrent (correctly varies per character:
 * bob 100, jackson 150, ryzor 120, mina 80, azzure 200) and hpMax (a flat,
 * never-actually-differentiated 200 for every single character). Actual
 * gameplay (computeFullStats in src/lib/stats.ts) has only ever read
 * character.hpMax — the buggy flat 200 — while the UI displayed
 * "hpCurrent/hpMax" (e.g. "100/200"), showing the CORRECT intended value
 * as if it were just a cosmetic "current" number nobody actually started at.
 *
 * This sets hpMax = hpCurrent's value for every character, so the single
 * column gameplay already reads from now holds the right number. A
 * follow-up code change drops the now-redundant hpCurrent column/field
 * entirely (single source of truth).
 *
 * Run with: npx tsx scripts/migrate-fix-character-hp.ts
 */
import "dotenv/config";
import { readSheetRaw, updateRow } from "../src/lib/google/sheet";

async function main() {
  const { rows } = await readSheetRaw("Characters");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const correctHp = Number(row.hpCurrent);
    if (!correctHp) { console.log(`  ${row.id}: no hpCurrent value, skipping`); continue; }
    await updateRow("Characters", i, { hpMax: correctHp });
    console.log(`  ${row.id}: hpMax ${row.hpMax} -> ${correctHp}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
