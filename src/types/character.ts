export type UnlockType = "FREE" | "STAGE" | "PURCHASE" | "DIAMOND" | "EVENT";
export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface CharacterData {
  id: string;
  name: string;
  unlockType: UnlockType;
  unlockValue: number;
  damage: number;
  hp: number;
  ammo: number;
  fireRate: number;
  accuracy: number;
  moveSpeed: number;
  sprite: string;
  priceCoin: number;
  priceDiamond: number;
  description: string;
  reloadSpeed: number;
  criticalChance: number;
  criticalDamage: number;
  armor: number;
  magazineSize: number;
  bulletSprite: string;
}
