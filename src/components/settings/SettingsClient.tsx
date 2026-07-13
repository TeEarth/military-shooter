"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sfx } from "@/lib/sfx";
import { useLanguage } from "@/lib/i18n";
import { getControlScheme, setControlScheme, type ControlScheme } from "@/lib/controlScheme";

interface Props {
  username: string;
  ticket: number;
  vipLevel: number;
  coin: number;
  diamond: number;
  greenBanknote: number;
  heroNames: string[];
  currentStage: number;
  farmStageMaxWave: number;
}

const MUTED_KEY = "sfx_muted";
const VOLUME_KEY = "sfx_volume";

export default function SettingsClient({ username, ticket, vipLevel, coin, diamond, greenBanknote, heroNames, currentStage, farmStageMaxWave }: Props) {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const { language, setLanguage } = useLanguage();
  const [controlScheme, setControlSchemeState] = useState<ControlScheme>("joystick");

  // Restore + apply the saved audio preference on mount — sfx itself defaults
  // to unmuted/0.6 volume, so without this every fresh page load would ignore
  // whatever the player picked last time.
  useEffect(() => {
    const savedMuted = localStorage.getItem(MUTED_KEY) === "true";
    const savedVolume = Number(localStorage.getItem(VOLUME_KEY) ?? "0.6");
    setMuted(savedMuted);
    setVolume(savedVolume);
    sfx.setMuted(savedMuted);
    sfx.setVolume(savedVolume);
    setControlSchemeState(getControlScheme());
  }, []);

  function chooseControlScheme(scheme: ControlScheme) {
    sfx.play("ui_click");
    setControlSchemeState(scheme);
    setControlScheme(scheme);
  }

  function toggleMuted() {
    const next = !muted;
    setMuted(next);
    sfx.setMuted(next);
    localStorage.setItem(MUTED_KEY, String(next));
    if (!next) sfx.play("ui_click");
  }

  function changeVolume(v: number) {
    setVolume(v);
    sfx.setVolume(v);
    localStorage.setItem(VOLUME_KEY, String(v));
  }

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/home" className="text-military-steel hover:text-white text-sm" onClick={() => sfx.play("ui_click")}>← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto space-y-4">
        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-2 uppercase tracking-wider">Profile</h2>
          <p className="text-sm">Username: <span className="text-white">{username}</span></p>
          <p className="text-sm mt-1">VIP tier: <span className="text-military-gold font-bold">VIP {vipLevel}</span></p>
          <div className="grid grid-cols-2 gap-1 mt-2 text-sm">
            <p>🪙 Coin: <span className="text-military-gold font-bold">{coin.toLocaleString()}</span></p>
            <p>💎 Diamond: <span className="text-blue-400 font-bold">{diamond.toLocaleString()}</span></p>
            <p>🎟️ Tickets: <span className="text-green-400 font-bold">{ticket.toLocaleString()}</span></p>
            <p>💵 Green Banknote: <span className="text-emerald-400 font-bold">{greenBanknote.toLocaleString()}</span></p>
          </div>
          <p className="text-sm mt-2">Stage Reached: <span className="text-white font-bold">{currentStage}</span></p>
          <p className="text-sm mt-1">Farm Stage Best Wave: <span className="text-white font-bold">{farmStageMaxWave}</span></p>
          <p className="text-sm mt-1">Heroes Owned: <span className="text-white font-bold">{heroNames.length > 0 ? heroNames.join(", ") : "—"}</span></p>
        </div>

        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-2 uppercase tracking-wider">Audio</h2>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm">Sound Effects</span>
            <button
              onClick={toggleMuted}
              className={`text-xs px-3 py-1 border ${muted ? "border-military-steel text-military-steel" : "btn-military"}`}
            >
              {muted ? "MUTED" : "ON"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-military-steel w-14">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              disabled={muted}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-military-steel w-10 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-2 uppercase tracking-wider">Mobile Controls</h2>
          <p className="text-xs text-military-steel mb-3">Only affects touch devices — pick how aiming/firing works.</p>
          <div className="space-y-2">
            <button
              onClick={() => chooseControlScheme("split")}
              className={`w-full text-left p-3 border text-sm ${controlScheme === "split" ? "border-military-tan bg-military-dark" : "border-military-steel"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">Layout 1 — Tap to aim &amp; fire</span>
                {controlScheme === "split" && <span className="text-military-gold text-xs">✓ ACTIVE</span>}
              </div>
              <p className="text-xs text-military-steel mt-1">
                Touch anywhere on the right half of the screen to aim AND fire at that exact spot. Release to stop.
              </p>
            </button>
            <button
              onClick={() => chooseControlScheme("joystick")}
              className={`w-full text-left p-3 border text-sm ${controlScheme === "joystick" ? "border-military-tan bg-military-dark" : "border-military-steel"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">Layout 2 — Drag to aim &amp; fire</span>
                {controlScheme === "joystick" && <span className="text-military-gold text-xs">✓ ACTIVE</span>}
              </div>
              <p className="text-xs text-military-steel mt-1">
                Drag the bottom-right stick in any direction to aim AND fire that way at the same time (default).
              </p>
            </button>
          </div>
        </div>

        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-2 uppercase tracking-wider">Language</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { sfx.play("ui_click"); setLanguage("en"); }}
              className={language === "en" ? "btn-military text-xs" : "border border-military-steel text-xs px-3 py-1 text-military-steel"}
            >
              English
            </button>
            <button
              onClick={() => { sfx.play("ui_click"); setLanguage("th"); }}
              className={language === "th" ? "btn-military text-xs" : "border border-military-steel text-xs px-3 py-1 text-military-steel"}
            >
              ภาษาไทย
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
