import { getConfigRows } from "../db/configCache";

const SHEET = "Characters";

export type UnlockType = "FREE" | "STAGE" | "PURCHASE" | "DIAMOND" | "TICKET" | "SPECIAL";

export interface CharacterRow {
  id: string;
  name: string;
  rank: string;
  unlockType: UnlockType;
  unlockValue: number;
  /** Only meaningful for unlockType SPECIAL (currently just Azzure) — extra AND-ed gates on top of unlockValue. */
  vipRequirement: number;
  waveRequirement: number;
  /** v44: single source of truth for base HP — see src/lib/stats.ts's
   *  computeFullStats(), the only place this feeds into the real HP a run
   *  starts with. There used to be a second "hpCurrent" column that the UI
   *  displayed (e.g. "100/200") but gameplay never actually read — the
   *  Characters sheet's hpMax was a flat, undifferentiated 200 for every
   *  character while hpCurrent held the real per-character intended value,
   *  so displayed and in-game HP silently disagreed. hpMax now holds that
   *  correct value directly (see scripts/migrate-fix-character-hp.ts) and is
   *  the only HP field left. */
  hpMax: number;
  /** Raw stat on a "/10" scale, converted to px/s via PLAYER_CONFIG.speedMultiplier. */
  speed: number;
  accuracy: number;
  regenPer5s: number;
  armorPercent: number;
  critChance: number;
  critDamage: number;
  sprite: string;
}

function rowToCharacter(row: Record<string, string>): CharacterRow {
  return {
    id: row.id,
    name: row.name,
    rank: row.rank || "",
    unlockType: (row.unlockType || "FREE") as UnlockType,
    unlockValue: Number(row.unlockValue || 0),
    vipRequirement: Number(row.vipRequirement || 0),
    waveRequirement: Number(row.waveRequirement || 0),
    hpMax: Number(row.hpMax || 100),
    speed: Number(row.speed || 5),
    accuracy: Number(row.accuracy || 0),
    regenPer5s: Number(row.regenPer5s || 1),
    armorPercent: Number(row.armorPercent || 0),
    critChance: Number(row.critChance || 0),
    critDamage: Number(row.critDamage || 0),
    sprite: row.sprite || "",
  };
}

export async function getAllCharacters(options?: { force?: boolean }): Promise<CharacterRow[]> {
  const rows = await getConfigRows(SHEET, options);
  return rows.map(rowToCharacter);
}

export async function getCharacterById(id: string): Promise<CharacterRow | null> {
  const chars = await getAllCharacters();
  return chars.find((c) => c.id === id) ?? null;
}

/** Checks unlock conditions that don't require an explicit purchase/ownership row. */
export function isFreelyUnlocked(char: CharacterRow, currentStage: number): boolean {
  if (char.unlockType === "FREE") return true;
  if (char.unlockType === "STAGE") return currentStage >= char.unlockValue;
  return false;
}

/** SPECIAL unlock (Azzure): ticket cost + VIP level + farm wave, all required. */
export function meetsSpecialRequirements(char: CharacterRow, vipLevel: number, farmStageMaxWave: number): boolean {
  if (char.unlockType !== "SPECIAL") return true;
  return vipLevel >= char.vipRequirement && farmStageMaxWave > char.waveRequirement;
}
