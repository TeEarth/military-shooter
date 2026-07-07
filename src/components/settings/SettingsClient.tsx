"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sfx } from "@/lib/sfx";
import { useLanguage } from "@/lib/i18n";

interface Props {
  username: string;
  ticket: number;
  vipLevel: number;
}

const MUTED_KEY = "sfx_muted";
const VOLUME_KEY = "sfx_volume";

export default function SettingsClient({ username, ticket, vipLevel }: Props) {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const { language, setLanguage } = useLanguage();

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
  }, []);

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
          <p className="text-sm mt-1">Tickets: <span className="text-green-400 font-bold">{ticket}</span></p>
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
