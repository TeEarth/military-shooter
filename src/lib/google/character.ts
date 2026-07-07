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
  hpCurrent: number;
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
    hpCurrent: Number(row.hpCurrent || 100),
    hpMax: Number(row.hpMax || 200),
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
