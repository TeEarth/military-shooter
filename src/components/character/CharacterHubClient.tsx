"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CharacterRow } from "@/lib/google/character";
import type { WeaponRow } from "@/lib/google/weapon";
import type { PassiveConfigRow, PassiveId } from "@/lib/google/passive";
import type { PlayerPassiveRow } from "@/lib/db/passive";
import { showRewardedAd } from "@/lib/ads-service";
import { getWeaponSprite } from "@/lib/spriteHelpers";
import CurrencyBar from "@/components/ui/CurrencyBar";
import Icon, { type IconName } from "@/components/ui/Icon";
import { PERKS, PERK_ORDER, type PerkId } from "@/lib/perks";
import { SKIN_COLORS, SKIN_COLOR_PRICE, SKIN_COLOR_HEX, getEquippedSkinColor, getOwnedSkinColors, type SkinColor } from "@/lib/skinColors";
import { sfx } from "@/lib/sfx";
import { getUpgradedBaseHp, getUpgradeCost } from "@/lib/characterUpgrade";
import { getUpgradedBaseDamage, getWeaponUpgradeCost } from "@/lib/weaponUpgrade";

interface Props {
  allCharacters: CharacterRow[];
  ownedCharacterIds: string[];
  activeCharacterId: string;
  allWeapons: WeaponRow[];
  ownedWeaponIds: string[];
  equippedWeaponId: string | null;
  passiveConfigs: PassiveConfigRow[];
  playerPassives: PlayerPassiveRow[];
  currentStage: number;
  vipLevel: number;
  farmStageMaxWave: number;
  coin: number;
  diamond: number;
  ticket: number;
  exp: number;
  greenBanknote: number;
  perks: { spareWeapon: boolean; regen: boolean; superShield: boolean; oneShot: boolean; invisible: boolean; neverDied: boolean };
  /** v42: equipped color skin PER character id — e.g. {"bob": "red"}. */
  skinColors: Record<string, string>;
  /** v42: owned color skins PER character id — e.g. {"bob": ["red", "gold"]}. */
  ownedSkinsByCharacter: Record<string, string[]>;
  /** v46: permanent HP upgrade level PER character id — e.g. {"bob": 12}. */
  characterUpgradeLevels: Record<string, number>;
  /** v47: permanent damage upgrade level PER weapon id — e.g. {"pistol": 8}. */
  weaponUpgradeLevels: Record<string, number>;
}

const PASSIVE_LABELS: Record<PassiveId, string> = {
  hpPercent: "HP %",
  critChance: "Critical chance",
  accuracy: "Accuracy",
  damagePercent: "Damage %",
  reloadSpeedPercent: "Reload speed",
  fireRatePercent: "Fire rate",
  dailyAmmoPercent: "Daily ammo",
  critDamagePercent: "Critical damage",
};

const CURRENCY_ICON_NAME: Record<string, IconName> = { coin: "coin", diamond: "diamond", ticket: "ticket" };

/** Small "icon + formatted number" pair used everywhere a price/cost is
 *  shown inline in a button — replaces the old `${emoji} ${amount}` string
 *  template (a plain string can't embed a real <Icon/> component). */
function CurrencyCost({ currency, amount }: { currency: string; amount: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={CURRENCY_ICON_NAME[currency] ?? "coin"} size={14} />
      {amount.toLocaleString()}
    </span>
  );
}

/** Per-character card gradient/glow, sampled from each character's own sprite palette
 *  (bob=olive, jackson=bronze, ryzor=blue, mina=magenta, azzure=gold/teal). */
const CHARACTER_THEME: Record<string, { from: string; to: string; glow: string }> = {
  bob: { from: "#2f4520", to: "#0f0f1a", glow: "#7a9450" },
  jackson: { from: "#4a3a1e", to: "#0f0f1a", glow: "#a4823f" },
  ryzor: { from: "#1e3446", to: "#0f0f1a", glow: "#45719a" },
  mina: { from: "#4a1e3e", to: "#0f0f1a", glow: "#9a4580" },
  azzure: { from: "#8a6a1a", to: "#0f0f1a", glow: "#e0b13a" },
};
const DEFAULT_THEME = { from: "#1a1a2e", to: "#0f0f1a", glow: "#c5a97d" };

/** Perks tab card theming — each perk gets a color identity matching its
 *  in-game HUD treatment (spare weapon=tan/gold like Reload/Swap, regen=green,
 *  super shield=blue, one shot=fiery gold for the armed-skull glow). */
const PERK_THEME: Record<PerkId, { from: string; glow: string }> = {
  spare_weapon: { from: "#3a331a", glow: "#c5a97d" },
  regen: { from: "#1a3a24", glow: "#4ade80" },
  super_shield: { from: "#1a2a3a", glow: "#60a5fa" },
  one_shot: { from: "#3a1a1a", glow: "#f39c12" },
  invisible: { from: "#241a3a", glow: "#a78bfa" },
  never_died: { from: "#3a1a2a", glow: "#f472b6" },
};

const PERK_FIELD_NAME: Record<PerkId, keyof Props["perks"]> = {
  spare_weapon: "spareWeapon",
  regen: "regen",
  super_shield: "superShield",
  one_shot: "oneShot",
  invisible: "invisible",
  never_died: "neverDied",
};

// v51: perks.ts's own `icon` field stays a literal emoji glyph — it's also
// rendered as real Phaser canvas TEXT in the guided tutorial (see
// tutorialIntroSteps.ts's perk sub-steps), which can't use an SVG Icon
// component. This is the separate mapping for the DOM-rendered Perks tab only.
const PERK_ICON: Record<PerkId, IconName> = {
  spare_weapon: "spareWeapon",
  regen: "regen",
  super_shield: "superShield",
  one_shot: "oneShot",
  invisible: "invisible",
  never_died: "neverDied",
};

function isCharacterUnlocked(char: CharacterRow, currentStage: number): boolean {
  return char.unlockType === "FREE" || (char.unlockType === "STAGE" && currentStage >= char.unlockValue);
}

export default function CharacterHubClient(props: Props) {
  const [tab, setTab] = useState<"character" | "weapon" | "passive" | "perks">("character");
  const [perks, setPerks] = useState(props.perks);
  const [coin, setCoin] = useState(props.coin);
  const [diamond, setDiamond] = useState(props.diamond);
  const [ticket, setTicket] = useState(props.ticket);
  const [ownedCharacterIds, setOwnedCharacterIds] = useState(props.ownedCharacterIds);
  const [ownedWeaponIds, setOwnedWeaponIds] = useState(props.ownedWeaponIds);
  const [activeCharacterId, setActiveCharacterId] = useState(props.activeCharacterId);
  const [equippedWeaponId, setEquippedWeaponId] = useState(props.equippedWeaponId);
  const [playerPassives, setPlayerPassives] = useState(props.playerPassives);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  // v42: BOTH maps are keyed by character id — buying/equipping a skin for
  // one character only ever touches that character's own entry (see
  // confirmSkin below), never any other character's.
  const [skinColors, setSkinColors] = useState(props.skinColors);
  const [ownedSkinsByCharacter, setOwnedSkinsByCharacter] = useState(props.ownedSkinsByCharacter);
  const [skinLoading, setSkinLoading] = useState(false);
  const [characterUpgradeLevels, setCharacterUpgradeLevels] = useState(props.characterUpgradeLevels);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState<{ hpGained: number } | null>(null);
  const [weaponUpgradeLevels, setWeaponUpgradeLevels] = useState(props.weaponUpgradeLevels);
  const [weaponUpgradeLoading, setWeaponUpgradeLoading] = useState(false);
  const [weaponUpgradeSuccess, setWeaponUpgradeSuccess] = useState<{ damageGained: number } | null>(null);

  const [selectedCharacter, setSelectedCharacter] = useState<CharacterRow>(
    props.allCharacters.find((c) => c.id === activeCharacterId) ?? props.allCharacters[0]
  );

  // v41/v42: the swatch currently PREVIEWED on the portrait — separate from
  // the actually-equipped color until Confirm is pressed. Resets to whatever
  // is equipped on THIS character every time the browsed character changes,
  // so switching characters never leaks a stale preview from another one.
  const [previewSkinColor, setPreviewSkinColor] = useState<SkinColor>(getEquippedSkinColor(skinColors, selectedCharacter.id));
  useEffect(() => {
    setPreviewSkinColor(getEquippedSkinColor(skinColors, selectedCharacter.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacter.id]);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponRow>(
    props.allWeapons.find((w) => w.id === equippedWeaponId) ?? props.allWeapons[0]
  );
  const [ammoInfo, setAmmoInfo] = useState<{ remaining: number; dailyAmmo: number } | null>(null);
  const [ammoLoading, setAmmoLoading] = useState(false);

  useEffect(() => {
    if (tab !== "weapon") return;
    let cancelled = false;
    setAmmoInfo(null);
    fetch(`/api/weapon/ammo?weaponId=${selectedWeapon.id}`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.success) setAmmoInfo({ remaining: data.remaining, dailyAmmo: data.dailyAmmo }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tab, selectedWeapon.id]);

  async function refillAmmo(method: "ad" | "diamond") {
    if (ammoLoading) return;
    setAmmoLoading(true);
    try {
      if (method === "ad") {
        const adResult = await showRewardedAd();
        if (!adResult.success) {
          setMessage(adResult.error ?? "Ad failed to load");
          return;
        }
      }

      const res = await fetch("/api/weapon/ammo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponId: selectedWeapon.id, method }),
      });
      const data = await res.json();
      if (data.success) {
        setAmmoInfo((prev) => (prev ? { ...prev, remaining: data.remaining } : prev));
        if (method === "diamond") setDiamond((d) => d - 40);
      } else {
        setMessage(data.error);
      }
    } finally {
      setAmmoLoading(false);
    }
  }

  function applyPlayerUpdate(updatedPlayer: { coin: number; diamond: number; ticket: number } | undefined) {
    if (!updatedPlayer) return;
    setCoin(updatedPlayer.coin);
    setDiamond(updatedPlayer.diamond);
    setTicket(updatedPlayer.ticket);
  }

  // v9 #3: optimistic UI — flip the visible state immediately (before the
  // network round-trip), roll back only if the server actually rejects it.
  // Google Sheets writes are slow enough (300ms-1s+) that waiting for the
  // response before updating anything made every button feel laggy even
  // though the action almost always succeeds.
  async function buyCharacter(char: CharacterRow) {
    if (loading) return;
    const currency = char.unlockType === "PURCHASE" ? "coin" : char.unlockType === "DIAMOND" ? "diamond" : "ticket";
    const price = char.unlockValue;
    const prevOwned = ownedCharacterIds;
    const prevBalance = { coin, diamond, ticket };

    setOwnedCharacterIds((prev) => [...prev, char.id]);
    if (currency === "coin") setCoin((c) => c - price);
    else if (currency === "diamond") setDiamond((d) => d - price);
    else setTicket((t) => t - price);

    setLoading(true);
    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType: "character", itemId: char.id, currency }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error);
      if (data.success) {
        applyPlayerUpdate(data.updatedPlayer); // reconcile with the server's exact numbers
      } else {
        setOwnedCharacterIds(prevOwned);
        setCoin(prevBalance.coin);
        setDiamond(prevBalance.diamond);
        setTicket(prevBalance.ticket);
      }
    } catch {
      setOwnedCharacterIds(prevOwned);
      setCoin(prevBalance.coin);
      setDiamond(prevBalance.diamond);
      setTicket(prevBalance.ticket);
      setMessage("Network error — purchase not completed.");
    } finally {
      setLoading(false);
    }
  }

  async function equipCharacter(char: CharacterRow) {
    if (loading) return;
    const previous = activeCharacterId;
    setActiveCharacterId(char.id);
    setLoading(true);
    try {
      const res = await fetch("/api/character/equip", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: char.id }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error);
      if (!data.success) setActiveCharacterId(previous);
    } catch {
      setActiveCharacterId(previous);
      setMessage("Network error — equip not completed.");
    } finally {
      setLoading(false);
    }
  }

  async function buyWeapon(weapon: WeaponRow) {
    if (loading) return;
    // v15: STAGE-type weapons are purchased with coin too, once the stage requirement is met.
    const currency = weapon.unlockType === "PURCHASE" || weapon.unlockType === "STAGE" ? "coin" : weapon.unlockType === "DIAMOND" ? "diamond" : "ticket";
    const price = currency === "coin" ? weapon.priceCoin : currency === "diamond" ? weapon.priceDiamond : weapon.priceTicket;
    const prevOwned = ownedWeaponIds;
    const prevBalance = { coin, diamond, ticket };

    setOwnedWeaponIds((prev) => [...prev, weapon.id]);
    if (currency === "coin") setCoin((c) => c - price);
    else if (currency === "diamond") setDiamond((d) => d - price);
    else setTicket((t) => t - price);

    setLoading(true);
    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType: "weapon", itemId: weapon.id, currency }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error);
      if (data.success) {
        applyPlayerUpdate(data.updatedPlayer);
      } else {
        setOwnedWeaponIds(prevOwned);
        setCoin(prevBalance.coin);
        setDiamond(prevBalance.diamond);
        setTicket(prevBalance.ticket);
      }
    } catch {
      setOwnedWeaponIds(prevOwned);
      setCoin(prevBalance.coin);
      setDiamond(prevBalance.diamond);
      setTicket(prevBalance.ticket);
      setMessage("Network error — purchase not completed.");
    } finally {
      setLoading(false);
    }
  }

  async function equipWeapon(weapon: WeaponRow) {
    if (loading) return;
    const previous = equippedWeaponId;
    const wasOwned = ownedWeaponIds.includes(weapon.id);
    setEquippedWeaponId(weapon.id);
    if (!wasOwned) setOwnedWeaponIds((prev) => [...prev, weapon.id]);
    setLoading(true);
    try {
      const res = await fetch("/api/weapon/equip", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponId: weapon.id }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error);
      if (!data.success) {
        setEquippedWeaponId(previous);
        if (!wasOwned) setOwnedWeaponIds((prev) => prev.filter((id) => id !== weapon.id));
      }
    } catch {
      setEquippedWeaponId(previous);
      if (!wasOwned) setOwnedWeaponIds((prev) => prev.filter((id) => id !== weapon.id));
      setMessage("Network error — equip not completed.");
    } finally {
      setLoading(false);
    }
  }

  async function upgradePassive(passiveId: PassiveId) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/passive/upgrade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passiveId }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayerPassives((prev) => {
          const existing = prev.find((p) => p.passiveId === passiveId);
          if (existing) return prev.map((p) => (p.passiveId === passiveId ? { ...p, currentTier: data.newTier } : p));
          return [...prev, { playerId: "", passiveId, currentTier: data.newTier }];
        });
        applyPlayerUpdate(data.updatedPlayer);
        setMessage(`Upgraded to tier ${data.newTier}!`);
      } else {
        setMessage(data.error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function purchasePerk(perkId: PerkId) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/perk/purchase", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perkId }),
      });
      const data = await res.json();
      if (data.success) {
        setPerks((prev) => ({
          ...prev,
          spareWeapon: perkId === "spare_weapon" ? true : prev.spareWeapon,
          regen: perkId === "regen" ? true : prev.regen,
          superShield: perkId === "super_shield" ? true : prev.superShield,
          oneShot: perkId === "one_shot" ? true : prev.oneShot,
          invisible: perkId === "invisible" ? true : prev.invisible,
          neverDied: perkId === "never_died" ? true : prev.neverDied,
        }));
        applyPlayerUpdate(data.updatedPlayer);
        setMessage(`${PERKS[perkId].name} unlocked!`);
      } else {
        setMessage(data.error);
      }
    } finally {
      setLoading(false);
    }
  }

  // v41/v42: previewing a color is purely local state — no network call, no
  // cost — so clicking through swatches is instant and free. Confirming is
  // the only action that actually buys/equips, and only ever touches THIS
  // character's (charId) own entry in the skinColors/ownedSkinsByCharacter
  // maps — every other character's skin state is untouched.
  async function confirmSkin(charId: string, color: SkinColor) {
    const equippedForChar = getEquippedSkinColor(skinColors, charId);
    if (skinLoading || color === equippedForChar) return;
    const ownedForChar = getOwnedSkinColors(ownedSkinsByCharacter, charId);
    const owned = ownedForChar.includes(color);
    const prevOwnedMap = ownedSkinsByCharacter;
    const prevCoin = coin;
    const prevSkinColorsMap = skinColors;

    if (!owned) setOwnedSkinsByCharacter((prev) => ({ ...prev, [charId]: [...ownedForChar, color] }));
    if (!owned) setCoin((c) => c - SKIN_COLOR_PRICE);
    setSkinColors((prev) => ({ ...prev, [charId]: color }));
    setSkinLoading(true);
    try {
      if (!owned) {
        const buyRes = await fetch("/api/character/skin", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "buy", skinColor: color, characterId: charId }),
        });
        const buyData = await buyRes.json();
        if (!buyData.success) {
          setOwnedSkinsByCharacter(prevOwnedMap);
          setCoin(prevCoin);
          setSkinColors(prevSkinColorsMap);
          setPreviewSkinColor(equippedForChar);
          setMessage(buyData.error);
          return;
        }
        applyPlayerUpdate(buyData.updatedPlayer);
      }

      const selectRes = await fetch("/api/character/skin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", skinColor: color, characterId: charId }),
      });
      const selectData = await selectRes.json();
      if (!selectData.success) {
        setSkinColors(prevSkinColorsMap);
        setPreviewSkinColor(equippedForChar);
        setMessage(selectData.error);
        return;
      }
      setMessage(owned ? `Equipped ${color} skin!` : `Bought and equipped the ${color} skin!`);
    } catch {
      setOwnedSkinsByCharacter(prevOwnedMap);
      setCoin(prevCoin);
      setSkinColors(prevSkinColorsMap);
      setPreviewSkinColor(equippedForChar);
      setMessage("Network error — skin not applied.");
    } finally {
      setSkinLoading(false);
    }
  }

  // v46: permanent, uncapped, per-character HP upgrade — never touches any
  // other character's own level (see confirmSkin above for the same pattern).
  async function upgradeCharacter(charId: string) {
    if (upgradeLoading) return;
    const prevLevel = characterUpgradeLevels[charId] ?? 0;
    const cost = getUpgradeCost(prevLevel);
    const prevCoin = coin;

    setCharacterUpgradeLevels((prev) => ({ ...prev, [charId]: prevLevel + 1 }));
    setCoin((c) => c - cost);
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/character/upgrade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: charId }),
      });
      const data = await res.json();
      if (data.success) {
        applyPlayerUpdate(data.updatedPlayer);
        sfx.play("pickup_item");
        setUpgradeSuccess({ hpGained: data.hpGained });
        setTimeout(() => setUpgradeSuccess(null), 2000);
      } else {
        setCharacterUpgradeLevels((prev) => ({ ...prev, [charId]: prevLevel }));
        setCoin(prevCoin);
        setMessage(data.error);
      }
    } catch {
      setCharacterUpgradeLevels((prev) => ({ ...prev, [charId]: prevLevel }));
      setCoin(prevCoin);
      setMessage("Network error — upgrade not completed.");
    } finally {
      setUpgradeLoading(false);
    }
  }

  // v47: same pattern as upgradeCharacter above, own DB field, own endpoint —
  // never touches any other weapon's own level.
  async function upgradeWeapon(weaponId: string) {
    if (weaponUpgradeLoading) return;
    const prevLevel = weaponUpgradeLevels[weaponId] ?? 0;
    const cost = getWeaponUpgradeCost(prevLevel);
    const prevCoin = coin;

    setWeaponUpgradeLevels((prev) => ({ ...prev, [weaponId]: prevLevel + 1 }));
    setCoin((c) => c - cost);
    setWeaponUpgradeLoading(true);
    try {
      const res = await fetch("/api/weapon/upgrade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponId }),
      });
      const data = await res.json();
      if (data.success) {
        applyPlayerUpdate(data.updatedPlayer);
        sfx.play("pickup_item");
        setWeaponUpgradeSuccess({ damageGained: data.damageGained });
        setTimeout(() => setWeaponUpgradeSuccess(null), 2000);
      } else {
        setWeaponUpgradeLevels((prev) => ({ ...prev, [weaponId]: prevLevel }));
        setCoin(prevCoin);
        setMessage(data.error);
      }
    } catch {
      setWeaponUpgradeLevels((prev) => ({ ...prev, [weaponId]: prevLevel }));
      setCoin(prevCoin);
      setMessage("Network error — upgrade not completed.");
    } finally {
      setWeaponUpgradeLoading(false);
    }
  }

  const isCharOwned = ownedCharacterIds.includes(selectedCharacter.id) || isCharacterUnlocked(selectedCharacter, props.currentStage);
  const isCharActive = selectedCharacter.id === activeCharacterId;
  const specialOk = selectedCharacter.unlockType !== "SPECIAL" || (props.vipLevel >= selectedCharacter.vipRequirement && props.farmStageMaxWave > selectedCharacter.waveRequirement);

  // v15: STAGE-type weapons (e.g. Double Pistol) are NOT auto-owned just because
  // the stage requirement is met — clearing the stage only unlocks the right to
  // BUY it (see meetsWeaponStageRequirement below); it must still be purchased
  // like PURCHASE/DIAMOND/TICKET weapons before it's actually usable. Treating
  // stage-met as "owned" here was the Double Pistol bug: the equip button showed
  // immediately, but the server rejected the equip since it was never granted.
  const isWeaponOwned = ownedWeaponIds.includes(selectedWeapon.id) || selectedWeapon.unlockType === "FREE";
  const weaponStageOk =
    (selectedWeapon.unlockType !== "STAGE" || props.currentStage >= selectedWeapon.unlockValue) &&
    // v24: "FARM_WAVE" — unlocked once the player's ALL-TIME best farm wave
    // (any multiverse's farm stage — farmStageMaxWave is a single global
    // field, never per-stage, see src/lib/db/player.ts) reaches unlockValue.
    (selectedWeapon.unlockType !== "FARM_WAVE" || props.farmStageMaxWave >= selectedWeapon.unlockValue);
  const isWeaponActive = selectedWeapon.id === equippedWeaponId;

  return (
    <div className="min-h-screen bg-military-darker p-6">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Character / Weapon</h1>
        <div className="ml-auto">
          <CurrencyBar coin={coin} diamond={diamond} ticket={ticket} greenBanknote={props.greenBanknote} />
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("character")} className={`btn-military text-xs ${tab === "character" ? "" : "opacity-50"}`}>Character</button>
        <button onClick={() => setTab("weapon")} className={`btn-military text-xs ${tab === "weapon" ? "" : "opacity-50"}`}>Weapon</button>
        <button onClick={() => setTab("passive")} className={`btn-military text-xs ${tab === "passive" ? "" : "opacity-50"}`}>Passive</button>
        <button onClick={() => setTab("perks")} className={`btn-military text-xs ${tab === "perks" ? "" : "opacity-50"}`}>Perks</button>
      </div>

      {message && <div className="max-w-6xl mx-auto mb-4 text-military-gold text-sm">{message}</div>}

      {tab === "character" && (
        <div className="flex gap-6 max-w-6xl mx-auto">
          <div className="w-52 space-y-2 flex-shrink-0">
            {props.allCharacters.map((char) => {
              const theme = CHARACTER_THEME[char.id] ?? DEFAULT_THEME;
              const isSelected = selectedCharacter.id === char.id;
              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharacter(char)}
                  className={`w-full text-left p-3 border text-sm transition-all duration-200 ${isSelected ? "scale-105" : "hover:scale-[1.02]"}`}
                  style={{
                    borderColor: isSelected ? theme.glow : "#4a4e69",
                    boxShadow: isSelected ? `0 0 12px ${theme.glow}` : undefined,
                    background: `linear-gradient(135deg, ${theme.from}, ${theme.to})`,
                  }}
                >
                  <div className="font-bold">{char.name}</div>
                  <div className="text-xs text-military-steel">{char.rank} — {char.unlockType}</div>
                  {(ownedCharacterIds.includes(char.id) || isCharacterUnlocked(char, props.currentStage)) && <div className="text-xs text-green-400">OWNED</div>}
                  {char.id === activeCharacterId && <div className="text-xs text-military-gold">ACTIVE</div>}
                </button>
              );
            })}
          </div>

          <div
            className="flex-1 card-military flex gap-4"
            style={{
              background: `linear-gradient(135deg, ${(CHARACTER_THEME[selectedCharacter.id] ?? DEFAULT_THEME).from}, ${(CHARACTER_THEME[selectedCharacter.id] ?? DEFAULT_THEME).to})`,
              boxShadow: `inset 0 0 40px ${(CHARACTER_THEME[selectedCharacter.id] ?? DEFAULT_THEME).glow}22`,
            }}
          >
            {selectedCharacter.sprite && (
              <div className="relative w-32 h-32 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedCharacter.sprite}
                  alt={selectedCharacter.name}
                  className="w-32 h-32 object-contain"
                  style={{ filter: `drop-shadow(0 0 14px ${(CHARACTER_THEME[selectedCharacter.id] ?? DEFAULT_THEME).glow})` }}
                />
                {/* v42: color-skin preview — each character has its own independent
                 *  skin state now, so this previews whichever character is currently
                 *  browsed (not just the equipped one). Approximates Phaser's in-game
                 *  multiply tint via a mask-clipped, multiply-blended color layer
                 *  shaped exactly like the sprite. */}
                {SKIN_COLOR_HEX[previewSkinColor] !== null && (
                  <div
                    className="absolute inset-0 w-32 h-32 pointer-events-none"
                    style={{
                      backgroundColor: `#${SKIN_COLOR_HEX[previewSkinColor]!.toString(16).padStart(6, "0")}`,
                      WebkitMaskImage: `url(${selectedCharacter.sprite})`,
                      WebkitMaskSize: "contain",
                      WebkitMaskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskImage: `url(${selectedCharacter.sprite})`,
                      maskSize: "contain",
                      maskRepeat: "no-repeat",
                      maskPosition: "center",
                      mixBlendMode: "multiply",
                    }}
                  />
                )}
                {/* v10 #3 / v24 fix: same grip-anchored positioning fix as HomeClient —
                 *  see its comment for why (was reading as a stick out of the head). */}
                {equippedWeaponId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getWeaponSprite(equippedWeaponId)}
                    alt=""
                    className="absolute w-10 h-16 object-contain pointer-events-none"
                    style={{ left: "58%", top: "66%", transform: "translate(-50%, -75%)" }}
                  />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-white mb-1">{selectedCharacter.name}</h2>
            <span className="text-xs px-2 py-0.5 border border-military-steel text-military-steel">{selectedCharacter.rank} — {selectedCharacter.unlockType}</span>

            <div className="grid grid-cols-2 gap-3 my-4">
              {[
                ["HP", `${getUpgradedBaseHp(selectedCharacter.hpMax, characterUpgradeLevels[selectedCharacter.id] ?? 0)}`],
                ["SPEED", `${selectedCharacter.speed}/10`],
                ["ACCURACY", `+${selectedCharacter.accuracy}%`],
                ["REGEN", `+${selectedCharacter.regenPer5s}/5s`],
                ["ARMOR", `+${selectedCharacter.armorPercent}%`],
                ["CRIT %", `+${selectedCharacter.critChance}%`],
                ["CRIT DMG", `+${selectedCharacter.critDamage}%`],
              ].map(([label, val]) => (
                <div key={String(label)} className="bg-military-darker p-2 border border-military-steel">
                  <div className="text-xs text-military-steel">{label}</div>
                  <div className="text-white font-bold">{val}</div>
                </div>
              ))}
            </div>

            {selectedCharacter.unlockType === "STAGE" && props.currentStage < selectedCharacter.unlockValue && (
              <p className="text-red-400 text-sm mb-3">Unlocks after clearing Stage {selectedCharacter.unlockValue}</p>
            )}
            {selectedCharacter.unlockType === "SPECIAL" && !specialOk && (
              <p className="text-red-400 text-sm mb-3">Requires VIP {selectedCharacter.vipRequirement}+ and farm wave &gt; {selectedCharacter.waveRequirement} (currently VIP {props.vipLevel}, best wave {props.farmStageMaxWave})</p>
            )}

            {!isCharOwned && specialOk && (selectedCharacter.unlockType === "PURCHASE" || selectedCharacter.unlockType === "DIAMOND" || selectedCharacter.unlockType === "TICKET" || selectedCharacter.unlockType === "SPECIAL") && (
              <button onClick={() => buyCharacter(selectedCharacter)} disabled={loading} className="btn-military">
                {loading ? "..." : <CurrencyCost currency={selectedCharacter.unlockType === "PURCHASE" ? "coin" : selectedCharacter.unlockType === "DIAMOND" ? "diamond" : "ticket"} amount={selectedCharacter.unlockValue} />}
              </button>
            )}
            {isCharOwned && !isCharActive && (
              <button onClick={() => equipCharacter(selectedCharacter)} disabled={loading} className="btn-military">{loading ? "..." : "EQUIP"}</button>
            )}
            {isCharActive && <span className="text-green-400 text-sm font-bold inline-flex items-center gap-1"><Icon name="check" size={14} /> ACTIVE</span>}

            <div className="mt-4 pt-4 border-t border-military-steel/30">
              <h3 className="text-xs uppercase tracking-wider text-military-tan mb-2">Color Skin — {selectedCharacter.name} only</h3>
              {!isCharOwned ? (
                <p className="text-xs text-red-400 flex items-center gap-1"><Icon name="lock" size={14} /> Own {selectedCharacter.name} first to customize their color skin.</p>
              ) : (
              <>
              <p className="text-xs text-military-steel mb-2">Every character keeps its own colors — this never touches any other character. Click a color to preview it, then Confirm to buy/equip.</p>
              <div className="flex gap-2 flex-wrap items-center">
                {(() => {
                  const equippedForChar = getEquippedSkinColor(skinColors, selectedCharacter.id);
                  const ownedForChar = getOwnedSkinColors(ownedSkinsByCharacter, selectedCharacter.id);
                  return (
                    <>
                      {SKIN_COLORS.map((color) => {
                        const hex = SKIN_COLOR_HEX[color];
                        const owned = ownedForChar.includes(color);
                        const active = equippedForChar === color;
                        const previewed = previewSkinColor === color;
                        return (
                          <button
                            key={color}
                            onClick={() => setPreviewSkinColor(color)}
                            title={color}
                            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center relative ${previewed ? "border-military-gold scale-110" : active ? "border-emerald-400" : "border-military-steel"}`}
                            style={{ background: hex !== null ? `#${hex.toString(16).padStart(6, "0")}` : "repeating-conic-gradient(#888 0% 25%, #ccc 0% 50%)" }}
                          >
                            {active && <span className="absolute -top-1 -right-1 bg-emerald-400 text-military-darker rounded-full w-4 h-4 flex items-center justify-center"><Icon name="check" size={10} /></span>}
                            {!owned && <span className="absolute -bottom-1 text-[8px] text-white bg-black/60 px-1 rounded">{SKIN_COLOR_PRICE}</span>}
                          </button>
                        );
                      })}

                      {previewSkinColor !== equippedForChar && (
                        <button
                          onClick={() => confirmSkin(selectedCharacter.id, previewSkinColor)}
                          disabled={skinLoading || (!ownedForChar.includes(previewSkinColor) && coin < SKIN_COLOR_PRICE)}
                          className="btn-military text-xs ml-2"
                        >
                          {skinLoading
                            ? "..."
                            : ownedForChar.includes(previewSkinColor)
                              ? "CONFIRM — EQUIP"
                              : <>CONFIRM — <CurrencyCost currency="coin" amount={SKIN_COLOR_PRICE} /></>}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
              </>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-military-steel/30 relative">
              <h3 className="text-xs uppercase tracking-wider text-military-tan mb-2">Character Upgrade — {selectedCharacter.name} only</h3>
              {!isCharOwned ? (
                <p className="text-xs text-red-400 flex items-center gap-1"><Icon name="lock" size={14} /> Own {selectedCharacter.name} first to upgrade their HP.</p>
              ) : (
              <>
              <p className="text-xs text-military-steel mb-2">Permanent, uncapped HP upgrade. Independent per character — never touches any other character's own level.</p>
              {(() => {
                const level = characterUpgradeLevels[selectedCharacter.id] ?? 0;
                const currentHp = getUpgradedBaseHp(selectedCharacter.hpMax, level);
                const nextHp = getUpgradedBaseHp(selectedCharacter.hpMax, level + 1);
                const cost = getUpgradeCost(level);
                const canAfford = coin >= cost;
                return (
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="bg-military-darker p-2 border border-military-steel">
                      <div className="text-xs text-military-steel">LEVEL</div>
                      <div className="text-white font-bold">Lv.{level}</div>
                    </div>
                    <div className="bg-military-darker p-2 border border-military-steel">
                      <div className="text-xs text-military-steel">CURRENT HP</div>
                      <div className="text-white font-bold">{currentHp}</div>
                    </div>
                    <div className="bg-military-darker p-2 border border-emerald-600">
                      <div className="text-xs text-military-steel">NEXT HP</div>
                      <div className="text-emerald-400 font-bold">{nextHp}</div>
                    </div>
                    <button
                      onClick={() => upgradeCharacter(selectedCharacter.id)}
                      disabled={upgradeLoading || !canAfford}
                      className={`btn-military text-xs px-4 py-2 ${!canAfford ? "opacity-40 grayscale cursor-not-allowed" : ""}`}
                    >
                      {upgradeLoading
                        ? "..."
                        : canAfford
                          ? <>UPGRADE — <CurrencyCost currency="coin" amount={cost} /></>
                          : <>NOT ENOUGH COIN — <CurrencyCost currency="coin" amount={cost} /></>}
                    </button>
                  </div>
                );
              })()}

              {upgradeSuccess && (
                <div className="absolute inset-0 flex items-center justify-center bg-military-darker/90 animate-[pvp-pay-flourish_0.9s_ease-out]">
                  <div className="text-center">
                    <p className="text-emerald-400 font-black text-lg uppercase tracking-widest">Upgrade Success!</p>
                    <p className="text-military-gold font-bold text-2xl">+{upgradeSuccess.hpGained} HP</p>
                  </div>
                </div>
              )}
              </>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {tab === "weapon" && (
        <div className="flex gap-6 max-w-6xl mx-auto">
          <div className="w-52 space-y-2 flex-shrink-0">
            {props.allWeapons.map((weapon) => (
              <button key={weapon.id} onClick={() => setSelectedWeapon(weapon)} className={`w-full text-left p-3 border text-sm flex items-center gap-2 ${selectedWeapon.id === weapon.id ? "border-military-tan bg-military-dark" : "border-military-steel hover:border-military-tan"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getWeaponSprite(weapon.id)} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
                <div>
                  <div className="font-bold">{weapon.name}</div>
                  <div className="text-xs text-military-steel">{weapon.unlockType}</div>
                  {(ownedWeaponIds.includes(weapon.id) || weapon.unlockType === "FREE") && <div className="text-xs text-green-400">OWNED</div>}
                  {weapon.id === equippedWeaponId && <div className="text-xs text-military-gold">EQUIPPED</div>}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 card-military">
            <div className="flex items-center gap-3 mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getWeaponSprite(selectedWeapon.id)} alt="" className="w-12 h-12 object-contain" />
              <h2 className="text-2xl font-black text-white">{selectedWeapon.name}</h2>
            </div>
            <span className="text-xs px-2 py-0.5 border border-military-steel text-military-steel">{selectedWeapon.unlockType} — {selectedWeapon.fireMode}</span>

            <div className="grid grid-cols-2 gap-3 my-4">
              {[
                ["DAMAGE", getUpgradedBaseDamage(selectedWeapon.damage, weaponUpgradeLevels[selectedWeapon.id] ?? 0)],
                ["FIRE RATE", `${selectedWeapon.fireRate}/s`],
                ["PROJECTILES", selectedWeapon.projectileCount],
                ["ACCURACY", `${selectedWeapon.accuracy}%`],
                ["MAGAZINE", selectedWeapon.magazineSize],
                ["RELOAD", `${selectedWeapon.reloadTime}s`],
                ["CRIT %", `${selectedWeapon.critChance}%`],
                ["CRIT DMG", `${selectedWeapon.critDamage}%`],
                ["DAILY AMMO", selectedWeapon.dailyAmmo],
              ].map(([label, val]) => (
                <div key={String(label)} className="bg-military-darker p-2 border border-military-steel">
                  <div className="text-xs text-military-steel">{label}</div>
                  <div className="text-white font-bold">{val}</div>
                </div>
              ))}
            </div>

            {selectedWeapon.unlockType === "STAGE" && !weaponStageOk && (
              <p className="text-red-400 text-sm mb-3">Unlocks after clearing Stage {selectedWeapon.unlockValue}</p>
            )}
            {selectedWeapon.unlockType === "FARM_WAVE" && !weaponStageOk && (
              <p className="text-red-400 text-sm mb-3">Unlocks after reaching wave {selectedWeapon.unlockValue} in any Farm stage (currently best wave {props.farmStageMaxWave})</p>
            )}

            {!isWeaponOwned && weaponStageOk && (selectedWeapon.unlockType === "PURCHASE" || selectedWeapon.unlockType === "DIAMOND" || selectedWeapon.unlockType === "TICKET" || selectedWeapon.unlockType === "STAGE" || selectedWeapon.unlockType === "FARM_WAVE") && (
              <button onClick={() => buyWeapon(selectedWeapon)} disabled={loading} className="btn-military">
                {loading ? "..." : <CurrencyCost currency={selectedWeapon.unlockType === "PURCHASE" || selectedWeapon.unlockType === "STAGE" ? "coin" : selectedWeapon.unlockType === "DIAMOND" ? "diamond" : "ticket"} amount={selectedWeapon.unlockType === "PURCHASE" || selectedWeapon.unlockType === "STAGE" ? selectedWeapon.priceCoin : selectedWeapon.unlockType === "DIAMOND" ? selectedWeapon.priceDiamond : selectedWeapon.priceTicket} />}
              </button>
            )}
            {isWeaponOwned && !isWeaponActive && (
              <button onClick={() => equipWeapon(selectedWeapon)} disabled={loading} className="btn-military">{loading ? "..." : "EQUIP"}</button>
            )}
            {isWeaponActive && <span className="text-green-400 text-sm font-bold inline-flex items-center gap-1"><Icon name="check" size={14} /> EQUIPPED</span>}

            {isWeaponOwned && ammoInfo && (
              <div className="mt-4 pt-4 border-t border-military-steel">
                <div className="flex justify-between text-xs text-military-steel mb-1">
                  <span>Ammo remaining today</span>
                  <span className="text-white font-bold">{ammoInfo.remaining}/{ammoInfo.dailyAmmo}</span>
                </div>
                <div className="h-2 bg-military-darker border border-military-steel mb-3">
                  <div className="h-full bg-military-tan" style={{ width: `${(ammoInfo.remaining / ammoInfo.dailyAmmo) * 100}%` }} />
                </div>
                {ammoInfo.remaining < ammoInfo.dailyAmmo && (
                  <div className="flex gap-2">
                    <button onClick={() => refillAmmo("ad")} disabled={ammoLoading} className="btn-military text-xs flex-1 py-1">
                      {ammoLoading ? "..." : "Watch ad (+5%)"}
                    </button>
                    <button onClick={() => refillAmmo("diamond")} disabled={ammoLoading || diamond < 40} className="btn-gold text-xs flex-1 py-1">
                      {ammoLoading ? "..." : <><CurrencyCost currency="diamond" amount={40} /> — Refill 100%</>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isWeaponOwned && (
              <div className="mt-4 pt-4 border-t border-military-steel/30 relative">
                <h3 className="text-xs uppercase tracking-wider text-military-tan mb-2">Weapon Upgrade — {selectedWeapon.name} only</h3>
                <p className="text-xs text-military-steel mb-2">Permanent, uncapped damage upgrade. Independent per weapon — never touches any other weapon's own level.</p>
                {(() => {
                  const level = weaponUpgradeLevels[selectedWeapon.id] ?? 0;
                  const currentDamage = getUpgradedBaseDamage(selectedWeapon.damage, level);
                  const nextDamage = getUpgradedBaseDamage(selectedWeapon.damage, level + 1);
                  const cost = getWeaponUpgradeCost(level);
                  const canAfford = coin >= cost;
                  return (
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="bg-military-darker p-2 border border-military-steel">
                        <div className="text-xs text-military-steel">LEVEL</div>
                        <div className="text-white font-bold">Lv.{level}</div>
                      </div>
                      <div className="bg-military-darker p-2 border border-military-steel">
                        <div className="text-xs text-military-steel">CURRENT DAMAGE</div>
                        <div className="text-white font-bold">{currentDamage}</div>
                      </div>
                      <div className="bg-military-darker p-2 border border-emerald-600">
                        <div className="text-xs text-military-steel">NEXT DAMAGE</div>
                        <div className="text-emerald-400 font-bold">{nextDamage}</div>
                      </div>
                      <button
                        onClick={() => upgradeWeapon(selectedWeapon.id)}
                        disabled={weaponUpgradeLoading || !canAfford}
                        className={`btn-military text-xs px-4 py-2 ${!canAfford ? "opacity-40 grayscale cursor-not-allowed" : ""}`}
                      >
                        {weaponUpgradeLoading
                          ? "..."
                          : canAfford
                            ? `UPGRADE — 🪙 ${cost.toLocaleString()}`
                            : `NOT ENOUGH COIN — 🪙 ${cost.toLocaleString()}`}
                      </button>
                    </div>
                  );
                })()}

                {weaponUpgradeSuccess && (
                  <div className="absolute inset-0 flex items-center justify-center bg-military-darker/90 animate-[pvp-pay-flourish_0.9s_ease-out]">
                    <div className="text-center">
                      <p className="text-emerald-400 font-black text-lg uppercase tracking-widest">Weapon Upgrade Success!</p>
                      <p className="text-military-gold font-bold text-2xl">+{weaponUpgradeSuccess.damageGained} DMG</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "passive" && (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(PASSIVE_LABELS) as PassiveId[]).map((passiveId) => {
            const currentTier = playerPassives.find((p) => p.passiveId === passiveId)?.currentTier ?? 0;
            const nextConfig = props.passiveConfigs.find((c) => c.passiveId === passiveId && c.tier === currentTier + 1);
            const maxed = currentTier >= 10;
            // v13: show the ACTUAL current bonus (sum of every tier already bought),
            // not just the tier number — this is the real % already applied to stats.
            const currentBonusPercent = props.passiveConfigs
              .filter((c) => c.passiveId === passiveId && c.tier <= currentTier)
              .reduce((sum, c) => sum + c.bonusPercent, 0);

            return (
              <div key={passiveId} className="card-military">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold">{PASSIVE_LABELS[passiveId]}</h3>
                  <span className="text-xs text-military-steel">Tier {currentTier}/10</span>
                </div>
                <p className="text-military-gold text-sm font-bold mb-2">Current bonus: +{currentBonusPercent}%</p>
                <div className="h-2 bg-military-darker border border-military-steel mb-3">
                  <div className="h-full bg-military-tan" style={{ width: `${(currentTier / 10) * 100}%` }} />
                </div>
                {maxed ? (
                  <span className="text-green-400 text-xs font-bold">MAX TIER</span>
                ) : nextConfig ? (
                  <button onClick={() => upgradePassive(passiveId)} disabled={loading} className="btn-military text-xs w-full py-1">
                    {loading ? "..." : <>+{nextConfig.bonusPercent}% — <CurrencyCost currency={nextConfig.currency} amount={nextConfig.cost} /></>}
                  </button>
                ) : (
                  <span className="text-military-steel text-xs">Not configured</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "perks" && (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERK_ORDER.map((perkId) => {
            const def = PERKS[perkId];
            const owned = perks[PERK_FIELD_NAME[perkId]];
            const theme = PERK_THEME[perkId];
            return (
              <div
                key={perkId}
                className="rounded-lg border p-4 relative overflow-hidden"
                style={{
                  borderColor: owned ? theme.glow : "#4a4e69",
                  background: `linear-gradient(135deg, ${theme.from}, #0f0f1a 70%)`,
                  boxShadow: owned ? `0 0 16px ${theme.glow}55` : undefined,
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span style={{ filter: owned ? `drop-shadow(0 0 6px ${theme.glow})` : undefined }}><Icon name={PERK_ICON[perkId]} size={52} /></span>
                  <div className="flex-1">
                    <h3 className="font-black uppercase tracking-wide">{def.name}</h3>
                    {owned && <span className="text-emerald-400 text-xs font-bold inline-flex items-center gap-1"><Icon name="check" size={12} /> OWNED</span>}
                  </div>
                </div>
                <p className="text-xs text-military-steel mb-4 leading-relaxed">{def.description}</p>
                {owned ? (
                  <div className="text-center text-emerald-400 text-xs font-bold uppercase tracking-widest py-1.5 border border-emerald-400/40 rounded">Unlocked</div>
                ) : (
                  <button
                    onClick={() => purchasePerk(perkId)}
                    disabled={loading || ticket < def.cost}
                    className="btn-gold text-xs w-full py-1.5"
                  >
                    {loading ? "..." : <CurrencyCost currency="ticket" amount={def.cost} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
