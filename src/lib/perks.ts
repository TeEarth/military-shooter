/**
 * Perk catalog — 4 fixed one-time purchases (ticket currency), not
 * sheet-driven like passive upgrades since the set is small and fixed.
 * Ownership lives on the players row (see db/player.ts's perk* fields);
 * gameplay behavior lives in Player.ts (see the matching perk* fields/
 * methods there) and is surfaced to the HUD via GameScene.ts/HUDScene.ts.
 */
export type PerkId = "spare_weapon" | "regen" | "super_shield" | "one_shot" | "invisible" | "never_died";

export interface PerkDef {
  id: PerkId;
  name: string;
  icon: string;
  cost: number;
  description: string;
}

export const PERKS: Record<PerkId, PerkDef> = {
  spare_weapon: {
    id: "spare_weapon",
    name: "Spare Weapon",
    icon: "🔫",
    cost: 1499,
    description: "Adds a second weapon slot in Inventory — equip any weapon you own that isn't your main one. In a stage, a SWAP button appears above Reload to switch between them mid-fight (5s cooldown per swap).",
  },
  regen: {
    id: "regen",
    name: "Regeneration",
    icon: "💚",
    cost: 499,
    description: "Automatic: the instant your HP drops below 20%, it's refilled to full. 30s cooldown before it can trigger again — a status icon below the ammo Refill button shows when it's ready.",
  },
  super_shield: {
    id: "super_shield",
    name: "Super Shield",
    icon: "🛡️",
    cost: 699,
    description: "Automatic: if your shield stays fully depleted for 15 straight seconds, it's refilled to 50% of max. 60s cooldown before it can trigger again — a status icon below the ammo Refill button shows when it's ready.",
  },
  one_shot: {
    id: "one_shot",
    name: "One Shot",
    icon: "💀",
    cost: 999,
    description: "A skull button (above Swap, or above Reload if you don't own Spare Weapon) that arms your next shot: 3000 flat damage with any weapon. Rocket/Grenade Launcher instead spread it wide at 1000 damage. 30s cooldown per press.",
  },
  invisible: {
    id: "invisible",
    name: "Invisible",
    icon: "👻",
    cost: 2499,
    description: "Automatic: loops from the start of the match to the end — every 7s you turn invisible to enemies for 3 seconds, and unlike tree stealth you can keep moving and shooting the whole time.",
  },
  never_died: {
    id: "never_died",
    name: "Never Died",
    icon: "❤️‍🩹",
    cost: 2499,
    description: "Automatic: the first time your HP would hit 0, it's locked at 1 instead and you become invincible for 3 seconds to retreat or regroup. Only once per match.",
  },
};

export const PERK_ORDER: PerkId[] = ["spare_weapon", "regen", "super_shield", "one_shot", "invisible", "never_died"];
