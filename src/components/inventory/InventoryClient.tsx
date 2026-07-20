"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, useDraggable, useDroppable, useSensor, useSensors,
  PointerSensor, TouchSensor, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import type { WeaponRow } from "@/lib/google/weapon";
import type { EquipmentRow, EquipmentSlot, Rarity } from "@/lib/google/inventory";
import type { FullStatBreakdown } from "@/lib/stats";
import { sfx } from "@/lib/sfx";
import { useT } from "@/lib/i18n";
import { getEquipmentSprite, getWeaponSprite } from "@/lib/spriteHelpers";
import { DUPE_UPGRADE_BONUS } from "../../../config/equipment";
import CurrencyBar from "@/components/ui/CurrencyBar";

interface OwnedEquipment extends EquipmentRow {
  equipped: boolean;
  upgradeLevel: number;
}

interface Props {
  characterSprite: string;
  characterName: string;
  ownedWeapons: WeaponRow[];
  equippedWeaponId: string | null;
  ownedEquipment: OwnedEquipment[];
  coin: number;
  diamond: number;
  ticket: number;
  exp: number;
  greenBanknote: number;
  hasSpareWeaponPerk: boolean;
  spareWeaponId: string;
}

type DropTarget = "weapon" | "spareWeapon" | EquipmentSlot;
type DragKind = "weapon" | "equipment";
interface DragPayload {
  kind: DragKind;
  id: string;
  slot?: EquipmentSlot;
  name: string;
}

const SLOT_LABEL: Record<EquipmentSlot, string> = { helmet: "Helmet", vest: "Vest", boots: "Boots" };
const SLOT_ICON: Record<EquipmentSlot, string> = { helmet: "⛑️", vest: "🦺", boots: "🥾" };
const RARITY_BORDER: Record<Rarity, string> = {
  common: "border-gray-400",
  rare: "border-blue-400",
  epic: "border-purple-400",
  legendary: "border-military-gold",
};
const RARITY_RANK: Record<Rarity, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };
const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-gray-300",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-military-gold",
};

const STAT_ROWS: { key: Exclude<keyof FullStatBreakdown, "shieldMax">; label: { en: string; th: string }; suffix?: string; decimals?: number }[] = [
  { key: "hp", label: { en: "HP", th: "พลังชีวิต (HP)" } },
  { key: "damage", label: { en: "Damage (ATK)", th: "พลังโจมตี (ATK)" }, decimals: 1 },
  { key: "moveSpeed", label: { en: "Move Speed", th: "ความเร็ว" } },
  { key: "accuracy", label: { en: "Accuracy", th: "ความแม่นยำ" }, suffix: "%" },
  { key: "armorPercent", label: { en: "Armor", th: "เกราะ" }, suffix: "%" },
  { key: "critChance", label: { en: "Crit Chance", th: "อัตราคริติคอล" }, suffix: "%" },
  { key: "critDamage", label: { en: "Crit Damage", th: "ดาเมจคริติคอล" }, suffix: "%" },
  { key: "reloadTime", label: { en: "Reload Time", th: "เวลารีโหลด" }, suffix: "s", decimals: 2 },
  { key: "fireRate", label: { en: "Fire Rate", th: "อัตรายิง" }, suffix: "/s", decimals: 2 },
  { key: "dailyAmmo", label: { en: "Daily Ammo", th: "กระสุนรายวัน" } },
];

/** upgradeLevel stars — rendered as repeated star_upgrade.svg icons, or "★ x N" past 5 to avoid a long row. */
function UpgradeStars({ level }: { level: number }) {
  if (level <= 0) return null;
  if (level > 5) {
    return (
      <span className="absolute -bottom-1 -right-1 bg-military-darker border border-military-gold rounded px-1 text-[10px] text-military-gold font-bold flex items-center gap-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/sprites/ui/star_upgrade.svg" alt="" className="w-2.5 h-2.5" /> x{level}
      </span>
    );
  }
  return (
    <span className="absolute -bottom-1 left-0 right-0 flex justify-center gap-0.5">
      {Array.from({ length: level }).map((_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src="/assets/sprites/ui/star_upgrade.svg" alt="" className="w-2.5 h-2.5" />
      ))}
    </span>
  );
}

/** v13: base rarity bonus and cumulative dupe-upgrade bonus kept SEPARATE
 *  (not pre-merged) so the UI can show "base +5% (+3% from ★3 upgrades) = +8%"
 *  instead of only the opaque merged total. */
function equipmentBonus(item: EquipmentRow, upgradeLevel: number) {
  const dupe = DUPE_UPGRADE_BONUS[item.rarity];
  const upgrade = {
    hpPercent: upgradeLevel * dupe.hpPercent,
    damagePercent: upgradeLevel * dupe.damagePercent,
    critChancePercent: upgradeLevel * dupe.critChancePercent,
    critDamagePercent: upgradeLevel * dupe.critDamagePercent,
  };
  return {
    base: { hpPercent: item.hpPercent, damagePercent: item.damagePercent, critChancePercent: item.critChancePercent, critDamagePercent: item.critDamagePercent },
    upgrade,
    hpPercent: item.hpPercent + upgrade.hpPercent,
    damagePercent: item.damagePercent + upgrade.damagePercent,
    critChancePercent: item.critChancePercent + upgrade.critChancePercent,
    critDamagePercent: item.critDamagePercent + upgrade.critDamagePercent,
    shieldValue: item.shieldValue,
  };
}

/** A draggable card in the bottom inventory grid — click (no drag) opens the detail popup. */
function DraggableItem({ dragId, payload, sprite, equipped, upgradeLevel, rarity, onOpen }: {
  dragId: string; payload: DragPayload; sprite: string; equipped: boolean; upgradeLevel?: number; rarity?: Rarity; onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId, data: payload });
  const borderClass = rarity ? RARITY_BORDER[rarity] : equipped ? "border-military-tan" : "border-military-steel";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={`relative card-military text-center cursor-grab active:cursor-grabbing touch-none p-2 border-2 ${borderClass} ${isDragging ? "opacity-30" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sprite} alt={payload.name} className="w-10 h-10 mx-auto object-contain" />
      <p className="text-xs mt-1 truncate">{payload.name}</p>
      {equipped && <span className="absolute top-0.5 right-0.5 text-[9px] text-military-gold">✓</span>}
      {upgradeLevel !== undefined && <UpgradeStars level={upgradeLevel} />}
    </div>
  );
}

/** One of the 4 corner equip slots (or the standalone Spare Weapon slot,
 *  passing position="" to skip absolute positioning) — also a droppable target. */
function CornerSlot({ position, target, icon, label, itemSprite, itemName, onClick }: {
  position: string; target: DropTarget; icon: string; label: string; itemSprite?: string; itemName?: string; onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: target, data: { target } });
  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`${position ? `absolute ${position}` : ""} w-24 h-24 border-2 flex flex-col items-center justify-center bg-military-dark transition-colors px-1 ${
        isOver ? "border-military-gold bg-military-olive/30" : itemName ? "border-military-tan" : "border-military-steel border-dashed"
      } hover:border-military-tan`}
    >
      {itemSprite ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={itemSprite} alt={itemName} className="w-9 h-9 object-contain" />
      ) : (
        <span className="text-2xl">{icon}</span>
      )}
      <span className="text-xs text-military-steel mt-1">{label}</span>
      <span className="text-xs text-white font-bold text-center truncate w-full">{itemName ?? "(empty)"}</span>
    </button>
  );
}

export default function InventoryClient({ characterSprite, characterName, ownedWeapons, equippedWeaponId: initialEquippedWeaponId, ownedEquipment: initialEquipment, coin, diamond, ticket, exp, greenBanknote, hasSpareWeaponPerk, spareWeaponId: initialSpareWeaponId }: Props) {
  const t = useT();
  const [equippedWeaponId, setEquippedWeaponId] = useState(initialEquippedWeaponId);
  const [spareWeaponId, setSpareWeaponId] = useState(initialSpareWeaponId);
  const [spareLoading, setSpareLoading] = useState(false);
  const [equipment, setEquipment] = useState(initialEquipment);
  const [message, setMessage] = useState("");
  const [openPicker, setOpenPicker] = useState<"weapon" | "spareWeapon" | EquipmentSlot | null>(null);
  const [tab, setTab] = useState<"weapon" | EquipmentSlot>("weapon");
  const [stats, setStats] = useState<FullStatBreakdown | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [detailEquipment, setDetailEquipment] = useState<OwnedEquipment | null>(null);
  const [detailWeapon, setDetailWeapon] = useState<WeaponRow | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  /** v66 fix: this used to be a useEffect keyed on [equippedWeaponId,
   *  equipment] — but that local state updates OPTIMISTICALLY, synchronously,
   *  before the equip/unequip POST's DB write actually commits. React fires
   *  this effect off that local change immediately, so the GET here raced
   *  the POST and could read the DB either just before or just after the
   *  write landed — Total Shield (and every other stat) would flicker
   *  between the old and new value unpredictably, sometimes settling on the
   *  wrong one (read: "unequip everything, shield stays up" / "equip
   *  something, shield drops"). Now called explicitly, awaited AFTER each
   *  mutation's own POST resolves, so it always reads the DB post-write. */
  async function refetchStats() {
    try {
      const res = await fetch("/api/player/stats");
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch {
      // best-effort — the stat panel just won't refresh this time.
    }
  }

  useEffect(() => {
    refetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const equippedByslot: Record<EquipmentSlot, OwnedEquipment | undefined> = {
    helmet: equipment.find((e) => e.slot === "helmet" && e.equipped),
    vest: equipment.find((e) => e.slot === "vest" && e.equipped),
    boots: equipment.find((e) => e.slot === "boots" && e.equipped),
  };
  const equippedWeapon = ownedWeapons.find((w) => w.id === equippedWeaponId);
  // v36: reversed per request (was front-to-back in acquisition order).
  const sortedWeapons = [...ownedWeapons].reverse();
  // v36: highest rarity first, per request.
  const sortedEquipment = [...equipment].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity]);

  async function equipWeapon(weaponId: string) {
    // v9 #3: optimistic — flip the equipped weapon immediately, roll back if the server rejects it.
    const previous = equippedWeaponId;
    setEquippedWeaponId(weaponId);
    sfx.play("pickup_item");
    setOpenPicker(null);
    setDetailWeapon(null);
    try {
      const res = await fetch("/api/weapon/equip", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponId }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error);
      if (!data.success) { setEquippedWeaponId(previous); sfx.play("miss"); }
      else refetchStats();
    } catch {
      setEquippedWeaponId(previous);
      sfx.play("miss");
      setMessage("Network error — equip not completed.");
    }
  }

  async function equipItem(equipmentId: string, slot: EquipmentSlot) {
    const previous = equipment;
    setEquipment((prev) => prev.map((e) => {
      if (e.id === equipmentId) return { ...e, equipped: true };
      if (e.slot === slot && e.id !== equipmentId) return { ...e, equipped: false };
      return e;
    }));

    setOpenPicker(null);
    setDetailEquipment(null);
    try {
      const res = await fetch("/api/equipment/equip", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentId, equipped: true }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error);
      if (data.success) {
        sfx.play("pickup_item");
        refetchStats();
      } else {
        setEquipment(previous);
        sfx.play("miss");
      }
    } catch {
      setEquipment(previous);
      sfx.play("miss");
      setMessage("Network error — equip not completed.");
    }
  }

  /** v65: every equipment slot can be cleared back to empty except the main
   *  weapon (which always has SOME weapon equipped server-side — there's no
   *  "no main weapon" state). The server already fully supported this via
   *  `equipped: false`; only the UI trigger was missing. */
  async function unequipItem(equipmentId: string) {
    const previous = equipment;
    setEquipment((prev) => prev.map((e) => (e.id === equipmentId ? { ...e, equipped: false } : e)));
    setOpenPicker(null);
    setDetailEquipment(null);
    try {
      const res = await fetch("/api/equipment/equip", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentId, equipped: false }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error);
      if (data.success) sfx.play("ui_click");
      else { setEquipment(previous); sfx.play("miss"); }
    } catch {
      setEquipment(previous);
      sfx.play("miss");
      setMessage("Network error — unequip not completed.");
    }
  }

  async function setSpareWeapon(weaponId: string) {
    if (spareLoading) return;
    setSpareLoading(true);
    setOpenPicker(null);
    const previous = spareWeaponId;
    setSpareWeaponId(weaponId);
    try {
      const res = await fetch("/api/perk/spare-weapon", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponId }),
      });
      const data = await res.json();
      if (!data.success) {
        setSpareWeaponId(previous);
        setMessage(data.error);
        sfx.play("miss");
      } else {
        sfx.play("pickup_item");
      }
    } catch {
      setSpareWeaponId(previous);
      setMessage("Network error — spare weapon not set.");
      sfx.play("miss");
    } finally {
      setSpareLoading(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDrag(event.active.data.current as DragPayload);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    const payload = active.data.current as DragPayload;
    const target = over.data.current?.target as DropTarget;

    if (target === "weapon") {
      if (payload.kind === "weapon") {
        equipWeapon(payload.id);
      } else {
        setMessage(`${payload.name} doesn't go in the Weapon slot.`);
        sfx.play("miss");
      }
      return;
    }

    if (target === "spareWeapon") {
      if (payload.kind === "weapon") {
        if (payload.id === equippedWeaponId) {
          setMessage(`${payload.name} is already your main weapon.`);
          sfx.play("miss");
        } else {
          setSpareWeapon(payload.id);
        }
      } else {
        setMessage(`${payload.name} doesn't go in the Spare Weapon slot.`);
        sfx.play("miss");
      }
      return;
    }

    if (payload.kind === "equipment" && payload.slot === target) {
      equipItem(payload.id, target);
    } else {
      setMessage(`${payload.name} doesn't go in the ${SLOT_LABEL[target]} slot.`);
      sfx.play("miss");
    }
  }

  const activeDragSprite = activeDrag
    ? (activeDrag.kind === "weapon" ? getWeaponSprite(activeDrag.id) : getEquipmentSprite(activeDrag.id))
    : "";

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen page-bg-themed p-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
          <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Equipment</h1>
          <div className="ml-auto">
            <CurrencyBar coin={coin} diamond={diamond} ticket={ticket} greenBanknote={greenBanknote} />
          </div>
        </div>

        {message && <div className="text-center mb-2 text-military-gold text-sm">{message}</div>}

        {/* Character + 4 corner slots + item picker, all stacked in ONE left
         *  column (stat panel is a separate, independently-sized right column)
         *  so the item grid sits directly under the slots instead of being
         *  pushed down by however tall the stat panel happens to be. */}
        <div className="flex flex-col lg:flex-row gap-8 max-w-5xl mx-auto items-start">
          <div className="flex-1 w-full min-w-0">
            <div className={hasSpareWeaponPerk ? "flex items-center justify-center gap-4" : ""}>
            <div className="relative mx-auto" style={{ width: 300, minHeight: 300 }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full bg-military-dark border-2 border-military-tan flex items-center justify-center overflow-hidden">
                  {characterSprite ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={characterSprite} alt={characterName} className="w-20 h-20 object-contain" />
                  ) : (
                    <span className="text-4xl">🪖</span>
                  )}
                </div>
              </div>

              <CornerSlot position="top-0 left-0" target="weapon" icon="🔫" label="Weapon" itemSprite={equippedWeapon ? getWeaponSprite(equippedWeapon.id) : undefined} itemName={equippedWeapon?.name} onClick={() => setOpenPicker("weapon")} />
              <CornerSlot position="top-0 right-0" target="helmet" icon={SLOT_ICON.helmet} label={SLOT_LABEL.helmet} itemSprite={equippedByslot.helmet ? getEquipmentSprite(equippedByslot.helmet.id) : undefined} itemName={equippedByslot.helmet?.name} onClick={() => setOpenPicker("helmet")} />
              <CornerSlot position="bottom-0 left-0" target="vest" icon={SLOT_ICON.vest} label={SLOT_LABEL.vest} itemSprite={equippedByslot.vest ? getEquipmentSprite(equippedByslot.vest.id) : undefined} itemName={equippedByslot.vest?.name} onClick={() => setOpenPicker("vest")} />
              <CornerSlot position="bottom-0 right-0" target="boots" icon={SLOT_ICON.boots} label={SLOT_LABEL.boots} itemSprite={equippedByslot.boots ? getEquipmentSprite(equippedByslot.boots.id) : undefined} itemName={equippedByslot.boots?.name} onClick={() => setOpenPicker("boots")} />
            </div>

            {/* v36: Spare Weapon perk — a real drag-drop slot next to the
             *  character diagram (was a plain dropdown), same visual language
             *  as the 4 corner slots. position="" skips their absolute
             *  positioning since this one just needs to sit beside, not
             *  overlay, the diagram. */}
            {hasSpareWeaponPerk && (
              <CornerSlot
                position=""
                target="spareWeapon"
                icon="🔫"
                label="Spare"
                itemSprite={spareWeaponId ? getWeaponSprite(spareWeaponId) : undefined}
                itemName={ownedWeapons.find((w) => w.id === spareWeaponId)?.name}
                onClick={() => setOpenPicker("spareWeapon")}
              />
            )}
            </div>

            {/* Categorized inventory tabs — weapon / helmet / vest / boots, not one mixed grid.
             *  Directly below the equip slots now (was a separate full-width block after
             *  BOTH columns, so it sat as low as the taller stat-panel column made it). */}
            <div className="mt-4">
              <div className="flex gap-2 mb-3">
                {(["weapon", "helmet", "vest", "boots"] as const).map((tabKey) => (
                  <button key={tabKey} onClick={() => setTab(tabKey)} className={`btn-military text-xs ${tab === tabKey ? "" : "opacity-50"}`}>
                    {tabKey === "weapon"
                      ? t({ en: "Weapon", th: "อาวุธ" })
                      : tabKey === "helmet"
                        ? t({ en: "Helmet", th: "หมวก" })
                        : tabKey === "vest"
                          ? t({ en: "Vest", th: "เกราะ" })
                          : t({ en: "Boots", th: "รองเท้า" })}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {tab === "weapon" && sortedWeapons.map((w) => (
                  <DraggableItem
                    key={`w-${w.id}`}
                    dragId={`w-${w.id}`}
                    payload={{ kind: "weapon", id: w.id, name: w.name }}
                    sprite={getWeaponSprite(w.id)}
                    equipped={w.id === equippedWeaponId}
                    onOpen={() => setDetailWeapon(w)}
                  />
                ))}
                {tab !== "weapon" && sortedEquipment.filter((e) => e.slot === tab).map((e) => (
                  <DraggableItem
                    key={`e-${e.id}`}
                    dragId={`e-${e.id}`}
                    payload={{ kind: "equipment", id: e.id, slot: e.slot, name: e.name }}
                    sprite={getEquipmentSprite(e.id)}
                    equipped={e.equipped}
                    upgradeLevel={e.upgradeLevel}
                    rarity={e.rarity}
                    onOpen={() => setDetailEquipment(e)}
                  />
                ))}
                {tab === "weapon" && ownedWeapons.length === 0 && (
                  <p className="text-military-steel text-sm col-span-full text-center py-8">No weapons owned yet — visit Character/Weapon.</p>
                )}
                {tab !== "weapon" && equipment.filter((e) => e.slot === tab).length === 0 && (
                  <p className="text-military-steel text-sm col-span-full text-center py-8">No {SLOT_LABEL[tab]} owned yet — pull the Gacha.</p>
                )}
              </div>
            </div>
          </div>

          {/* Stat panel — its own column, sized independently of the left column */}
          <div className="w-full lg:w-96 flex-shrink-0 space-y-4">
            {stats && (
              <div className="card-military">
                <h2 className="text-military-tan text-sm uppercase tracking-wider mb-2">{t({ en: "Total Stats", th: "สรุปค่าสถานะรวม" })}</h2>
                <div className="space-y-1.5">
                  {STAT_ROWS.map(({ key, label, suffix = "", decimals = 0 }) => {
                    const line = stats[key];
                    const round = (n: number) => (decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString());
                    return (
                      <div key={key} className="flex justify-between items-baseline text-sm">
                        <span className="text-military-steel">{t(label)}</span>
                        <span className="text-white text-right">
                          {round(line.base)}{suffix}
                          {/* v13: equipment/passive bonuses shown as separate tags instead of one merged %, per request */}
                          {line.equipmentBonusPercent !== 0 && (
                            <span className="text-blue-400"> ({t({ en: "equipment", th: "อุปกรณ์" })} {line.equipmentBonusPercent >= 0 ? "+" : ""}{line.equipmentBonusPercent.toFixed(1)}%)</span>
                          )}
                          {line.passiveBonusPercent !== 0 && (
                            <span className="text-purple-400"> (passive {line.passiveBonusPercent >= 0 ? "+" : ""}{line.passiveBonusPercent.toFixed(1)}%)</span>
                          )}
                          {/* v61: the equipped skin's own +10% stat bonus (e.g. Desert +HP,
                           *  Urban +Damage) shown as its own tag, same treatment as equipment/passive. */}
                          {line.skinBonusPercent !== 0 && (
                            <span className="text-military-gold"> ({t({ en: "skin", th: "สกิน" })} {line.skinBonusPercent >= 0 ? "+" : ""}{line.skinBonusPercent.toFixed(1)}%)</span>
                          )}
                          {" = "}<span className="font-bold">{round(line.final)}{suffix}</span>
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-baseline text-sm pt-1 border-t border-military-steel mt-2">
                    <span className="text-military-steel">{t({ en: "Total Shield", th: "โล่รวม (Shield)" })}</span>
                    <span className="text-white text-right">
                      {Math.round(stats.shieldMax.base)}
                      {/* v61: Armor% (character + equipped skin, e.g. Elite) now boosts
                       *  Total Shield directly instead of reducing incoming damage. */}
                      {stats.shieldMax.armorBonusPercent !== 0 && (
                        <span className="text-military-gold"> ({t({ en: "armor", th: "เกราะ" })} {stats.shieldMax.armorBonusPercent >= 0 ? "+" : ""}{stats.shieldMax.armorBonusPercent.toFixed(1)}%)</span>
                      )}
                      {" = "}<span className="font-bold text-gray-300">{Math.round(stats.shieldMax.final)}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="card-military">
              <h2 className="text-military-tan text-sm uppercase tracking-wider mb-3">{t({ en: "Equipped Bonuses", th: "โบนัสจากอุปกรณ์ที่ใส่อยู่" })}</h2>
              <div className="grid grid-cols-1 gap-3">
                {(["helmet", "vest", "boots"] as EquipmentSlot[]).map((slot) => {
                  const item = equippedByslot[slot];
                  if (!item) {
                    return (
                      <div key={slot} className="border border-military-steel border-dashed p-2 text-xs text-military-steel">
                        {SLOT_LABEL[slot]}: {t({ en: "not equipped", th: "ยังไม่ได้ใส่" })}
                      </div>
                    );
                  }
                  const bonus = equipmentBonus(item, item.upgradeLevel);
                  return (
                    <div key={slot} className={`border p-2 ${RARITY_BORDER[item.rarity]}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">
                          {SLOT_LABEL[slot]} (<span className={RARITY_TEXT[item.rarity]}>{item.rarity}</span>{item.upgradeLevel > 0 ? `, ★${item.upgradeLevel}` : ""})
                        </span>
                      </div>
                      <div className="text-xs text-military-steel flex flex-col gap-1">
                        {([
                          ["HP", "hpPercent"],
                          ["ATK", "damagePercent"],
                          ["Crit%", "critChancePercent"],
                          ["CritDMG", "critDamagePercent"],
                        ] as const).map(([label, key]) =>
                          bonus[key] > 0 ? (
                            <span key={key}>
                              {label} +{bonus.base[key]}%
                              {bonus.upgrade[key] > 0 && (
                                <span className="text-green-400"> (+{bonus.upgrade[key]}% {t({ en: "from", th: "จาก" })} ★{item.upgradeLevel})</span>
                              )}
                              {" = "}<span className="font-bold text-white">+{bonus[key]}%</span>
                            </span>
                          ) : null
                        )}
                        {bonus.shieldValue > 0 && <span>Shield +{bonus.shieldValue}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Picker popup — fallback to drag-and-drop */}
        {openPicker && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setOpenPicker(null)}>
            <div className="card-military max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-military-tan mb-3 uppercase">
                {openPicker === "weapon" ? "Choose weapon" : openPicker === "spareWeapon" ? "Choose spare weapon" : `Choose ${SLOT_LABEL[openPicker]}`}
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {openPicker === "weapon" ? (
                  sortedWeapons.map((w) => (
                    <button key={w.id} onClick={() => equipWeapon(w.id)} className={`w-full text-left p-2 border text-sm flex items-center gap-2 ${w.id === equippedWeaponId ? "border-military-tan bg-military-dark" : "border-military-steel"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getWeaponSprite(w.id)} alt="" className="w-6 h-6 object-contain" />
                      {w.name}
                    </button>
                  ))
                ) : openPicker === "spareWeapon" ? (
                  <>
                    {spareWeaponId && (
                      <button onClick={() => setSpareWeapon("")} className="w-full text-left p-2 border border-red-400 text-sm text-red-300">
                        ✕ Unequip spare weapon
                      </button>
                    )}
                    {ownedWeapons.filter((w) => w.id !== equippedWeaponId).map((w) => (
                      <button key={w.id} onClick={() => setSpareWeapon(w.id)} className={`w-full text-left p-2 border text-sm flex items-center gap-2 ${w.id === spareWeaponId ? "border-military-tan bg-military-dark" : "border-military-steel"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getWeaponSprite(w.id)} alt="" className="w-6 h-6 object-contain" />
                        {w.name}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {equippedByslot[openPicker] && (
                      <button onClick={() => unequipItem(equippedByslot[openPicker]!.id)} className="w-full text-left p-2 border border-red-400 text-sm text-red-300">
                        ✕ Unequip {SLOT_LABEL[openPicker]}
                      </button>
                    )}
                  {sortedEquipment.filter((e) => e.slot === openPicker).map((e) => {
                    const bonus = equipmentBonus(e, e.upgradeLevel);
                    return (
                      <button key={e.id} onClick={() => equipItem(e.id, e.slot)} className={`w-full text-left p-2 border text-sm flex items-center gap-2 ${e.equipped ? "border-military-tan bg-military-dark" : "border-military-steel"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getEquipmentSprite(e.id)} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                        <div className="min-w-0">
                          <div>
                            {e.name} <span className={RARITY_TEXT[e.rarity]}>({e.rarity}{e.upgradeLevel > 0 ? `, ★${e.upgradeLevel}` : ""})</span>
                          </div>
                          <div className="text-xs text-military-steel flex flex-wrap gap-x-2">
                            {bonus.hpPercent > 0 && <span>HP +{bonus.hpPercent}%</span>}
                            {bonus.damagePercent > 0 && <span>ATK +{bonus.damagePercent}%</span>}
                            {bonus.critChancePercent > 0 && <span>Crit% +{bonus.critChancePercent}%</span>}
                            {bonus.critDamagePercent > 0 && <span>CritDMG +{bonus.critDamagePercent}%</span>}
                            {bonus.shieldValue > 0 && <span>Shield +{bonus.shieldValue}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  </>
                )}
                {openPicker !== "weapon" && openPicker !== "spareWeapon" && equipment.filter((e) => e.slot === openPicker).length === 0 && (
                  <p className="text-military-steel text-xs">No {SLOT_LABEL[openPicker]} owned yet — pull the Gacha.</p>
                )}
                {openPicker === "weapon" && ownedWeapons.length === 0 && <p className="text-military-steel text-xs">No weapons owned yet.</p>}
                {openPicker === "spareWeapon" && ownedWeapons.filter((w) => w.id !== equippedWeaponId).length === 0 && (
                  <p className="text-military-steel text-xs">No other weapons owned yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Equipment detail popup */}
        {detailEquipment && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDetailEquipment(null)}>
            <div className={`card-military max-w-sm w-full border-2 ${RARITY_BORDER[detailEquipment.rarity]}`} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getEquipmentSprite(detailEquipment.id)} alt={detailEquipment.name} className="w-16 h-16 object-contain" />
                <div>
                  <h3 className="font-bold text-white">{detailEquipment.name}</h3>
                  <span className={`text-xs uppercase font-bold ${RARITY_TEXT[detailEquipment.rarity]}`}>{detailEquipment.rarity}</span>
                </div>
              </div>

              <div className="text-sm space-y-1 mb-3">
                <p className="text-military-steel text-xs uppercase tracking-wider mb-1">{t({ en: "Base Stats", th: "ค่าสถานะฐาน" })} ({detailEquipment.rarity})</p>
                <p>HP: <span className="text-white font-bold">+{detailEquipment.hpPercent}%</span></p>
                <p>ATK: <span className="text-white font-bold">+{detailEquipment.damagePercent}%</span></p>
                <p>Crit%: <span className="text-white font-bold">+{detailEquipment.critChancePercent}%</span></p>
                <p>CritDMG: <span className="text-white font-bold">+{detailEquipment.critDamagePercent}%</span></p>
                <p>Shield: <span className="text-white font-bold">+{detailEquipment.shieldValue}</span></p>
              </div>

              <div className="border-t border-military-steel pt-2 mb-3">
                <p className="text-sm">{t({ en: "Current upgrade level", th: "ระดับอัปเกรดปัจจุบัน" })}: <span className="text-military-gold font-bold">★ {detailEquipment.upgradeLevel}</span></p>
                <p className="text-xs text-military-steel mt-1">
                  {t({
                    en: "Every time Gacha pulls a duplicate of this item (same piece + same rarity), it automatically upgrades +1 level — no extra steps needed, just keep pulling.",
                    th: "ทุกครั้งที่กาชาออกไอเทมนี้ซ้ำ (ชิ้นเดียวกัน+rarity เดียวกัน) จะอัปเกรด +1 ระดับทันทีโดยอัตโนมัติ — ไม่ต้องทำอะไรเพิ่ม แค่กาชาต่อไป",
                  })}
                </p>
              </div>

              {!detailEquipment.equipped && (
                <button onClick={() => equipItem(detailEquipment.id, detailEquipment.slot)} className="btn-military w-full">EQUIP</button>
              )}
              {detailEquipment.equipped && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-green-400 text-sm font-bold">✓ EQUIPPED</span>
                  <button onClick={() => unequipItem(detailEquipment.id)} className="btn-military text-xs px-3 py-1.5 border-red-400 text-red-300">UNEQUIP</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Weapon detail popup */}
        {detailWeapon && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDetailWeapon(null)}>
            <div className="card-military max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getWeaponSprite(detailWeapon.id)} alt={detailWeapon.name} className="w-16 h-16 object-contain" />
                <h3 className="font-bold text-white">{detailWeapon.name}</h3>
              </div>
              <div className="text-sm space-y-1 mb-3">
                <p>Damage: <span className="text-white font-bold">{detailWeapon.damage}</span></p>
                <p>Fire rate: <span className="text-white font-bold">{detailWeapon.fireRate}/s</span></p>
                <p>Accuracy: <span className="text-white font-bold">{detailWeapon.accuracy}%</span></p>
                <p>Reload: <span className="text-white font-bold">{detailWeapon.reloadTime}s</span></p>
              </div>
              {detailWeapon.id !== equippedWeaponId && (
                <button onClick={() => equipWeapon(detailWeapon.id)} className="btn-military w-full">EQUIP</button>
              )}
              {detailWeapon.id === equippedWeaponId && <span className="text-green-400 text-sm font-bold">✓ EQUIPPED</span>}
            </div>
          </div>
        )}

      </div>

      <DragOverlay>
        {activeDrag && (
          <div className="card-military text-center p-2 border-military-gold shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeDragSprite} alt={activeDrag.name} className="w-10 h-10 mx-auto object-contain" />
            <p className="text-xs mt-1 truncate">{activeDrag.name}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
