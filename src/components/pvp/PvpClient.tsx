"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

interface PvpMatch {
  id: string;
  player1Id: string;
  player2Id: string;
  status: string;
  winnerId: string | null;
  createdAt: string;
}

type Phase = "idle" | "searching" | "loading" | "playing" | "error";

export default function PvpClient({ playerId, username }: { playerId: string; username: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");

  // Guards against acting on a match twice (once from the immediate queue
  // response, once from the Realtime notification racing in right after).
  const handledMatchId = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  async function startMatch(matchId: string) {
    if (handledMatchId.current === matchId) return;
    handledMatchId.current = matchId;
    setPhase("loading");

    try {
      const [startRes, PhaserModule, BootSceneModule, PreloadSceneModule, PvpSceneModule, HUDSceneModule, PvpOverSceneModule, gameConfigModule] = await Promise.all([
        fetch("/api/pvp/match/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId }),
        }).then((r) => r.json()),
        import("phaser"),
        import("@/game/scenes/BootScene"),
        import("@/game/scenes/PreloadScene"),
        import("@/game/scenes/PvpScene"),
        import("@/game/scenes/HUDScene"),
        import("@/game/scenes/PvpOverScene"),
        import("../../../config/game"),
      ]);

      if (!startRes.success) {
        setError(startRes.error ?? "Could not start match");
        setPhase("error");
        return;
      }

      const Phaser = PhaserModule.default;
      const { BootScene } = BootSceneModule;
      const { PreloadScene } = PreloadSceneModule;
      const { PvpScene } = PvpSceneModule;
      const { HUDScene } = HUDSceneModule;
      const { PvpOverScene } = PvpOverSceneModule;
      const { GAME_CONFIG } = gameConfigModule;

      if (!containerRef.current) return;

      const isMobile = ("ontouchstart" in window || navigator.maxTouchPoints > 0) && Math.min(window.innerWidth, window.innerHeight) < 500;

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: GAME_CONFIG.width,
        height: GAME_CONFIG.height,
        backgroundColor: GAME_CONFIG.backgroundColor,
        parent: containerRef.current,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: GAME_CONFIG.width,
          height: GAME_CONFIG.height,
        },
        input: { activePointers: 3 },
        physics: {
          default: "arcade",
          arcade: { gravity: { x: 0, y: 0 }, debug: GAME_CONFIG.physics.debug },
        },
        scene: [BootScene, PreloadScene, PvpScene, HUDScene, PvpOverScene],
      });

      game.registry.set("isMobile", isMobile);
      game.registry.set("stageData", startRes.stageData);
      game.registry.set("pvpMatchId", startRes.matchId);
      game.registry.set("pvpIsPlayer1", startRes.isPlayer1);
      game.registry.set("pvpOpponent", startRes.opponent);
      game.registry.set("pvpOpponentSpawn", startRes.opponentSpawn);
      game.registry.set("pvpMyId", playerId);
      game.registry.set("character", startRes.character);
      game.registry.set("weaponId", startRes.weaponId);
      game.registry.set("enemySpawns", []);
      game.registry.set("enemyRoster", []);

      gameRef.current = game;
      setPhase("playing");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  async function findMatch() {
    setError("");
    setPhase("searching");
    try {
      const res = await fetch("/api/pvp/queue", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Could not join queue");
        setPhase("error");
        return;
      }

      if (data.match) {
        await startMatch(data.match.id);
        return;
      }

      // Still waiting — listen for the match Realtime will insert for us.
      const supabase = getBrowserSupabaseClient();
      const channel = supabase
        .channel(`pvp-lobby-${playerId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "pvp_matches", filter: `player1_id=eq.${playerId}` }, (payload) => {
          startMatch((payload.new as PvpMatch).id);
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "pvp_matches", filter: `player2_id=eq.${playerId}` }, (payload) => {
          startMatch((payload.new as PvpMatch).id);
        })
        .subscribe();

      // Covers the race where a match was created between the POST above and
      // the subscription actually going live.
      const pollTimer = setInterval(async () => {
        const check = await fetch("/api/pvp/queue").then((r) => r.json());
        if (check.match) {
          clearInterval(pollTimer);
          supabase.removeChannel(channel);
          await startMatch(check.match.id);
        }
      }, 3000);

      // Cleanup if the component unmounts while still searching.
      return () => {
        clearInterval(pollTimer);
        supabase.removeChannel(channel);
      };
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  async function cancelSearch() {
    await fetch("/api/pvp/queue", { method: "DELETE" }).catch(() => {});
    setPhase("idle");
  }

  if (phase === "playing") {
    return (
      <div className="w-screen h-screen bg-military-darker flex items-center justify-center overflow-hidden">
        <div id="pvp-container" ref={containerRef} className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-military-darker flex items-center justify-center p-6">
      <div className="card-military max-w-sm w-full text-center space-y-4">
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">PvP Arena</h1>
        <p className="text-military-steel text-sm">Playing as {username}</p>

        {phase === "idle" && (
          <button onClick={findMatch} className="btn-gold w-full py-3">FIND MATCH</button>
        )}

        {phase === "searching" && (
          <div className="space-y-3">
            <div className="w-10 h-10 mx-auto border-2 border-military-steel border-t-military-tan rounded-full animate-spin" />
            <p className="text-military-tan text-sm">Searching for an opponent...</p>
            <button onClick={cancelSearch} className="btn-military w-full py-2 text-xs">CANCEL</button>
          </div>
        )}

        {phase === "loading" && (
          <div className="space-y-3">
            <div className="w-10 h-10 mx-auto border-2 border-military-steel border-t-military-tan rounded-full animate-spin" />
            <p className="text-military-tan text-sm">Opponent found — loading match...</p>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setPhase("idle")} className="btn-military w-full py-2 text-xs">TRY AGAIN</button>
          </div>
        )}

        <button onClick={() => router.push("/home")} className="text-military-steel hover:text-white text-xs">← BACK TO HOME</button>
      </div>
    </div>
  );
}
