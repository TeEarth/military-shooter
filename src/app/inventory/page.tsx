import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlayerById } from "@/lib/db/player";
import { getCharacterById } from "@/lib/google/character";
import { getAllWeapons } from "@/lib/google/weapon";
import { getAllEquipment, getPlayerEquipment, getPlayerWeapons, getAllEquipmentUpgradeLevels } from "@/lib/db/inventory";
import { getPlayerIncome } from "@/lib/db/income";
import InventoryClient from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [character, allWeapons, allEquipment, playerWeapons, playerEquipment, upgradeLevels, income] = await Promise.all([
    getCharacterById(player.currentCharacter),
    getAllWeapons(),
    getAllEquipment(),
    getPlayerWeapons(player.id),
    getPlayerEquipment(player.id),
    getAllEquipmentUpgradeLevels(player.id),
    getPlayerIncome(player.id),
  ]);

  const ownedWeapons = playerWeapons
    .filter((w) => w.owned)
    .map((w) => allWeapons.find((wp) => wp.id === w.weaponId))
    .filter((w) => w !== undefined);

  const ownedEquipment = playerEquipment
    .map((e) => {
      const item = allEquipment.find((c) => c.id === e.equipmentId);
      return item ? { ...item, equipped: e.equipped, upgradeLevel: upgradeLevels[item.id] ?? 0 } : null;
    })
    .filter((e) => e !== null);

  const equippedWeaponId = playerWeapons.find((w) => w.equipped)?.weaponId ?? null;

  return (
    <InventoryClient
      characterSprite={character?.sprite ?? ""}
      characterName={character?.name ?? ""}
      ownedWeapons={ownedWeapons}
      equippedWeaponId={equippedWeaponId}
      ownedEquipment={ownedEquipment}
      coin={player.coin}
      diamond={player.diamond}
      ticket={player.ticket}
      exp={player.exp}
      greenBanknote={income.greenBanknoteBalance}
    />
  );
}
