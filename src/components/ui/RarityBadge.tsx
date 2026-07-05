import type { Rarity } from "@/types/character";

export default function RarityBadge({ rarity }: { rarity: Rarity }) {
  const labels: Record<Rarity, string> = {
    common: "COMMON",
    rare: "RARE",
    epic: "EPIC",
    legendary: "LEGENDARY",
    mythic: "MYTHIC",
  };

  return (
    <span className={`text-xs px-2 py-0.5 border rarity-${rarity} bg-rarity-${rarity}`}>
      {labels[rarity]}
    </span>
  );
}
