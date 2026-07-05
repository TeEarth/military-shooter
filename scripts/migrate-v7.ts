/**
 * Live-spreadsheet migration for v5 (equipment shield values + dedicated
 * per-rarity sprites). shieldValue is appended at the END of the Equipment
 * header (never inserted mid-row) — same live-sheet-safety reasoning as
 * previous migrations: existing rows keep their column alignment.
 *
 * Run with: npx tsx scripts/migrate-v7.ts
 */
import "dotenv/config";
import { ensureSheetExists, findRow, updateRow } from "../src/lib/google/sheet";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SHIELD_AND_SPRITE: Record<string, { shieldValue: number; sprite: string }> = {
  helmet_common: { shieldValue: 75, sprite: "/assets/sprites/equipment/helmet_common.svg" },
  helmet_rare: { shieldValue: 150, sprite: "/assets/sprites/equipment/helmet_rare.svg" },
  helmet_epic: { shieldValue: 300, sprite: "/assets/sprites/equipment/helmet_epic.svg" },
  helmet_legendary: { shieldValue: 600, sprite: "/assets/sprites/equipment/helmet_legendary.svg" },

  vest_common: { shieldValue: 100, sprite: "/assets/sprites/equipment/vest_common.svg" },
  vest_rare: { shieldValue: 200, sprite: "/assets/sprites/equipment/vest_rare.svg" },
  vest_epic: { shieldValue: 400, sprite: "/assets/sprites/equipment/vest_epic.svg" },
  vest_legendary: { shieldValue: 800, sprite: "/assets/sprites/equipment/vest_legendary.svg" },

  boots_common: { shieldValue: 50, sprite: "/assets/sprites/equipment/boots_common.svg" },
  boots_rare: { shieldValue: 100, sprite: "/assets/sprites/equipment/boots_rare.svg" },
  boots_epic: { shieldValue: 200, sprite: "/assets/sprites/equipment/boots_epic.svg" },
  boots_legendary: { shieldValue: 400, sprite: "/assets/sprites/equipment/boots_legendary.svg" },
};

async function main() {
  console.log("Appending shieldValue to Equipment header...");
  await ensureSheetExists("Equipment", ["id", "name", "slot", "rarity", "hpPercent", "damagePercent", "critChancePercent", "critDamagePercent", "sprite", "shieldValue"]);
  await sleep(1200);

  console.log("Setting shieldValue + dedicated per-rarity sprite for each equipment row...");
  for (const [id, { shieldValue, sprite }] of Object.entries(SHIELD_AND_SPRITE)) {
    const found = await findRow("Equipment", (r) => r.id === id);
    if (found) {
      await updateRow("Equipment", found.rowIndex, { shieldValue, sprite });
      console.log(`  ${id}: shieldValue=${shieldValue}, sprite=${sprite}`);
    } else {
      console.log(`  ${id}: not found — skipping (will be seeded fresh by init-sheets if this is a new spreadsheet)`);
    }
    await sleep(600);
  }

  console.log("\nMigration v7 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
