import { getConfigRows } from "../db/configCache";

const BOSS_STAGE_SHEET = "BossStage";
const DEFAULT_BACKGROUND = "/assets/sprites/background/rock_terrain.svg";

// v16: this file used to also contain PlayerBossProgress read/write functions
// backed directly by Google Sheets — those were fully superseded by the
// Supabase-backed versions in src/lib/db/bossStage.ts during the v12
// migration and had been dead code (zero imports) ever since. Removed as
// part of the v16 cleanup; this file now only holds the BossStage config
// catalog, still legitimately read from Sheets/the config cache.
//
// v24: one row per Multiverse's boss (was a single global row scaled by a
// compounding growthPercent formula for every encounter) — each multiverse's
// boss can now have its own explicit hp/minion/damage/background instead of
// everything being a multiplier off Multiverse 1's numbers. Encounter number
// N fights Multiverse N's boss (clearing it is what unlocks Multiverse N+1),
// so "multiverse" and "encounterNumber" are the same number throughout this
// file. Any encounter beyond the highest configured row falls back to that
// row's stats scaled by ITS growthPercent, so future multiverses don't
// silently break before they get their own real row.
export interface BossStageRow {
  multiverse: number;
  hp: number;
  weaponId: string;
  /** Enemy id (from the Enemies sheet) the boss periodically summons as reinforcement. */
  minionEnemyId: string;
  /** Multiplies the boss's own weapon damage — separate from hp, since a boss
   *  can be "more dangerous" without simply having more hp. */
  damageMultiplier: number;
  background: string;
  /** Used only as a fallback multiplier for encounters past the highest
   *  configured multiverse row (see getBossConfigForEncounter below). */
  growthPercent: number;
  /** How many total story stages (across every multiverse) must be cleared
   *  before this multiverse's boss unlocks — only multiverse=1's value is
   *  actually used (see getBossPacing); pacing is a single global constant,
   *  not per-boss, but lives on each row for the same simple sheet shape. */
  occursEveryNStages: number;
}

function rowToBossStage(row: Record<string, string>): BossStageRow {
  return {
    multiverse: Number(row.multiverse || 1),
    hp: Number(row.hp || 2000),
    weaponId: row.weaponId || "double_pistol",
    minionEnemyId: row.minionEnemyId || "enemy_pistol",
    damageMultiplier: Number(row.damageMultiplier) || 1,
    background: row.background || DEFAULT_BACKGROUND,
    growthPercent: Number(row.growthPercent || 10),
    occursEveryNStages: Number(row.occursEveryNStages || 10),
  };
}

export async function getAllBossStageConfigs(): Promise<BossStageRow[]> {
  const rows = await getConfigRows(BOSS_STAGE_SHEET);
  if (rows.length === 0) throw new Error("BossStage config not seeded");
  return rows.map(rowToBossStage).sort((a, b) => a.multiverse - b.multiverse);
}

/** Global pacing constant (stages-cleared-per-boss-unlock) — always read from
 *  the multiverse=1 row regardless of which encounter is being checked. */
export async function getBossPacing(): Promise<number> {
  const configs = await getAllBossStageConfigs();
  return (configs.find((c) => c.multiverse === 1) ?? configs[0]).occursEveryNStages;
}

/** Resolves the exact stats for a given boss encounter number. Encounter N
 *  fights Multiverse N's boss — an exact-match row is used as-is (its hp/
 *  damageMultiplier are absolute, NOT compounded further); an encounter
 *  beyond every configured row reuses the highest configured row, compounded
 *  by ITS growthPercent for each encounter past it. */
export async function getBossConfigForEncounter(encounterNumber: number): Promise<BossStageRow> {
  const configs = await getAllBossStageConfigs();
  const exact = configs.find((c) => c.multiverse === encounterNumber);
  if (exact) return exact;

  const highest = configs[configs.length - 1];
  const extraEncounters = encounterNumber - highest.multiverse;
  const scale = Math.pow(1 + highest.growthPercent / 100, extraEncounters);
  return {
    ...highest,
    hp: Math.round(highest.hp * scale),
    damageMultiplier: highest.damageMultiplier * scale,
  };
}
