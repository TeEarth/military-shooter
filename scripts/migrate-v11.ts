/**
 * Live-spreadsheet migration for v9 #2 (VIP system): appends `vipExp` to
 * Players (end of header, safe for a live sheet — same append-only reasoning
 * as every previous migration) and creates + seeds VipConfig.
 *
 * Run with: npx tsx scripts/migrate-v11.ts
 */
import "dotenv/config";
import { ensureSheetExists, appendRows, readSheetRaw } from "../src/lib/google/sheet";

async function main() {
  console.log("Appending vipExp to Players header...");
  await ensureSheetExists("Players", [
    "id", "email", "username", "passwordHash", "coin", "diamond", "ticket", "level", "exp",
    "currentStage", "currentCharacter", "currentWeapon", "vipLevel", "farmStageMaxWave",
    "isGuest", "isBanned", "lastLogin", "createdAt", "updatedAt",
    "personalMilestoneTier", "personalMilestoneGreenTier", "vipExp",
  ]);
  console.log("  Players header updated");

  console.log("Creating VipConfig...");
  await ensureSheetExists("VipConfig", ["level", "expRequired"]);

  const { rows } = await readSheetRaw("VipConfig");
  if (rows.length > 0) {
    console.log("  VipConfig already has data, skipping seed");
  } else {
    await appendRows("VipConfig", [
      { level: 1, expRequired: 500 },
      { level: 2, expRequired: 1000 },
      { level: 3, expRequired: 1500 },
      { level: 4, expRequired: 2000 },
      { level: 5, expRequired: 2500 },
      { level: 6, expRequired: 3000 },
      { level: 7, expRequired: 3500 },
      { level: 8, expRequired: 4000 },
      { level: 9, expRequired: 4500 },
      { level: 10, expRequired: 5000 },
    ]);
    console.log("  VipConfig seeded (10 rows)");
  }

  console.log("\nMigration v11 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
