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
  Enemies: ["id", "weaponId", "hp", "coinReward", "sprite"],
  PassiveConfig: ["passiveId", "tier", "cost", "currency", "bonusPercent"],
  // playerSpawnX/playerSpawnY appended at the end (v11 #2) — 0 means "not
  // designed yet", GameScene falls back to its old hardcoded default.
  Stage: ["id", "name", "isRepeatable", "width", "height", "background", "rewardCoin", "rewardExp", "playerSpawnX", "playerSpawnY"],
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
  WithdrawalRequest: ["id", "playerId", "amount", "status", "requestedAt"],
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
    { id: "double_pistol", name: "Double Pistol", unlockType: "STAGE", unlockValue: 10, priceCoin: 0, priceDiamond: 0, priceTicket: 0, damage: 20, fireRate: 2, fireMode: "single", projectileCount: 1, accuracy: 50, magazineSize: 16, reloadTime: 5, critChance: 8, critDamage: 300, dailyAmmo: 80, spreadDegrees: 4, sprite: roundBullet },
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
    { id: "enemy_pistol", weaponId: "pistol", hp: 100, coinReward: 1, sprite: "/assets/sprites/enemy/enemy_pistol.svg" },
    { id: "enemy_ak47", weaponId: "ak47", hp: 150, coinReward: 2, sprite: "/assets/sprites/enemy/enemy_ak47.svg" },
    { id: "enemy_sniper", weaponId: "sniper", hp: 180, coinReward: 3, sprite: "/assets/sprites/enemy/enemy_sniper.svg" },
    { id: "enemy_shotgun", weaponId: "shotgun", hp: 300, coinReward: 5, sprite: "/assets/sprites/enemy/enemy_shotgun.svg" },
    { id: "enemy_rocket", weaponId: "rocket_launcher", hp: 250, coinReward: 5, sprite: "/assets/sprites/enemy/enemy_rocket.svg" },
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

  // ---------- Stage (10 story + 1 farm) — v8 #5: stage06-10 are placeholders that
  // reuse stage01-05's enemy-spawn patterns (the user will design real maps for
  // these later, per v2 #8) — needed now so story progression + the "every 10
  // stages" boss gate (v4) actually has 10 stages to advance through. ----------
  await seedIfEmpty("Stage", [
    { id: "stage01", name: "Boot Camp", isRepeatable: false, width: 1280, height: 720, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 100, rewardExp: 150 },
    { id: "stage02", name: "Urban Assault", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 150, rewardExp: 200 },
    { id: "stage03", name: "Jungle Patrol", isRepeatable: false, width: 1440, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 200, rewardExp: 280 },
    { id: "stage04", name: "Desert Storm", isRepeatable: false, width: 1600, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 250, rewardExp: 350 },
    { id: "stage05", name: "Commander Showdown", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 500, rewardExp: 700 },
    { id: "stage06", name: "Coastal Defense (placeholder)", isRepeatable: false, width: 1280, height: 720, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 550, rewardExp: 750 },
    { id: "stage07", name: "Mountain Pass (placeholder)", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 600, rewardExp: 800 },
    { id: "stage08", name: "Night Raid (placeholder)", isRepeatable: false, width: 1440, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 650, rewardExp: 850 },
    { id: "stage09", name: "Fortress Siege (placeholder)", isRepeatable: false, width: 1600, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 700, rewardExp: 900 },
    { id: "stage10", name: "Final Stand (placeholder)", isRepeatable: false, width: 1440, height: 810, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 1000, rewardExp: 1400 },
    { id: "farm_01", name: "Training Grounds", isRepeatable: true, width: 1280, height: 900, background: "/assets/sprites/background/battlefield_ground.svg", rewardCoin: 80, rewardExp: 60 },
  ]);

  // ---------- StageEnemy (story stages only — farm generates waves procedurally) ----------
  await seedIfEmpty("StageEnemy", [
    { stageId: "stage01", enemyId: "enemy_pistol", spawnX: 500, spawnY: 300 },
    { stageId: "stage01", enemyId: "enemy_pistol", spawnX: 900, spawnY: 500 },
    { stageId: "stage01", enemyId: "enemy_pistol", spawnX: 1100, spawnY: 300 },

    { stageId: "stage02", enemyId: "enemy_pistol", spawnX: 500, spawnY: 300 },
    { stageId: "stage02", enemyId: "enemy_ak47", spawnX: 900, spawnY: 500 },
    { stageId: "stage02", enemyId: "enemy_pistol", spawnX: 1200, spawnY: 400 },
    { stageId: "stage02", enemyId: "enemy_sniper", spawnX: 1350, spawnY: 200 },

    { stageId: "stage03", enemyId: "enemy_ak47", spawnX: 500, spawnY: 400 },
    { stageId: "stage03", enemyId: "enemy_shotgun", spawnX: 900, spawnY: 600 },
    { stageId: "stage03", enemyId: "enemy_sniper", spawnX: 1200, spawnY: 300 },
    { stageId: "stage03", enemyId: "enemy_pistol", spawnX: 1350, spawnY: 700 },

    { stageId: "stage04", enemyId: "enemy_ak47", spawnX: 500, spawnY: 400 },
    { stageId: "stage04", enemyId: "enemy_shotgun", spawnX: 900, spawnY: 600 },
    { stageId: "stage04", enemyId: "enemy_rocket", spawnX: 1300, spawnY: 400 },
    { stageId: "stage04", enemyId: "enemy_sniper", spawnX: 1500, spawnY: 250 },

    { stageId: "stage05", enemyId: "enemy_ak47", spawnX: 500, spawnY: 400 },
    { stageId: "stage05", enemyId: "enemy_shotgun", spawnX: 800, spawnY: 600 },
    { stageId: "stage05", enemyId: "enemy_sniper", spawnX: 1100, spawnY: 250 },
    { stageId: "stage05", enemyId: "enemy_rocket", spawnX: 1350, spawnY: 500 },

    // v8 #5 placeholders — same spawn pattern as stage01-05 (same dimensions each)
    { stageId: "stage06", enemyId: "enemy_pistol", spawnX: 500, spawnY: 300 },
    { stageId: "stage06", enemyId: "enemy_pistol", spawnX: 900, spawnY: 500 },
    { stageId: "stage06", enemyId: "enemy_pistol", spawnX: 1100, spawnY: 300 },

    { stageId: "stage07", enemyId: "enemy_pistol", spawnX: 500, spawnY: 300 },
    { stageId: "stage07", enemyId: "enemy_ak47", spawnX: 900, spawnY: 500 },
    { stageId: "stage07", enemyId: "enemy_pistol", spawnX: 1200, spawnY: 400 },
    { stageId: "stage07", enemyId: "enemy_sniper", spawnX: 1350, spawnY: 200 },

    { stageId: "stage08", enemyId: "enemy_ak47", spawnX: 500, spawnY: 400 },
    { stageId: "stage08", enemyId: "enemy_shotgun", spawnX: 900, spawnY: 600 },
    { stageId: "stage08", enemyId: "enemy_sniper", spawnX: 1200, spawnY: 300 },
    { stageId: "stage08", enemyId: "enemy_pistol", spawnX: 1350, spawnY: 700 },

    { stageId: "stage09", enemyId: "enemy_ak47", spawnX: 500, spawnY: 400 },
    { stageId: "stage09", enemyId: "enemy_shotgun", spawnX: 900, spawnY: 600 },
    { stageId: "stage09", enemyId: "enemy_rocket", spawnX: 1300, spawnY: 400 },
    { stageId: "stage09", enemyId: "enemy_sniper", spawnX: 1500, spawnY: 250 },

    { stageId: "stage10", enemyId: "enemy_ak47", spawnX: 500, spawnY: 400 },
    { stageId: "stage10", enemyId: "enemy_shotgun", spawnX: 800, spawnY: 600 },
    { stageId: "stage10", enemyId: "enemy_sniper", spawnX: 1100, spawnY: 250 },
    { stageId: "stage10", enemyId: "enemy_rocket", spawnX: 1350, spawnY: 500 },
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
  await seedIfEmpty("BossStage", [
    { bossId: "boss_01", hp: 2000, weaponId: "rocket_launcher", rocketCount: 5, growthPercent: 10, occursEveryNStages: 10 },
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
