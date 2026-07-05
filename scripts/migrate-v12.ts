/**
 * Live-spreadsheet migration for v9 #4: appends `isTestAccount` to Players
 * (end of header — safe append, same reasoning as every previous migration).
 *
 * Run with: npx tsx scripts/migrate-v12.ts
 */
import "dotenv/config";
import { ensureSheetExists } from "../src/lib/google/sheet";

async function main() {
  console.log("Appending isTestAccount to Players header...");
  await ensureSheetExists("Players", [
    "id", "email", "username", "passwordHash", "coin", "diamond", "ticket", "level", "exp",
    "currentStage", "currentCharacter", "currentWeapon", "vipLevel", "farmStageMaxWave",
    "isGuest", "isBanned", "lastLogin", "createdAt", "updatedAt",
    "personalMilestoneTier", "personalMilestoneGreenTier", "vipExp", "isTestAccount",
  ]);
  console.log("  Players header updated");
  console.log("\nMigration v12 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
