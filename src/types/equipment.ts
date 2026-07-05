import type { Rarity } from "./character";

export type EquipmentType = "helmet" | "armor" | "glove" | "boot" | "backpack" | "accessory";

export interface EquipmentData {
  id: string;
  type: EquipmentType;
  rarity: Rarity;
  damage: number;
  hp: number;
  armor: number;
  speed: number;
  critical: number;
  accuracy: number;
  priceCoin: number;
  priceDiamond: number;
  sprite: string;
}
