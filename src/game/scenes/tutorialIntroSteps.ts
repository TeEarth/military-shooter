import type { TutorialScene } from "./TutorialScene";

/** Where to draw the highlight ring for a guided-intro step. "world" follows
 *  a point in the game world (scales/pans correctly with the camera); "screen"
 *  is a fixed rectangle in screen space (for UI elements like buttons). */
export type IntroHighlight =
  | { kind: "world"; getPos: (scene: TutorialScene) => { x: number; y: number } }
  | { kind: "screen"; getRect: (scene: TutorialScene) => { x: number; y: number; w: number; h: number } }
  | { kind: "none" };

export interface IntroStep {
  id: string;
  title: string;
  getDescription: (scene: TutorialScene) => string;
  getHighlight: (scene: TutorialScene) => IntroHighlight;
  /** If this becomes true, the step auto-advances — same as pressing Next,
   *  just so a player who actually tries the action doesn't have to also
   *  click through. Next always works regardless, so nothing here is ever
   *  force-required. */
  autoAdvanceIf?: (scene: TutorialScene) => boolean;
}

/** Data-driven guided walkthrough, shown once before the existing hands-on
 *  tutorial (MOVE/SHOOT/RELOAD/KILL_ENEMY/STEALTH/FREE_COMBAT) starts. Adding,
 *  removing, or reordering a step is just editing this array — TutorialScene's
 *  controller code (the Next/Skip/step-counter/highlight machinery) never
 *  needs to change. */
export const INTRO_STEPS: IntroStep[] = [
  {
    id: "character",
    title: "Your Character",
    getDescription: () => "This is your character. You'll use the controls below to move around, fight off enemies, and clear the stage.",
    getHighlight: (scene) => ({ kind: "world", getPos: () => ({ x: scene.player.sprite.x, y: scene.player.sprite.y }) }),
  },
  {
    id: "enemy",
    title: "Enemy",
    getDescription: () => "This is an enemy. Watch out — don't let them hit you!",
    getHighlight: (scene) => scene.introEnemy
      ? { kind: "world", getPos: () => ({ x: scene.introEnemy!.sprite.x, y: scene.introEnemy!.sprite.y }) }
      : { kind: "none" },
  },
  {
    id: "movement",
    title: "Movement",
    getDescription: () => "Touch and drag on the LEFT half of the screen to walk, run, and dodge enemy attacks. (Desktop: WASD or arrow keys.)",
    getHighlight: () => ({ kind: "screen", getRect: (scene) => ({ x: 0, y: 0, w: scene.cameras.main.width / 2, h: scene.cameras.main.height }) }),
  },
  {
    id: "shooting",
    title: "Shooting",
    getDescription: () => "Tap anywhere on the RIGHT half of the screen to aim and fire at that spot. Try firing a shot now!",
    getHighlight: () => ({ kind: "screen", getRect: (scene) => ({ x: scene.cameras.main.width / 2, y: 0, w: scene.cameras.main.width / 2, h: scene.cameras.main.height }) }),
    autoAdvanceIf: (scene) => scene.shotFiredThisStep,
  },
  {
    id: "reload",
    title: "Reload",
    getDescription: () => "Press the RELOAD button (or R on desktop) to refill your magazine. You can't fire while reloading. Try it now!",
    getHighlight: () => ({ kind: "screen", getRect: (scene) => ({ x: scene.cameras.main.width - 90, y: scene.cameras.main.height - 90, w: 64, h: 64 }) }),
    autoAdvanceIf: (scene) => scene.wasReloading && !scene.player.isReloading,
  },
  {
    id: "perks",
    title: "Perks",
    getDescription: (scene) => {
      const perks = scene.registry.get("perks") as { spareWeapon?: boolean; regen?: boolean; superShield?: boolean; oneShot?: boolean } | undefined;
      const owned = perks && (perks.spareWeapon || perks.regen || perks.superShield || perks.oneShot);
      return owned
        ? "Perks are special abilities, each with its own button here. Every perk works differently — use them at the right moment to turn a fight in your favor."
        : "Perks are special abilities you can buy with tickets from the Character page. Once owned, each one gets its own button right here on the HUD.";
    },
    getHighlight: (scene) => {
      const perks = scene.registry.get("perks") as { spareWeapon?: boolean; regen?: boolean; superShield?: boolean; oneShot?: boolean } | undefined;
      const owned = perks && (perks.spareWeapon || perks.regen || perks.superShield || perks.oneShot);
      if (!owned) return { kind: "none" };
      return { kind: "screen", getRect: (s) => ({ x: s.cameras.main.width - 90, y: s.cameras.main.height - 160, w: 64, h: 64 }) };
    },
  },
  {
    id: "minimap",
    title: "Mini Map",
    getDescription: () => "The mini map shows your position and nearby enemies at a glance — use it to plan your route and spot threats before they spot you.",
    getHighlight: () => ({ kind: "screen", getRect: () => ({ x: 8, y: 92, w: 140, h: 104 }) }),
  },
  {
    id: "stealth",
    title: "Stealth",
    getDescription: () => "Standing still near a tree hides you from enemies completely. Try walking up to the tree and staying still for a second!",
    getHighlight: (scene) => ({ kind: "world", getPos: () => ({ x: scene.treePosition.x, y: scene.treePosition.y }) }),
    autoAdvanceIf: (scene) => scene.isHidden,
  },
  {
    id: "exit",
    title: "Pause / Exit",
    getDescription: () => "Use the PAUSE button (top-right) any time to pause, resume, or exit back to the main menu.",
    getHighlight: () => ({ kind: "screen", getRect: (scene) => ({ x: scene.cameras.main.width - 76, y: 16, w: 66, h: 60 }) }),
  },
];
