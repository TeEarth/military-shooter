/**
 * Live-spreadsheet migration for v4 (economy-zero, quests, boss stage, Income/Shop).
 *
 * Players and Mission already have live data, so their new columns are appended
 * to the END of the header row (never inserted mid-row) — inserting a header
 * in the middle without also shifting every existing data row's cells would
 * silently misalign every column after the insertion point. Brand-new sheets
 * (CurrencyExchangeConfig, TicketTopUp, BossStage, PlayerIncome,
 * WithdrawalRequest, PlayerBossProgress) are created fresh, no data at risk.
 *
 * Run with: npx tsx scripts/migrate-v6.ts
 */
import "dotenv/config";
import { ensureSheetExists, findRow, updateRow, appendRows } from "../src/lib/google/sheet";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Appending v4 columns to Players (economy/milestone fields)...");
  await ensureSheetExists("Players", [
    "id", "email", "username", "passwordHash", "coin", "diamond", "ticket", "level", "exp",
    "currentStage", "currentCharacter", "currentWeapon", "vipLevel", "farmStageMaxWave",
    "isGuest", "isBanned", "lastLogin", "createdAt", "updatedAt",
    "personalMilestoneTier", "personalMilestoneGreenTier",
  ]);
  await sleep(1200);
  console.log("  Players header updated");

  console.log("Appending rewardDiamond to Mission, setting kill_10 -> +5 diamond...");
  await ensureSheetExists("Mission", ["id", "type", "description", "rewardCoin", "rewardExp", "targetValue", "metric", "rewardDiamond"]);
  await sleep(1200);
  const kill10 = await findRow("Mission", (r) => r.id === "kill_10");
  if (kill10) {
    await updateRow("Mission", kill10.rowIndex, { rewardDiamond: 5 });
    console.log("  kill_10.rewardDiamond = 5");
  } else {
    console.log("  kill_10 not found — skipping (will be seeded fresh by init-sheets if this is a new spreadsheet)");
  }
  await sleep(1200);

  console.log("Appending resetDate to PlayerMission (daily-quest reset support)...");
  await ensureSheetExists("PlayerMission", ["playerId", "missionId", "progress", "claimed", "resetDate"]);
  await sleep(1200);
  console.log("  PlayerMission header updated");

  console.log("Creating v4 sheets...");
  await ensureSheetExists("CurrencyExchangeConfig", ["id", "fromCurrency", "fromAmount", "toCurrency", "toAmount"]);
  await sleep(1200);
  await ensureSheetExists("TicketTopUp", ["id", "priceBaht", "ticketAmount"]);
  await sleep(1200);
  await ensureSheetExists("BossStage", ["bossId", "hp", "weaponId", "rocketCount", "growthPercent", "occursEveryNStages"]);
  await sleep(1200);
  await ensureSheetExists("PlayerIncome", ["playerId", "greenBanknoteBalance", "totalWithdrawn"]);
  await sleep(1200);
  await ensureSheetExists("WithdrawalRequest", ["id", "playerId", "amount", "status", "requestedAt"]);
  await sleep(1200);
  await ensureSheetExists("PlayerBossProgress", ["playerId", "bossEncounterCount"]);
  await sleep(1200);
  console.log("  Sheets created");

  console.log("Seeding v4 config data...");
  await appendRows("CurrencyExchangeConfig", [
    { id: "diamond_to_coin_50", fromCurrency: "diamond", fromAmount: 50, toCurrency: "coin", toAmount: 200 },
    { id: "diamond_to_coin_100", fromCurrency: "diamond", fromAmount: 100, toCurrency: "coin", toAmount: 410 },
    { id: "diamond_to_coin_250", fromCurrency: "diamond", fromAmount: 250, toCurrency: "coin", toAmount: 1100 },
    { id: "diamond_to_coin_1000", fromCurrency: "diamond", fromAmount: 1000, toCurrency: "coin", toAmount: 5000 },
    { id: "ticket_to_diamond_50", fromCurrency: "ticket", fromAmount: 50, toCurrency: "diamond", toAmount: 200 },
    { id: "ticket_to_diamond_100", fromCurrency: "ticket", fromAmount: 100, toCurrency: "diamond", toAmount: 410 },
    { id: "ticket_to_diamond_250", fromCurrency: "ticket", fromAmount: 250, toCurrency: "diamond", toAmount: 1100 },
    { id: "ticket_to_diamond_1000", fromCurrency: "ticket", fromAmount: 1000, toCurrency: "diamond", toAmount: 5000 },
  ]);
  await sleep(1500);

  await appendRows("TicketTopUp", [
    { id: "topup_49", priceBaht: 49, ticketAmount: 50 },
    { id: "topup_99", priceBaht: 99, ticketAmount: 110 },
    { id: "topup_199", priceBaht: 199, ticketAmount: 235 },
    { id: "topup_499", priceBaht: 499, ticketAmount: 600 },
    { id: "topup_999", priceBaht: 999, ticketAmount: 1250 },
    { id: "topup_3999", priceBaht: 3999, ticketAmount: 5500 },
  ]);
  await sleep(1500);

  await appendRows("BossStage", [
    { bossId: "boss_01", hp: 2000, weaponId: "rocket_launcher", rocketCount: 5, growthPercent: 10, occursEveryNStages: 10 },
  ]);
  await sleep(1500);

  console.log("\nMigration v6 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
