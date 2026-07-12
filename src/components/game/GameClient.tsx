"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { StageData } from "@/types/stage";
import type { EnemySpawn } from "@/types/enemy";
import type { CombatLoadout } from "@/types/loadout";
import { getControlScheme } from "@/lib/controlScheme";

export default function GameClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const stageId = searchParams.get("stage") ?? "stage01";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    async function initGame() {
      try {
        // Fetch stage/enemy/loadout data and dynamically import Phaser + scenes
        // in parallel — they don't depend on each other, so there's no reason
        // to wait for the network round-trip before starting the JS chunk loads.
        const [startRes, PhaserModule, BootSceneModule, PreloadSceneModule, GameSceneModule, HUDSceneModule, GameOverSceneModule, PauseSceneModule, AmmoRefillSceneModule, gameConfigModule] = await Promise.all([
          fetch("/api/game/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stageId }),
          }).then((r) => r.json()),
          import("phaser"),
          import("@/game/scenes/BootScene"),
          import("@/game/scenes/PreloadScene"),
          import("@/game/scenes/GameScene"),
          import("@/game/scenes/HUDScene"),
          import("@/game/scenes/GameOverScene"),
          import("@/game/scenes/PauseScene"),
          import("@/game/scenes/AmmoRefillScene"),
          import("../../../config/game"),
        ]);

        if (!startRes.success) {
          setError(startRes.error ?? "Cannot start game");
          setLoading(false);
          return;
        }

        if (cancelled) return;

        const stageData: StageData = startRes.stageData;
        const enemies: EnemySpawn[] = startRes.enemies;
        const enemyRoster = startRes.enemyRoster;
        const covers: { coverType: string; x: number; y: number }[] = startRes.covers ?? [];
        const character: CombatLoadout = startRes.character;
        const weaponId: string = startRes.weaponId;

        const Phaser = PhaserModule.default;
        const { BootScene } = BootSceneModule;
        const { PreloadScene } = PreloadSceneModule;
        const { GameScene } = GameSceneModule;
        const { HUDScene } = HUDSceneModule;
        const { GameOverScene } = GameOverSceneModule;
        const { PauseScene } = PauseSceneModule;
        const { AmmoRefillScene } = AmmoRefillSceneModule;
        const { GAME_CONFIG } = gameConfigModule;

        if (cancelled || !containerRef.current) return;

        // v9 #6 / v13 fix: mobile is real touch hardware AND a phone-sized
        // viewport — a touch-capable laptop/tablet in a wide window must
        // never get the joystick UI. Checking innerWidth alone broke this on
        // real phones: this game is landscape-only, and a phone rotated to
        // landscape commonly reports innerWidth well over 768 (e.g. ~930 on
        // an iPhone 14 Pro Max) while innerHeight stays small — so the
        // joystick silently never appeared on an actual phone. Checking the
        // SMALLER of the two dimensions makes the check orientation-independent.
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
          // 3 active pointers so the move joystick, aim joystick, and fire
          // button can all be held down by separate fingers simultaneously.
          input: { activePointers: 3 },
          physics: {
            default: "arcade",
            arcade: { gravity: { x: 0, y: 0 }, debug: GAME_CONFIG.physics.debug },
          },
          scene: [BootScene, PreloadScene, GameScene, HUDScene, GameOverScene, PauseScene, AmmoRefillScene],
        });

        game.registry.set("isMobile", isMobile);
        game.registry.set("mobileControlScheme", getControlScheme());
        game.registry.set("stageData", stageData);
        game.registry.set("stageId", stageId);
        game.registry.set("enemySpawns", enemies);
        game.registry.set("enemyRoster", enemyRoster);
        game.registry.set("stageCovers", covers);
        game.registry.set("character", character);
        game.registry.set("onGameEnd", async (result: { kills: number; deaths: number; timeTaken: number; score: number; killCoin: number; completed: boolean; ammoUsed: number; farmWaveReached?: number }) => {
          await fetch("/api/game/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stageId, weaponId, ...result }),
          });
        });
        game.registry.set("onExitToHome", () => {
          // Explicit exit destroys the Phaser instance immediately and clears the
          // ref so the effect cleanup below (which also runs on unmount) doesn't
          // try to destroy an already-destroyed game.
          gameRef.current?.destroy(true);
          gameRef.current = null;
          router.push("/home");
        });
        game.registry.set("onRetry", () => {
          // Bumping retryKey re-runs this whole effect, which destroys the old
          // Phaser instance and calls /api/game/start again from scratch — this
          // is what makes Retry read fresh remaining ammo instead of replaying a
          // stale client-side snapshot from before the failed attempt.
          gameRef.current?.destroy(true);
          gameRef.current = null;
          setRetryKey((k) => k + 1);
        });

        gameRef.current = game;
        setLoading(false);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
        setLoading(false);
      }
    }

    initGame();

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [stageId, router, retryKey]);

  if (error) {
    return (
      <div className="min-h-screen bg-military-darker flex items-center justify-center">
        <div className="card-military text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button onClick={() => router.push("/home")} className="btn-military">Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-military-darker flex items-center justify-center overflow-hidden">
      {loading && (
        <div className="absolute flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-military-steel border-t-military-tan rounded-full animate-spin" />
          <span className="text-military-tan text-sm tracking-widest">LOADING MISSION...</span>
        </div>
      )}
      {/* w-full h-full gives Phaser's Scale.FIT manager a real box to fit the
       *  960x540 canvas into — without it the container just shrink-wraps the
       *  canvas and FIT never has anything smaller to scale down to. */}
      <div id="game-container" ref={containerRef} className={`w-full h-full ${loading ? "hidden" : ""}`} />
    </div>
  );
}
