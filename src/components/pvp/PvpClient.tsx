"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { getControlScheme, getZoomLevel } from "@/lib/controlScheme";

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

  // Live handles for the search-phase poll/subscription, so cancelSearch (and
  // unmount) can actually tear them down — without this, cancelling would
  // leave the poll running, which now re-POSTs into the queue every tick and
  // would silently un-cancel the player a few seconds later.
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  function stopSearching() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (channelRef.current) {
      getBrowserSupabaseClient().removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      stopSearching();
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
      game.registry.set("mobileControlScheme", getControlScheme());
      game.registry.set("zoomLevel", getZoomLevel());
      game.registry.set("stageData", startRes.stageData);
      game.registry.set("pvpMatchId", startRes.matchId);
      game.registry.set("pvpIsPlayer1", startRes.isPlayer1);
      game.registry.set("pvpOpponent", startRes.opponent);
      game.registry.set("pvpOpponentSpawn", startRes.opponentSpawn);
      game.registry.set("pvpMyId", playerId);
      game.registry.set("character", startRes.character);
      game.registry.set("weaponId", startRes.weaponId);
      game.registry.set("perks", startRes.perks);
      game.registry.set("spareLoadout", startRes.spareLoadout);
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
      // v29 fix: the topic used to be a fixed `pvp-lobby-${playerId}`, so
      // cancelling and searching again quickly could call `.channel()` with
      // the SAME topic before the previous channel's removeChannel() had
      // actually finished unsubscribing — supabase-js returns the cached,
      // already-subscribed channel object for a topic still in its registry,
      // and calling `.on()` on an already-subscribed channel throws "cannot
      // add postgres_changes callbacks ... after subscribe()". A unique
      // topic per search attempt guarantees a fresh channel object every time.
      const supabase = getBrowserSupabaseClient();
      const channel = supabase
        .channel(`pvp-lobby-${playerId}-${Date.now()}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "pvp_matches", filter: `player1_id=eq.${playerId}` }, (payload) => {
          startMatch((payload.new as PvpMatch).id);
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "pvp_matches", filter: `player2_id=eq.${playerId}` }, (payload) => {
          startMatch((payload.new as PvpMatch).id);
        })
        .subscribe();
      channelRef.current = channel;

      // Covers two races: (1) a match was created between the POST above and
      // the subscription actually going live, and (2) joinQueue's own
      // check-then-act race — if two players call POST /api/pvp/queue within
      // the same instant, both can see "nobody waiting" before either insert
      // commits, so both just sit in the queue forever with no match ever
      // created. Re-POSTing (not just GETting) on every tick is what recovers
      // from that: joinQueue() is idempotent for an already-matched or
      // still-waiting player, and by the next tick the other player's row
      // will actually be visible, so this pairs them. Stored in a ref (not a
      // local closure return value) so cancelSearch/unmount can actually stop
      // it — a plain onClick handler's return value is never awaited as a
      // cleanup function the way a useEffect's is.
      pollTimerRef.current = setInterval(async () => {
        const check = await fetch("/api/pvp/queue", { method: "POST" }).then((r) => r.json());
        if (check.match) {
          stopSearching();
          await startMatch(check.match.id);
        }
      }, 3000);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  async function cancelSearch() {
    stopSearching();
    await fetch("/api/pvp/queue", { method: "DELETE" }).catch(() => {});
    setPhase("idle");
  }

  // v25 fix: the game container must ALWAYS be mounted, not just when
  // phase === "playing" — startMatch() needs containerRef.current to exist
  // the moment it finishes loading (while phase is still "loading"), but a
  // conditionally-rendered div only appears on the render AFTER setPhase
  // ("playing") already ran. That chicken-and-egg gap meant containerRef was
  // always null, the `if (!containerRef.current) return;` guard always fired,
  // and PvP got stuck on "Opponent found — loading match..." forever. Now the
  // container is always in the DOM (empty until Phaser attaches to it) and
  // the phase-specific menu/status UI is an overlay on top of it instead.
  return (
    <div className="w-screen h-screen bg-military-darker relative overflow-hidden">
      {/* v25: EXIT now lives inside the Phaser HUD itself (HUDScene's
          createExitButton), styled identically to the single-player PAUSE
          button in the same corner/position — a plain DOM button here never
          matched the rest of the in-game chrome. */}
      <div id="pvp-container" ref={containerRef} className="w-full h-full" />

      {phase !== "playing" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="card-military max-w-sm w-full text-center space-y-4">
            <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">PvP Arena</h1>
            <p className="text-military-steel text-sm">Playing as {username}</p>

            {phase === "idle" && (
              <div className="space-y-3">
                <p className="text-military-steel text-xs">Entry: 5 🎟️ (charged only once matched) · Win: +10 🎟️ · Loss: +10 💎</p>
                <button onClick={findMatch} className="btn-gold w-full py-3">FIND MATCH</button>
              </div>
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
                <div className="text-4xl animate-[pvp-pay-flourish_0.9s_ease-out]">🎟️</div>
                <p className="text-military-tan text-sm font-bold">-5 tickets</p>
                <p className="text-military-steel text-sm">Opponent found — loading match...</p>
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
      )}
    </div>
  );
}
