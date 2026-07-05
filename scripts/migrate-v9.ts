/**
 * Live-spreadsheet migration for v8: adds the `explosionRadius` column to
 * Weapons (appended at the end — safe for a live sheet with existing rows,
 * same reasoning as every previous append-only migration in this project)
 * and sets rocket_launcher/grenade_launcher's values (grenade = half of rocket).
 *
 * Run with: npx tsx scripts/migrate-v9.ts
 */
import "dotenv/config";
import { ensureSheetExists, findRow, updateRow } from "../src/lib/google/sheet";

async function main() {
  console.log("Appending explosionRadius to Weapons header...");
  await ensureSheetExists("Weapons", [
    "id", "name", "unlockType", "unlockValue", "priceCoin", "priceDiamond", "priceTicket",
    "damage", "fireRate", "fireMode", "projectileCount", "accuracy", "magazineSize", "reloadTime",
    "critChance", "critDamage", "dailyAmmo", "spreadDegrees", "sprite", "explosionRadius",
  ]);

  console.log("Setting explosionRadius for rocket_launcher (90) and grenade_launcher (45, half)...");
  const rocket = await findRow("Weapons", (r) => r.id === "rocket_launcher");
  if (rocket) {
    await updateRow("Weapons", rocket.rowIndex, { explosionRadius: 90 });
    console.log("  rocket_launcher: explosionRadius=90");
  }
  const grenade = await findRow("Weapons", (r) => r.id === "grenade_launcher");
  if (grenade) {
    await updateRow("Weapons", grenade.rowIndex, { explosionRadius: 45 });
    console.log("  grenade_launcher: explosionRadius=45");
  }

  console.log("\nMigration v9 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
