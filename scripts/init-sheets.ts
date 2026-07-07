/**
 * One-time setup script: creates every sheet tab (if missing) with the correct
 * header row, and seeds starter game-balance data. Safe to re-run — it
 * overwrites header rows and only appends seed rows if the sheet is otherwise
 * empty. This reflects the FINAL schema (character/weapon split, per-weapon
 * daily ammo, passives, wave-scaled farm stage, kill-all win condition).
 *
 * Run with: npm run sheets:init
 */
import "dotenv/config";
import { ensureSheetExists, readSheetRaw, appendRows } from "../src/lib/google/sheet";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SHEETS: Record<string, string[]> = {
  // NOTE: new v4 fields (personalMilestoneTier, personalMilestoneGreenTier) are
  // appended at the END of the header, not inserted in the middle — on a live
  // sheet with existing player rows, inserting headers mid-row without also
  // shifting every data row's cells would silently misalign every column after
  // the insertion point. Appending at the end is safe: old rows just read "" for
  // the new trailing columns until updatePlayer() writes real values into them.
  Players: [
    "id", "email", "username", "passwordHash", "coin", "diamond", "ticket", "level", "exp",
    "currentStage", "currentCharacter", "currentWeapon", "vipLevel", "farmStageMaxWave",
    "isGuest", "isBanned", "lastLogin", "createdAt", "updatedAt",
    "personalMilestoneTier", "personalMilestoneGreenTier", "vipExp", "isTestAccount",
  ],
  Characters: [
    "id", "name", "rank", "unlockType", "unlockValue", "vipRequirement", "waveRequirement",
    "hpCurrent", "hpMax", "speed", "accuracy", "regenPer5s", "armorPercent", "critChance", "critDamage", "sprite",
  ],
  Weapons: [
    "id", "name", "unlockType", "unlockValue", "priceCoin", "priceDiamond", "priceTicket",
    "damage", "fireRate", "fireMode", "projectileCount", "accuracy", "magazineSize", "reloadTime",
    "critChance", "critDamage", "dailyAmmo", "spreadDegrees", "sprite", "explosionRadius",
  ],
  Equipment: ["id", "name", "slot", "rarity", "hpPercent", "damagePercent", "critChancePercent", "critDamagePercent", "sprite", "shieldValue"],
  Enemies: ["id", "weaponId", "hp", "coinReward", "sprite", "immobile"],
  PassiveConfig: ["passiveId", "tier", "cost", "currency", "bonusPercent"],
  // playerSpawnX/playerSpawnY appended at the end (v11 #2) — 0 means "not
  // designed yet", GameScene falls back to its old hardcoded default.
  Stage: ["id", "name", "isRepeatable", "width", "height", "background", "rewardCoin", "rewardExp", "playerSpawnX", "playerSpawnY", "multiverse", "comingSoon"],
  StageEnemy: ["stageId", "enemyId", "spawnX", "spawnY"],
  // v11 #2: real cover layout traced from the stage-layout PDF — empty for any
  // stage not yet designed, which keeps GameScene's random cover scatter.
  StageCover: ["stageId", "coverType", "x", "y"],
  PlayerCharacter: ["playerId", "characterId", "owned"],
  PlayerWeapon: ["playerId", "weaponId", "owned", "equipped"],
  PlayerWeaponAmmo: ["playerId", "weaponId", "remainingAmmo", "lastResetDate", "adRefillsToday"],
  PlayerEquipment: ["playerId", "equipmentId", "slot", "equipped"],
  PlayerEquipmentLevel: ["playerId", "equipmentId", "upgradeLevel"],
  PlayerPassive: ["playerId", "passiveId", "currentTier"],
  PlayerStageProgress: ["playerId", "stageId", "completed"],
  GachaConfig: ["poolId", "currency", "cost", "rewardType", "rarity", "rewardCurrency", "rewardAmount", "dropRate"],
  // rewardDiamond appended at the end (not inserted mid-row) — same live-sheet-safety reasoning as Players above.
  Mission: ["id", "type", "description", "rewardCoin", "rewardExp", "targetValue", "metric", "rewardDiamond"],
  PlayerMission: ["playerId", "missionId", "progress", "claimed", "resetDate"],
  Mail: ["playerId", "title", "message", "reward", "claimed"],
  Settings: ["key", "value"],
  // ---------- v4 ----------
  CurrencyExchangeConfig: ["id", "fromCurrency", "fromAmount", "toCurrency", "toAmount"],
  TicketTopUp: ["id", "priceBaht", "ticketAmount"],
  BossStage: ["bossId", "hp", "weaponId", "rocketCount", "growthPercent", "occursEveryNStages"],
  PlayerIncome: ["playerId", "greenBanknoteBalance", "totalWithdrawn"],
  WithdrawalRequest: ["id", "playerId", "amount", "phone", "status", "requestedAt"],
  PlayerBossProgress: ["playerId", "bossEncounterCount"],
  // ---------- v9 ----------
  VipConfig: ["level", "expRequired"],
};

async function isEmpty(sheetName: string): Promise<boolean> {
  const { rows } = await readSheetRaw(sheetName);
  return rows.length === 0;
}

async function seedIfEmpty(sheetName: string, rows: Record<string, string | number | boolean>[]) {
  if (!(await isEmpty(sheetName))) {
    console.log(`  ${sheetName}: already has data, skipping seed`);
    return;
  }
  await appendRows(sheetName, rows);
  await sleep(1500); // stay under Sheets API's per-minute write quota
  console.log(`  ${sheetName}: seeded ${rows.length} rows`);
}

function buildPassiveTiers(
  passiveId: string,
  currency: string,
  costs: number[],
  bonuses: number[]
): Record<string, string | number>[] {
  return costs.map((cost, i) => ({ passiveId, tier: i + 1, cost, currency, bonusPercent: bonuses[i] }));
}

async function main() {
  console.log("Creating sheet tabs + headers...");
  for (const [name, headers] of Object.entries(SHEETS)) {
    await ensureSheetExists(name, headers);
    await sleep(1200);
    console.log(`  ✓ ${name}`);
  }

  console.log("\nSeeding starter data...");

  // ---------- Characters (5) ----------
  await seedIfEmpty("Characters", [
    { id: "bob", name: "Bob", rank: "Private", unlockType: "FREE", unlockValue: 0, vipRequirement: 0, waveRequirement: 0, hpCurrent: 100, hpMax: 200, speed: 6, accuracy: 0, regenPer5s: 1, armorPercent: 0, critChance: 0, critDamage: 0, sprite: "/assets/sprites/characters/bob_private.svg" },
    { id: "jackson", name: "Jackson", rank: "Sergeant", unlockType: "PURCHASE", unlockValue: 2500, vipRequirement: 0, waveRequirement: 0, hpCurrent: 150, hpMax: 200, speed: 5, accuracy: 0, regenPer5s: 2, armorPercent: 10, critChance: 0, critDamage: 0, sprite: "/assets/sprites/characters/jackson_sergeant.svg" },
    { id: "ryzor", name: "Ryzor", rank: "Lieutenant", unlockType: "DIAMOND", unlockValue: 500, vipRequirement: 0, waveRequirement: 0, hpCurrent: 120, hpMax: 200, speed: 7, accuracy: 20, regenPer5s: 2, armorPercent: 20, critChance: 5, critDamage: 100, sprite: "/assets/sprites/characters/ryzor_lieutenant.svg" },
    { id: "mina", name: "Mina", rank: "Captain", unlockType: "TICKET", unlockValue: 199, vipRequirement: 0, waveRequirement: 0, hpCurrent: 80, hpMax: 200, speed: 10, accuracy: 30, regenPer5s: 1, armorPercent: 10, critChance: 20, critDamage: 50, sprite: "/assets/sprites/characters/mina_captain.svg" },
    { id: "azzure", name: "Azzure", rank: "Colonel", unlockType: "SPECIAL", unlockValue: 1099, vipRequirement: 5, waveRequirement: 15, hpCurrent: 200, hpMax: 200, speed: 8, accuracy: 50, regenPer5s: 5, armorPercent: 50, critChance: 20, critDamage: 150, sprite: "/assets/sprites/characters/azzure_colonel.svg" },
  ]);

  // ---------- Weapons (11) ----------
  const roundBullet = "/assets/sprites/bullets/bullet_round.svg";
  await seedIfEmpty("Weapons", [
    { id: "pistol", name: "Pistol", unlockType: "FREE", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 0, damage: 20, fireRate: 1, fireMode: "single", projectileCount: 1, accuracy: 50, magazineSize: 8, reloadTime: 5, critChance: 8, critDamage: 300, dailyAmmo: 80, spreadDegrees: 3, sprite: roundBullet },
    { id: "double_pistol", name: "Double Pistol", unlockType: "STAGE", unlockValue: 5, priceCoin: 50, priceDiamond: 0, priceTicket: 0, damage: 20, fireRate: 2, fireMode: "single", projectileCount: 1, accuracy: 50, magazineSize: 16, reloadTime: 5, critChance: 8, critDamage: 300, dailyAmmo: 80, spreadDegrees: 4, sprite: roundBullet },
    { id: "m16a1", name: "M16A1", unlockType: "PURCHASE", unlockValue: 0, priceCoin: 1500, priceDiamond: 0, priceTicket: 0, damage: 15, fireRate: 5, fireMode: "single", projectileCount: 1, accuracy: 50, magazineSize: 30, reloadTime: 6, critChance: 10, critDamage: 250, dailyAmmo: 150, spreadDegrees: 2, sprite: roundBullet },
    { id: "m16a4", name: "M16A4", unlockType: "PURCHASE", unlockValue: 0, priceCoin: 4000, priceDiamond: 0, priceTicket: 0, damage: 20, fireRate: 1, fireMode: "burst", projectileCount: 3, accuracy: 60, magazineSize: 30, reloadTime: 6, critChance: 15, critDamage: 300, dailyAmmo: 150, spreadDegrees: 3, sprite: roundBullet },
    { id: "shotgun", name: "Shotgun", unlockType: "PURCHASE", unlockValue: 0, priceCoin: 15000, priceDiamond: 0, priceTicket: 0, damage: 20, fireRate: 1, fireMode: "spread", projectileCount: 16, accuracy: 50, magazineSize: 16, reloadTime: 5, critChance: 10, critDamage: 300, dailyAmmo: 160, spreadDegrees: 10, sprite: roundBullet },
    { id: "ak47", name: "AK47", unlockType: "DIAMOND", unlockValue: 0, priceCoin: 0, priceDiamond: 150, priceTicket: 0, damage: 30, fireRate: 4, fireMode: "single", projectileCount: 1, accuracy: 45, magazineSize: 40, reloadTime: 8, critChance: 20, critDamage: 400, dailyAmmo: 120, spreadDegrees: 4, sprite: roundBullet },
    // Gatling fires ONE bullet per trigger (like every other "single" weapon), just
    // at a very high fireRate (12/s) with a narrow 2-degree spread — not 12
    // simultaneous pellets.
    { id: "gatling", name: "Gatling", unlockType: "DIAMOND", unlockValue: 0, priceCoin: 0, priceDiamond: 1800, priceTicket: 0, damage: 15, fireRate: 12, fireMode: "single", projectileCount: 1, accuracy: 45, magazineSize: 100, reloadTime: 12, critChance: 5, critDamage: 300, dailyAmmo: 500, spreadDegrees: 2, sprite: roundBullet },
    { id: "sniper", name: "Sniper", unlockType: "TICKET", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 399, damage: 100, fireRate: 0.5, fireMode: "single", projectileCount: 1, accuracy: 80, magazineSize: 5, reloadTime: 8, critChance: 40, critDamage: 450, dailyAmmo: 50, spreadDegrees: 0.5, sprite: roundBullet },
    { id: "rocket_launcher", name: "Rocket Launcher", unlockType: "TICKET", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 899, damage: 320, fireRate: 0.125, fireMode: "aoe", projectileCount: 1, accuracy: 100, magazineSize: 1, reloadTime: 8, critChance: 0, critDamage: 0, dailyAmmo: 10, spreadDegrees: 1, explosionRadius: 90, sprite: "/assets/sprites/bullets/bullet_rocket.svg" },
    { id: "grenade_launcher", name: "Grenade Launcher", unlockType: "TICKET", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 899, damage: 200, fireRate: 1, fireMode: "lob", projectileCount: 1, accuracy: 100, magazineSize: 6, reloadTime: 16, critChance: 0, critDamage: 0, dailyAmmo: 60, spreadDegrees: 1, explosionRadius: 45, sprite: "/assets/sprites/bullets/bullet_grenade.svg" },
    { id: "rasor_gun", name: "Rasor Gun", unlockType: "TICKET", unlockValue: 0, priceCoin: 0, priceDiamond: 0, priceTicket: 1099, damage: 30, fireRate: 8, fireMode: "single", projectileCount: 1, accuracy: 70, magazineSize: 40, reloadTime: 8, critChance: 20, critDamage: 400, dailyAmmo: 160, spreadDegrees: 2, sprite: "/assets/sprites/bullets/bullet_razor.svg" },
  ]);

  // ---------- Equipment (12: helmet/vest/boots x common/rare/epic/legendary) ----------
  // v5: all 12 rarity-themed sprites now exist (leather/common, steel/rare,
  // amethyst/epic, gold/legendary) — each row points at its own dedicated file.
  // shieldValue is a flat point total (no dupe/passive scaling — see config/equipment.ts).
  await seedIfEmpty("Equipment", [
    { id: "helmet_common", name: "Common Helmet", slot: "helmet", rarity: "common", hpPercent: 4, damagePercent: 0, critChancePercent: 0, critDamagePercent: 0, shieldValue: 75, sprite: "/assets/sprites/equipment/helmet_common.svg" },
    { id: "helmet_rare", name: "Rare Helmet", slot: "helmet", rarity: "rare", hpPercent: 8, damagePercent: 8, critChancePercent: 0, critDamagePercent: 0, shieldValue: 150, sprite: "/assets/sprites/equipment/helmet_rare.svg" },
    { id: "helmet_epic", name: "Epic Helmet", slot: "helmet", rarity: "epic", hpPercent: 16, damagePercent: 16, critChancePercent: 0, critDamagePercent: 20, shieldValue: 300, sprite: "/assets/sprites/equipment/helmet_epic.svg" },
    { id: "helmet_legendary", name: "Legendary Helmet", slot: "helmet", rarity: "legendary", hpPercent: 25, damagePercent: 25, critChancePercent: 4, critDamagePercent: 40, shieldValue: 600, sprite: "/assets/sprites/equipment/helmet_legendary.svg" },

    { id: "vest_common", name: "Common Vest", slot: "vest", rarity: "common", hpPercent: 5, damagePercent: 0, critChancePercent: 0, critDamagePercent: 0, shieldValue: 100, sprite: "/assets/sprites/equipment/vest_common.svg" },
    { id: "vest_rare", name: "Rare Vest", slot: "vest", rarity: "rare", hpPercent: 10, damagePercent: 10, critChancePercent: 0, critDamagePercent: 0, shieldValue: 200, sprite: "/assets/sprites/equipment/vest_rare.svg" },
    { id: "vest_epic", name: "Epic Vest", slot: "vest", rarity: "epic", hpPercent: 20, damagePercent: 20, critChancePercent: 0, critDamagePercent: 10, shieldValue: 400, sprite: "/assets/sprites/equipment/vest_epic.svg" },
    { id: "vest_legendary", name: "Legendary Vest", slot: "vest", rarity: "legendary", hpPercent: 30, damagePercent: 30, critChancePercent: 3, critDamagePercent: 30, shieldValue: 800, sprite: "/assets/sprites/equipment/vest_legendary.svg" },

    { id: "boots_common", name: "Common Boots", slot: "boots", rarity: "common", hpPercent: 3, damagePercent: 0, critChancePercent: 0, critDamagePercent: 0, shieldValue: 50, sprite: "/assets/sprites/equipment/boots_common.svg" },
    { id: "boots_rare", name: "Rare Boots", slot: "boots", rarity: "rare", hpPercent: 6, damagePercent: 6, critChancePercent: 0, critDamagePercent: 0, shieldValue: 100, sprite: "/assets/sprites/equipment/boots_rare.svg" },
    { id: "boots_epic", name: "Epic Boots", slot: "boots", rarity: "epic", hpPercent: 12, damagePercent: 12, critChancePercent: 0, critDamagePercent: 30, shieldValue: 200, sprite: "/assets/sprites/equipment/boots_epic.svg" },
    { id: "boots_legendary", name: "Legendary Boots", slot: "boots", rarity: "legendary", hpPercent: 20, damagePercent: 20, critChancePercent: 5, critDamagePercent: 50, shieldValue: 400, sprite: "/assets/sprites/equipment/boots_legendary.svg" },
  ]);

  // ---------- Enemies (5) — damage/fireRate/etc all come from the referenced weapon ----------
  await seedIfEmpty("Enemies", [
    { id: "enemy_pistol", weaponId: "pistol", hp: 100, coinReward: 1, sprite: "/assets/sprites/enemy/enemy_pistol.svg", immobile: false },
    { id: "enemy_ak47", weaponId: "ak47", hp: 150, coinReward: 2, sprite: "/assets/sprites/enemy/enemy_ak47.svg", immobile: false },
    { id: "enemy_sniper", weaponId: "sniper", hp: 180, coinReward: 3, sprite: "/assets/sprites/enemy/enemy_sniper.svg", immobile: false },
    { id: "enemy_shotgun", weaponId: "shotgun", hp: 300, coinReward: 5, sprite: "/assets/sprites/enemy/enemy_shotgun.svg", immobile: false },
    { id: "enemy_rocket", weaponId: "rocket_launcher", hp: 250, coinReward: 5, sprite: "/assets/sprites/enemy/enemy_rocket.svg", immobile: false },
    // v16: stationary gatling turret — can't move/chase, but keeps suppressing at any range.
    { id: "enemy_turret", weaponId: "gatling", hp: 500, coinReward: 8, sprite: "/assets/sprites/enemy/enemy_turret.svg", immobile: true },
  ]);

  // ---------- PassiveConfig (8 passives x 10 tiers) ----------
  const coinCosts = [50, 150, 500, 1000, 2000, 3000, 5000, 10000, 25000, 50000];
  const coinBonuses = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];
  const diamondCostsA = [10, 50, 100, 200, 500, 1000, 2500, 5000, 10000, 25000];
  const critChanceBonuses = [1, 1, 1, 1, 1, 1, 1, 2, 3, 3];
  const critDamageBonuses = [5, 5, 5, 5, 10, 10, 10, 10, 20, 20];
  const accuracyCosts = [5, 10, 50, 100, 200, 300, 500, 1000, 1500, 2500];
  const accuracyBonuses = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const ammoCosts = [5, 10, 50, 100, 250, 500, 1000, 2000, 4000, 5000];
  const ammoBonuses = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];

  await seedIfEmpty("PassiveConfig", [
    ...buildPassiveTiers("hpPercent", "coin", coinCosts, coinBonuses),
    ...buildPassiveTiers("damagePercent", "coin", coinCosts, coinBonuses),
    ...buildPassiveTiers("reloadSpeedPercent", "coin", coinCosts, coinBonuses),
    ...buildPassiveTiers("fireRatePercent", "coin", coinCosts, coinBonuses),
    ...buildPassiveTiers("critChance", "diamond", diamondCostsA, critChanceBonuses),
    ...buildPassiveTiers("critDamagePercent", "diamond", diamondCostsA, critDamageBonuses),
    ...buildPassiveTiers("accuracy", "ticket", accuracyCosts, accuracyBonuses),
    ...buildPassiveTiers("dailyAmmoPercent", "ticket", ammoCosts, ammoBonuses),
  ]);

  // ---------- Stage (10 story + 1 farm) — v11/v12: playerSpawnX/Y are real
  // coordinates traced from the user's "แผนผัง Stage 1-10, Stage Farm" PDF
  // (see scripts/extract-stage-pdf.py + scripts/data/stage-layout-raw.json).
  // name/rewardCoin/rewardExp are ALSO real, from that PDF's per-stage
  // description pages (not repeated boilerplate as first assumed — each
  // stage's actual name + reward, confirmed with the user). stage10's
  // description also calls out that enemy_rocket gets 5x HP on that specific
  // map — implemented in src/app/api/game/start/route.ts, not a column here. ----------
  await seedIfEmpty("Stage", [
    { id: "stage01", name: "The Forest", isRepeatable: false, width: 1280, height: 720, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 50, rewardExp: 100, playerSpawnX: 61, playerSpawnY: 583 },
    { id: "stage02", name: "The Mansion", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 50, rewardExp: 100, playerSpawnX: 128, playerSpawnY: 372 },
    { id: "stage03", name: "House", isRepeatable: false, width: 1440, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 50, rewardExp: 100, playerSpawnX: 284, playerSpawnY: 612 },
    { id: "stage04", name: "The Camping", isRepeatable: false, width: 1600, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 50, rewardExp: 100, playerSpawnX: 76, playerSpawnY: 729 },
    { id: "stage05", name: "Shotgun", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 50, rewardExp: 100, playerSpawnX: 403, playerSpawnY: 536 },
    { id: "stage06", name: "Strong Mansion", isRepeatable: false, width: 1280, height: 720, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 75, rewardExp: 150, playerSpawnX: 622, playerSpawnY: 357 },
    { id: "stage07", name: "Sniper", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 75, rewardExp: 150, playerSpawnX: 1256, playerSpawnY: 188 },
    { id: "stage08", name: "Rocket", isRepeatable: false, width: 1440, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 75, rewardExp: 150, playerSpawnX: 167, playerSpawnY: 434 },
    { id: "stage09", name: "Enemy Mansion", isRepeatable: false, width: 1600, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 75, rewardExp: 150, playerSpawnX: 887, playerSpawnY: 717 },
    { id: "stage10", name: "Boss 1", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 100, rewardExp: 200, playerSpawnX: 68, playerSpawnY: 656 },
    // rewardExp: 10 is exact from the PDF ("เมื่อผ่านแต่ละ wave จะได้ทีละ 10 Exp") — /api/game/complete
    // multiplies this by farmWaveReached, so 10 really is "per wave", not a typo.
    { id: "farm_01", name: "Training Grounds", isRepeatable: true, width: 1280, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 80, rewardExp: 10, playerSpawnX: 636, playerSpawnY: 467 },
    // v17: Multiverse 2 — unlocked after clearing the boss that follows story
    // stage 10. Placeholder rows only (comingSoon: true) until real stage
    // layouts are designed; rock/stone background to match the boss arena's theme.
    ...Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      return {
        id: `mv2_stage${String(n).padStart(2, "0")}`,
        name: `Multiverse 2 - Stage ${n}`,
        isRepeatable: false,
        width: 1280,
        height: 720,
        background: "/assets/sprites/background/rock_terrain.svg",
        rewardCoin: 100,
        rewardExp: 150,
        playerSpawnX: 0,
        playerSpawnY: 0,
        multiverse: 2,
        comingSoon: true,
      };
    }),
  ]);

  // ---------- StageEnemy (story stages only — farm generates waves procedurally) ----------
  // v11/v12: real enemy positions traced from the stage-layout PDF (legend:
  // 1=Pistol, 2=AK47, 3=Shotgun, 4=Sniper, 5=Rocket), replacing every one of
  // the old stage01-10 placeholders (stage06-10 used to just copy stage01-05).
  await seedIfEmpty("StageEnemy", [
    // stage01
    { stageId: "stage01", enemyId: "enemy_pistol", spawnX: 867, spawnY: 238 },
    { stageId: "stage01", enemyId: "enemy_pistol", spawnX: 537, spawnY: 353 },
    { stageId: "stage01", enemyId: "enemy_pistol", spawnX: 1014, spawnY: 237 },

    // stage02
    { stageId: "stage02", enemyId: "enemy_pistol", spawnX: 617, spawnY: 174 },
    { stageId: "stage02", enemyId: "enemy_ak47", spawnX: 1209, spawnY: 179 },
    { stageId: "stage02", enemyId: "enemy_pistol", spawnX: 946, spawnY: 547 },

    // stage03
    { stageId: "stage03", enemyId: "enemy_pistol", spawnX: 740, spawnY: 192 },
    { stageId: "stage03", enemyId: "enemy_ak47", spawnX: 1049, spawnY: 312 },
    { stageId: "stage03", enemyId: "enemy_ak47", spawnX: 1241, spawnY: 319 },
    { stageId: "stage03", enemyId: "enemy_pistol", spawnX: 1328, spawnY: 550 },

    // stage04
    { stageId: "stage04", enemyId: "enemy_pistol", spawnX: 1018, spawnY: 192 },
    { stageId: "stage04", enemyId: "enemy_ak47", spawnX: 1373, spawnY: 367 },
    { stageId: "stage04", enemyId: "enemy_shotgun", spawnX: 232, spawnY: 228 },
    { stageId: "stage04", enemyId: "enemy_ak47", spawnX: 710, spawnY: 460 },
    { stageId: "stage04", enemyId: "enemy_ak47", spawnX: 1426, spawnY: 696 },

    // stage05
    { stageId: "stage05", enemyId: "enemy_ak47", spawnX: 114, spawnY: 599 },
    { stageId: "stage05", enemyId: "enemy_shotgun", spawnX: 561, spawnY: 314 },
    { stageId: "stage05", enemyId: "enemy_sniper", spawnX: 1115, spawnY: 305 },
    { stageId: "stage05", enemyId: "enemy_shotgun", spawnX: 1115, spawnY: 599 },
    { stageId: "stage05", enemyId: "enemy_ak47", spawnX: 790, spawnY: 193 },

    // stage06
    { stageId: "stage06", enemyId: "enemy_shotgun", spawnX: 151, spawnY: 371 },
    { stageId: "stage06", enemyId: "enemy_ak47", spawnX: 915, spawnY: 154 },
    { stageId: "stage06", enemyId: "enemy_rocket", spawnX: 991, spawnY: 533 },
    { stageId: "stage06", enemyId: "enemy_ak47", spawnX: 221, spawnY: 546 },
    { stageId: "stage06", enemyId: "enemy_shotgun", spawnX: 622, spawnY: 569 },
    { stageId: "stage06", enemyId: "enemy_pistol", spawnX: 773, spawnY: 138 },

    // stage07
    { stageId: "stage07", enemyId: "enemy_sniper", spawnX: 420, spawnY: 518 },
    { stageId: "stage07", enemyId: "enemy_sniper", spawnX: 145, spawnY: 420 },
    { stageId: "stage07", enemyId: "enemy_sniper", spawnX: 701, spawnY: 611 },
    { stageId: "stage07", enemyId: "enemy_ak47", spawnX: 826, spawnY: 173 },
    { stageId: "stage07", enemyId: "enemy_ak47", spawnX: 825, spawnY: 246 },

    // stage08
    { stageId: "stage08", enemyId: "enemy_ak47", spawnX: 926, spawnY: 401 },
    { stageId: "stage08", enemyId: "enemy_shotgun", spawnX: 612, spawnY: 580 },
    { stageId: "stage08", enemyId: "enemy_rocket", spawnX: 1125, spawnY: 231 },
    { stageId: "stage08", enemyId: "enemy_ak47", spawnX: 1173, spawnY: 467 },
    { stageId: "stage08", enemyId: "enemy_ak47", spawnX: 864, spawnY: 264 },
    { stageId: "stage08", enemyId: "enemy_ak47", spawnX: 485, spawnY: 666 },

    // stage09
    { stageId: "stage09", enemyId: "enemy_pistol", spawnX: 142, spawnY: 681 },
    { stageId: "stage09", enemyId: "enemy_ak47", spawnX: 1507, spawnY: 176 },
    { stageId: "stage09", enemyId: "enemy_shotgun", spawnX: 172, spawnY: 271 },
    { stageId: "stage09", enemyId: "enemy_sniper", spawnX: 1405, spawnY: 281 },
    { stageId: "stage09", enemyId: "enemy_rocket", spawnX: 813, spawnY: 219 },
    { stageId: "stage09", enemyId: "enemy_pistol", spawnX: 1467, spawnY: 697 },
    { stageId: "stage09", enemyId: "enemy_shotgun", spawnX: 172, spawnY: 392 },
    { stageId: "stage09", enemyId: "enemy_ak47", spawnX: 1172, spawnY: 373 },

    // stage10
    { stageId: "stage10", enemyId: "enemy_pistol", spawnX: 791, spawnY: 627 },
    { stageId: "stage10", enemyId: "enemy_rocket", spawnX: 1107, spawnY: 277 },
    { stageId: "stage10", enemyId: "enemy_pistol", spawnX: 189, spawnY: 288 },
    { stageId: "stage10", enemyId: "enemy_pistol", spawnX: 360, spawnY: 348 },
    { stageId: "stage10", enemyId: "enemy_pistol", spawnX: 510, spawnY: 421 },
    { stageId: "stage10", enemyId: "enemy_pistol", spawnX: 664, spawnY: 527 },
  ]);

  // ---------- StageCover (v11/v12: real cover-object layout from the stage-layout
  // PDF for all 10 story stages + farm — previously random-only for every stage). ----------
  await seedIfEmpty("StageCover", [
    // stage01
    { stageId: "stage01", coverType: "crate", x: 149, y: 207 },
    { stageId: "stage01", coverType: "sandbag", x: 834, y: 343 },
    { stageId: "stage01", coverType: "sandbag", x: 975, y: 343 },
    { stageId: "stage01", coverType: "crate", x: 321, y: 321 },
    { stageId: "stage01", coverType: "crate", x: 490, y: 205 },
    { stageId: "stage01", coverType: "crate", x: 499, y: 464 },
    { stageId: "stage01", coverType: "crate", x: 768, y: 578 },
    { stageId: "stage01", coverType: "crate", x: 1040, y: 478 },
    { stageId: "stage01", coverType: "tree", x: 150, y: 397 },
    { stageId: "stage01", coverType: "tree", x: 366, y: 538 },
    { stageId: "stage01", coverType: "tree", x: 61, y: 301 },
    { stageId: "stage01", coverType: "sandbag", x: 696, y: 216 },
    { stageId: "stage01", coverType: "tree", x: 540, y: 590 },
    { stageId: "stage01", coverType: "tree", x: 338, y: 427 },
    { stageId: "stage01", coverType: "camp_tent", x: 1132, y: 167 },
    { stageId: "stage01", coverType: "tree", x: 61, y: 484 },
    { stageId: "stage01", coverType: "tree", x: 192, y: 504 },
    { stageId: "stage01", coverType: "tree", x: 218, y: 586 },
    { stageId: "stage01", coverType: "camp_tent", x: 975, y: 167 },
    { stageId: "stage01", coverType: "camp_tent", x: 1132, y: 275 },
    { stageId: "stage01", coverType: "sandbag", x: 696, y: 278 },

    // stage02
    { stageId: "stage02", coverType: "camp_tent", x: 1172, y: 593 },
    { stageId: "stage02", coverType: "tree", x: 731, y: 242 },
    { stageId: "stage02", coverType: "tree", x: 658, y: 447 },
    { stageId: "stage02", coverType: "tree", x: 762, y: 615 },
    { stageId: "stage02", coverType: "tree", x: 915, y: 412 },
    { stageId: "stage02", coverType: "sandbag", x: 1013, y: 259 },
    { stageId: "stage02", coverType: "sandbag", x: 1252, y: 342 },
    { stageId: "stage02", coverType: "sandbag", x: 851, y: 151 },
    { stageId: "stage02", coverType: "tree", x: 128, y: 499 },
    { stageId: "stage02", coverType: "camp_tent", x: 401, y: 173 },
    { stageId: "stage02", coverType: "tree", x: 321, y: 412 },
    { stageId: "stage02", coverType: "tree", x: 240, y: 265 },
    { stageId: "stage02", coverType: "tree", x: 108, y: 187 },
    { stageId: "stage02", coverType: "tree", x: 275, y: 636 },
    { stageId: "stage02", coverType: "tree", x: 469, y: 547 },
    { stageId: "stage02", coverType: "tree", x: 486, y: 284 },

    // stage03
    { stageId: "stage03", coverType: "crate", x: 1122, y: 681 },
    { stageId: "stage03", coverType: "tree", x: 453, y: 687 },
    { stageId: "stage03", coverType: "tree", x: 129, y: 500 },
    { stageId: "stage03", coverType: "tree", x: 453, y: 499 },
    { stageId: "stage03", coverType: "sandbag", x: 1342, y: 676 },
    { stageId: "stage03", coverType: "sandbag", x: 1002, y: 552 },
    { stageId: "stage03", coverType: "sandbag", x: 720, y: 391 },
    { stageId: "stage03", coverType: "crate", x: 546, y: 312 },
    { stageId: "stage03", coverType: "crate", x: 768, y: 534 },
    { stageId: "stage03", coverType: "crate", x: 304, y: 311 },
    { stageId: "stage03", coverType: "crate", x: 770, y: 698 },
    { stageId: "stage03", coverType: "sandbag", x: 536, y: 189 },
    { stageId: "stage03", coverType: "house", x: 1146, y: 198 },
    { stageId: "stage03", coverType: "wall", x: 1359, y: 432 },
    { stageId: "stage03", coverType: "tree", x: 129, y: 682 },
    { stageId: "stage03", coverType: "wall", x: 1170, y: 432 },
    { stageId: "stage03", coverType: "wall", x: 982, y: 432 },
    { stageId: "stage03", coverType: "wall", x: 882, y: 331 },
    { stageId: "stage03", coverType: "wall", x: 891, y: 196 },

    // stage04
    { stageId: "stage04", coverType: "crate", x: 281, y: 283 },
    { stageId: "stage04", coverType: "camp_tent", x: 670, y: 361 },
    { stageId: "stage04", coverType: "sandbag", x: 972, y: 515 },
    { stageId: "stage04", coverType: "sandbag", x: 395, y: 389 },
    { stageId: "stage04", coverType: "crate", x: 115, y: 387 },
    { stageId: "stage04", coverType: "wall", x: 875, y: 713 },
    { stageId: "stage04", coverType: "tree", x: 289, y: 676 },
    { stageId: "stage04", coverType: "tree", x: 1532, y: 471 },
    { stageId: "stage04", coverType: "tree", x: 1216, y: 266 },
    { stageId: "stage04", coverType: "sandbag", x: 670, y: 620 },
    { stageId: "stage04", coverType: "camp_tent", x: 1415, y: 209 },
    { stageId: "stage04", coverType: "house", x: 543, y: 221 },
    { stageId: "stage04", coverType: "wall", x: 232, y: 510 },
    { stageId: "stage04", coverType: "tree", x: 482, y: 540 },
    { stageId: "stage04", coverType: "house", x: 1018, y: 358 },
    { stageId: "stage04", coverType: "house", x: 1041, y: 626 },
    { stageId: "stage04", coverType: "camp_tent", x: 1257, y: 528 },

    // stage05
    { stageId: "stage05", coverType: "crate", x: 1049, y: 178 },
    { stageId: "stage05", coverType: "crate", x: 932, y: 320 },
    { stageId: "stage05", coverType: "crate", x: 1079, y: 453 },
    { stageId: "stage05", coverType: "crate", x: 951, y: 612 },
    { stageId: "stage05", coverType: "wall", x: 538, y: 559 },
    { stageId: "stage05", coverType: "wall", x: 537, y: 466 },
    { stageId: "stage05", coverType: "wall", x: 414, y: 403 },
    { stageId: "stage05", coverType: "wall", x: 282, y: 403 },
    { stageId: "stage05", coverType: "tree", x: 414, y: 636 },
    { stageId: "stage05", coverType: "tree", x: 251, y: 636 },
    { stageId: "stage05", coverType: "camp_tent", x: 363, y: 280 },
    { stageId: "stage05", coverType: "sandbag", x: 736, y: 328 },
    { stageId: "stage05", coverType: "sandbag", x: 136, y: 197 },
    { stageId: "stage05", coverType: "sandbag", x: 772, y: 487 },
    { stageId: "stage05", coverType: "camp_tent", x: 581, y: 181 },
    { stageId: "stage05", coverType: "house", x: 1231, y: 173 },
    { stageId: "stage05", coverType: "wall", x: 538, y: 649 },
    { stageId: "stage05", coverType: "tree", x: 257, y: 530 },
    { stageId: "stage05", coverType: "house", x: 1284, y: 305 },
    { stageId: "stage05", coverType: "house", x: 1244, y: 446 },
    { stageId: "stage05", coverType: "house", x: 1325, y: 599 },

    // stage06
    { stageId: "stage06", coverType: "crate", x: 779, y: 258 },
    { stageId: "stage06", coverType: "wall", x: 799, y: 351 },
    { stageId: "stage06", coverType: "wall", x: 455, y: 351 },
    { stageId: "stage06", coverType: "wall", x: 619, y: 255 },
    { stageId: "stage06", coverType: "wall", x: 622, y: 473 },
    { stageId: "stage06", coverType: "camp_tent", x: 300, y: 343 },
    { stageId: "stage06", coverType: "sandbag", x: 121, y: 175 },
    { stageId: "stage06", coverType: "camp_tent", x: 606, y: 135 },
    { stageId: "stage06", coverType: "camp_tent", x: 940, y: 260 },
    { stageId: "stage06", coverType: "camp_tent", x: 948, y: 406 },
    { stageId: "stage06", coverType: "sandbag", x: 118, y: 236 },
    { stageId: "stage06", coverType: "camp_tent", x: 301, y: 458 },
    { stageId: "stage06", coverType: "sandbag", x: 1204, y: 271 },
    { stageId: "stage06", coverType: "sandbag", x: 1174, y: 399 },
    { stageId: "stage06", coverType: "house", x: 1094, y: 154 },
    { stageId: "stage06", coverType: "wall", x: 479, y: 577 },
    { stageId: "stage06", coverType: "house", x: 426, y: 154 },
    { stageId: "stage06", coverType: "house", x: 279, y: 151 },
    { stageId: "stage06", coverType: "house", x: 1178, y: 533 },
    { stageId: "stage06", coverType: "crate", x: 458, y: 471 },
    { stageId: "stage06", coverType: "crate", x: 799, y: 473 },

    // stage07
    { stageId: "stage07", coverType: "crate", x: 546, y: 175 },
    { stageId: "stage07", coverType: "sandbag", x: 886, y: 455 },
    { stageId: "stage07", coverType: "sandbag", x: 1243, y: 542 },
    { stageId: "stage07", coverType: "crate", x: 994, y: 173 },
    { stageId: "stage07", coverType: "crate", x: 998, y: 231 },
    { stageId: "stage07", coverType: "crate", x: 998, y: 290 },
    { stageId: "stage07", coverType: "crate", x: 1228, y: 405 },
    { stageId: "stage07", coverType: "sandbag", x: 343, y: 254 },
    { stageId: "stage07", coverType: "house", x: 145, y: 504 },
    { stageId: "stage07", coverType: "house", x: 422, y: 626 },
    { stageId: "stage07", coverType: "house", x: 358, y: 379 },
    { stageId: "stage07", coverType: "house", x: 628, y: 461 },
    { stageId: "stage07", coverType: "house", x: 939, y: 597 },
    { stageId: "stage07", coverType: "house", x: 125, y: 236 },
    { stageId: "stage07", coverType: "sandbag", x: 577, y: 353 },

    // stage08
    { stageId: "stage08", coverType: "camp_tent", x: 167, y: 297 },
    { stageId: "stage08", coverType: "tree", x: 1009, y: 602 },
    { stageId: "stage08", coverType: "tree", x: 788, y: 666 },
    { stageId: "stage08", coverType: "tree", x: 1104, y: 344 },
    { stageId: "stage08", coverType: "tree", x: 1237, y: 681 },
    { stageId: "stage08", coverType: "tree", x: 1334, y: 215 },
    { stageId: "stage08", coverType: "tree", x: 1354, y: 492 },
    { stageId: "stage08", coverType: "tree", x: 367, y: 240 },
    { stageId: "stage08", coverType: "camp_tent", x: 343, y: 372 },
    { stageId: "stage08", coverType: "camp_tent", x: 298, y: 534 },
    { stageId: "stage08", coverType: "camp_tent", x: 129, y: 656 },
    { stageId: "stage08", coverType: "tree", x: 561, y: 323 },
    { stageId: "stage08", coverType: "tree", x: 516, y: 466 },
    { stageId: "stage08", coverType: "tree", x: 704, y: 196 },
    { stageId: "stage08", coverType: "tree", x: 765, y: 474 },

    // stage09
    { stageId: "stage09", coverType: "crate", x: 346, y: 166 },
    { stageId: "stage09", coverType: "camp_tent", x: 1489, y: 614 },
    { stageId: "stage09", coverType: "wall", x: 222, y: 528 },
    { stageId: "stage09", coverType: "wall", x: 346, y: 528 },
    { stageId: "stage09", coverType: "wall", x: 471, y: 528 },
    { stageId: "stage09", coverType: "wall", x: 595, y: 528 },
    { stageId: "stage09", coverType: "wall", x: 1015, y: 529 },
    { stageId: "stage09", coverType: "wall", x: 1138, y: 529 },
    { stageId: "stage09", coverType: "wall", x: 1263, y: 529 },
    { stageId: "stage09", coverType: "wall", x: 1387, y: 529 },
    { stageId: "stage09", coverType: "wall", x: 1512, y: 529 },
    { stageId: "stage09", coverType: "sandbag", x: 603, y: 450 },
    { stageId: "stage09", coverType: "sandbag", x: 603, y: 374 },
    { stageId: "stage09", coverType: "sandbag", x: 1005, y: 463 },
    { stageId: "stage09", coverType: "sandbag", x: 1005, y: 383 },
    { stageId: "stage09", coverType: "crate", x: 346, y: 259 },
    { stageId: "stage09", coverType: "crate", x: 1195, y: 160 },
    { stageId: "stage09", coverType: "crate", x: 1195, y: 246 },
    { stageId: "stage09", coverType: "house", x: 608, y: 181 },
    { stageId: "stage09", coverType: "house", x: 741, y: 160 },
    { stageId: "stage09", coverType: "house", x: 924, y: 165 },
    { stageId: "stage09", coverType: "house", x: 1062, y: 183 },
    { stageId: "stage09", coverType: "camp_tent", x: 448, y: 622 },
    { stageId: "stage09", coverType: "house", x: 1292, y: 455 },
    { stageId: "stage09", coverType: "house", x: 1455, y: 398 },
    { stageId: "stage09", coverType: "house", x: 1335, y: 173 },
    { stageId: "stage09", coverType: "house", x: 444, y: 459 },
    { stageId: "stage09", coverType: "house", x: 72, y: 322 },
    { stageId: "stage09", coverType: "house", x: 79, y: 421 },
    { stageId: "stage09", coverType: "house", x: 501, y: 163 },
    { stageId: "stage09", coverType: "wall", x: 99, y: 528 },
    { stageId: "stage09", coverType: "tree", x: 286, y: 630 },
    { stageId: "stage09", coverType: "tree", x: 584, y: 672 },
    { stageId: "stage09", coverType: "tree", x: 1096, y: 621 },
    { stageId: "stage09", coverType: "tree", x: 1292, y: 733 },

    // stage10
    { stageId: "stage10", coverType: "camp_tent", x: 1273, y: 188 },
    { stageId: "stage10", coverType: "crate", x: 792, y: 458 },
    { stageId: "stage10", coverType: "crate", x: 912, y: 530 },
    { stageId: "stage10", coverType: "crate", x: 1033, y: 612 },
    { stageId: "stage10", coverType: "camp_tent", x: 1100, y: 154 },
    { stageId: "stage10", coverType: "camp_tent", x: 1308, y: 333 },
    { stageId: "stage10", coverType: "camp_tent", x: 1133, y: 411 },
    { stageId: "stage10", coverType: "camp_tent", x: 942, y: 343 },
    { stageId: "stage10", coverType: "camp_tent", x: 912, y: 212 },
    { stageId: "stage10", coverType: "sandbag", x: 180, y: 388 },
    { stageId: "stage10", coverType: "sandbag", x: 340, y: 448 },
    { stageId: "stage10", coverType: "sandbag", x: 510, y: 532 },
    { stageId: "stage10", coverType: "sandbag", x: 623, y: 630 },
    { stageId: "stage10", coverType: "crate", x: 292, y: 202 },
    { stageId: "stage10", coverType: "crate", x: 417, y: 253 },
    { stageId: "stage10", coverType: "crate", x: 558, y: 320 },
    { stageId: "stage10", coverType: "crate", x: 671, y: 390 },

    // farm_01
    { stageId: "farm_01", coverType: "camp_tent", x: 1072, y: 269 },
    { stageId: "farm_01", coverType: "camp_tent", x: 791, y: 529 },
    { stageId: "farm_01", coverType: "tree", x: 213, y: 389 },
    { stageId: "farm_01", coverType: "tree", x: 383, y: 594 },
    { stageId: "farm_01", coverType: "tree", x: 420, y: 242 },
    { stageId: "farm_01", coverType: "tree", x: 743, y: 686 },
    { stageId: "farm_01", coverType: "tree", x: 1030, y: 529 },
    { stageId: "farm_01", coverType: "tree", x: 527, y: 414 },
    { stageId: "farm_01", coverType: "tree", x: 786, y: 296 },
    { stageId: "farm_01", coverType: "camp_tent", x: 153, y: 634 },
  ]);

  // ---------- GachaConfig (2 pools — equipment is gacha-only, no direct purchase) ----------
  await seedIfEmpty("GachaConfig", [
    { poolId: "diamond_pool", currency: "diamond", cost: 100, rewardType: "equipment", rarity: "epic", rewardCurrency: "", rewardAmount: "", dropRate: 0.05 },
    { poolId: "diamond_pool", currency: "diamond", cost: 100, rewardType: "equipment", rarity: "rare", rewardCurrency: "", rewardAmount: "", dropRate: 0.20 },
    { poolId: "diamond_pool", currency: "diamond", cost: 100, rewardType: "equipment", rarity: "common", rewardCurrency: "", rewardAmount: "", dropRate: 0.35 },
    { poolId: "diamond_pool", currency: "diamond", cost: 100, rewardType: "currency", rarity: "", rewardCurrency: "coin", rewardAmount: 100, dropRate: 0.40 },

    { poolId: "ticket_pool", currency: "ticket", cost: 100, rewardType: "equipment", rarity: "legendary", rewardCurrency: "", rewardAmount: "", dropRate: 0.05 },
    { poolId: "ticket_pool", currency: "ticket", cost: 100, rewardType: "equipment", rarity: "epic", rewardCurrency: "", rewardAmount: "", dropRate: 0.20 },
    { poolId: "ticket_pool", currency: "ticket", cost: 100, rewardType: "equipment", rarity: "rare", rewardCurrency: "", rewardAmount: "", dropRate: 0.35 },
    { poolId: "ticket_pool", currency: "ticket", cost: 100, rewardType: "currency", rarity: "", rewardCurrency: "diamond", rewardAmount: 100, dropRate: 0.40 },
  ]);

  // ---------- Mission (daily + personal) ----------
  // v10 #2: real reward numbers replacing the old placeholder set. Farm-wave
  // milestones (5, 10, 15, 20, ... forever) are NOT seeded here — generated by
  // formula in src/lib/google/mission.ts's generateFarmWaveMissions() instead.
  // Personal missions never reset; the one daily mission resets via
  // PlayerMissionRow.resetDate.
  await seedIfEmpty("Mission", [
    { id: "kill_100", type: "personal", description: "Eliminate 100 enemies", rewardCoin: 200, rewardExp: 300, rewardDiamond: 20, targetValue: 100, metric: "kills" },
    { id: "kill_1000", type: "personal", description: "Eliminate 1,000 enemies", rewardCoin: 500, rewardExp: 500, rewardDiamond: 20, targetValue: 1000, metric: "kills" },
    { id: "kill_10000", type: "personal", description: "Eliminate 10,000 enemies", rewardCoin: 1000, rewardExp: 1500, rewardDiamond: 50, targetValue: 10000, metric: "kills" },
    { id: "stage_5", type: "personal", description: "Clear stage 5", rewardCoin: 200, rewardExp: 200, rewardDiamond: 20, targetValue: 5, metric: "stage_reached" },
    { id: "stage_10", type: "personal", description: "Clear stage 10", rewardCoin: 300, rewardExp: 400, rewardDiamond: 30, targetValue: 10, metric: "stage_reached" },
    { id: "daily_kill_10", type: "daily", description: "Eliminate 10 enemies", rewardCoin: 50, rewardExp: 100, rewardDiamond: 5, targetValue: 10, metric: "kills" },
  ]);

  await seedIfEmpty("Settings", [
    { key: "maintenanceMode", value: "false" },
    { key: "appVersion", value: "2.0.0" },
  ]);

  // ---------- v4: CurrencyExchangeConfig (Shop tab — direct exchange, not gacha) ----------
  await seedIfEmpty("CurrencyExchangeConfig", [
    { id: "diamond_to_coin_50", fromCurrency: "diamond", fromAmount: 50, toCurrency: "coin", toAmount: 200 },
    { id: "diamond_to_coin_100", fromCurrency: "diamond", fromAmount: 100, toCurrency: "coin", toAmount: 410 },
    { id: "diamond_to_coin_250", fromCurrency: "diamond", fromAmount: 250, toCurrency: "coin", toAmount: 1100 },
    { id: "diamond_to_coin_1000", fromCurrency: "diamond", fromAmount: 1000, toCurrency: "coin", toAmount: 5000 },

    { id: "ticket_to_diamond_50", fromCurrency: "ticket", fromAmount: 50, toCurrency: "diamond", toAmount: 200 },
    { id: "ticket_to_diamond_100", fromCurrency: "ticket", fromAmount: 100, toCurrency: "diamond", toAmount: 410 },
    { id: "ticket_to_diamond_250", fromCurrency: "ticket", fromAmount: 250, toCurrency: "diamond", toAmount: 1100 },
    { id: "ticket_to_diamond_1000", fromCurrency: "ticket", fromAmount: 1000, toCurrency: "diamond", toAmount: 5000 },
  ]);

  // ---------- v4: TicketTopUp (Income tab — real money in) ----------
  await seedIfEmpty("TicketTopUp", [
    { id: "topup_49", priceBaht: 49, ticketAmount: 50 },
    { id: "topup_99", priceBaht: 99, ticketAmount: 110 },
    { id: "topup_199", priceBaht: 199, ticketAmount: 235 },
    { id: "topup_499", priceBaht: 499, ticketAmount: 600 },
    { id: "topup_999", priceBaht: 999, ticketAmount: 1250 },
    { id: "topup_3999", priceBaht: 3999, ticketAmount: 5500 },
  ]);

  // ---------- v4: BossStage (bonus map every 10 story stages) ----------
  // v17: boss re-armed with Double Pistol (was Rocket Launcher's instant-kill
  // hack) and buffed to 4000 base HP — see startBossStage() in
  // src/app/api/game/start/route.ts. rocketCount is vestigial now (no longer
  // read anywhere) but left in the sheet schema to avoid churn.
  await seedIfEmpty("BossStage", [
    { bossId: "boss_01", hp: 4000, weaponId: "double_pistol", rocketCount: 5, growthPercent: 10, occursEveryNStages: 10 },
  ]);

  // ---------- v9 #2: VipConfig (incremental exp per level, NOT cumulative — see src/lib/google/vip.ts) ----------
  await seedIfEmpty("VipConfig", [
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

  console.log("\nDone! Your Google Sheet is ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
