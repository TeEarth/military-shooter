"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sfx } from "@/lib/sfx";

const MUTED_KEY = "sfx_muted";
const VOLUME_KEY = "sfx_volume";

/** Plays the menu/lobby background track on every screen except the actual
 *  game canvas (/game — PvE, PvP, Tutorial all mount there), where GameScene/
 *  PvpScene/TutorialScene already run their own battle music via
 *  sfx.startMusicLoop(). Mounted once in the root layout so it survives
 *  client-side navigation between lobby pages without restarting the track. */
export default function LobbyMusic() {
  const pathname = usePathname();

  // Settings page is the only other place that restores the saved mute/volume
  // prefs — do it here too so lobby music (and everything else) respects them
  // immediately on first load, not just after a visit to /settings.
  useEffect(() => {
    const savedMuted = localStorage.getItem(MUTED_KEY) === "true";
    const savedVolume = Number(localStorage.getItem(VOLUME_KEY) ?? "0.6");
    sfx.setMuted(savedMuted);
    sfx.setVolume(savedVolume);
  }, []);

  useEffect(() => {
    const inStage = pathname?.startsWith("/game");
    if (inStage) sfx.stopLobbyMusic();
    else sfx.startLobbyMusic();
  }, [pathname]);

  // Only fires if this component is ever actually removed from the tree —
  // it lives in the root layout so that doesn't happen during normal
  // navigation, but stop cleanly just in case.
  useEffect(() => () => sfx.stopLobbyMusic(), []);

  return null;
}
