/**
 * v3 migration: character/weapon split (PlayerWeapon sheet + expanded Weapons
 * schema) and a repeatable farm stage. Safe to re-run.
 */
import "dotenv/config";
import { ensureSheetExists, findRow, updateRow, appendRows, readSheetRaw } from "../src/lib/google/sheet";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // --- 1. PlayerWeapon sheet ---
  console.log("Creating PlayerWeapon sheet...");
  await ensureSheetExists("PlayerWeapon", ["playerId", "weaponId", "owned", "equipped"]);
  await sleep(1200);

  // --- 2. Expand Weapons schema + backfill existing rows ---
  console.log("Expanding Weapons sheet schema...");
  await ensureSheetExists("Weapons", ["id", "name", "damage", "reload", "fireRate", "criticalChance", "criticalDamage", "accuracy", "magazineSize", "ammo", "sprite", "unlockType", "priceCoin", "priceDiamond", "description"]);
  await sleep(1200);

  const weaponUpdates: Record<string, Record<string, string | number>> = {
    pistol_wpn: { criticalDamage: 150, magazineSize: 12, ammo: 36, unlockType: "FREE", priceCoin: 0, priceDiamond: 0, description: "Standard issue sidearm." },
    rifle_wpn: { criticalDamage: 160, magazineSize: 30, ammo: 90, unlockType: "PURCHASE", priceCoin: 6000, priceDiamond: 0, description: "Balanced assault rifle." },
    shotgun_wpn: { criticalDamage: 175, magazineSize: 8, ammo: 32, unlockType: "PURCHASE", priceCoin: 12000, priceDiamond: 0, description: "Devastating at close range." },
    sniper_wpn: { criticalDamage: 250, magazineSize: 5, ammo: 20, unlockType: "DIAMOND", priceCoin: 0, priceDiamond: 550, description: "One shot, one kill." },
  };
  for (const [id, updates] of Object.entries(weaponUpdates)) {
    const found = await findRow("Weapons", (r) => r.id === id);
    if (found) await updateRow("Weapons", found.rowIndex, updates);
    await sleep(800);
  }

  // --- 3. Farm stage ---
  console.log("Adding isRepeatable column + farm_01 stage...");
  await ensureSheetExists("Stage", ["id", "name", "background", "width", "height", "music", "goalX", "rewardCoin", "rewardExp", "rewardTicket", "isRepeatable"]);
  await sleep(1200);

  const { rows: existingStages } = await readSheetRaw("Stage");
  const hasFarmStage = existingStages.some((r) => r.id === "farm_01");

  if (!hasFarmStage) {
    // Mark existing story stages as non-repeatable explicitly (blank would also
    // read as falsy, but this makes sheet intent visible to anyone editing it).
    for (const row of existingStages) {
      const found = await findRow("Stage", (r) => r.id === row.id);
      if (found && found.row.isRepeatable === "") {
        await updateRow("Stage", found.rowIndex, { isRepeatable: false });
        await sleep(600);
      }
    }

    await appendRows("Stage", [
      { id: "farm_01", name: "Training Grounds", background: "/assets/sprites/background/desert.png", width: 1600, height: 900, music: "/assets/audio/music/stage01_bgm.mp3", goalX: 1500, rewardCoin: 80, rewardExp: 60, rewardTicket: 0, isRepeatable: true },
    ]);
    await sleep(1200);

    await appendRows("StageEnemy", [
      { stageId: "farm_01", enemyId: "normal-soldier", spawnX: 400, spawnY: 300 },
      { stageId: "farm_01", enemyId: "normal-soldier", spawnX: 800, spawnY: 600 },
      { stageId: "farm_01", enemyId: "normal-soldier", spawnX: 1200, spawnY: 400 },
    ]);
    await sleep(1200);

    await appendRows("StageReward", [
      { stageId: "farm_01", coin: 80, exp: 60, ticket: 0, diamondChance: 0 },
    ]);
    console.log("  Added farm_01 stage (repeatable, no story-progress gate).");
  } else {
    console.log("  farm_01 already exists, skipping.");
  }

  console.log("\nMigration v3 complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
