import type { TutorialScene } from "./TutorialScene";
import { PERKS, PERK_ORDER, type PerkId } from "@/lib/perks";

/** Every highlight now resolves to a single screen-space rect — "world"
 *  positions (character/enemy/tree) are converted through the camera's
 *  worldView so the highlight still lines up correctly at any zoom level or
 *  camera scroll position, same coordinate space as the "screen" (fixed HUD
 *  element) ones. Unifying the two into one shape is what let TutorialScene's
 *  overlay code stop caring which kind a step is. */
export type IntroHighlight =
  | { kind: "rect"; getRect: (scene: TutorialScene) => { x: number; y: number; w: number; h: number } }
  | { kind: "none" };

/** v53: the guide is PURE explanation now — every gameplay control (move,
 *  shoot, reload, swap, perk) stays locked for the entire guide, every step,
 *  no exceptions. Earlier this let a couple of steps unlock one control to
 *  "try it now," but that's exactly what kept breaking (a real shot fired
 *  while transitioning steps, requireAction leaving Next stuck disabled) —
 *  per explicit request, all of that is gone. Real hands-on practice
 *  (actually moving/shooting/reloading/hiding) only starts AFTER the guide
 *  ends, via the pre-existing MOVE/SHOOT/RELOAD/KILL_ENEMY/STEALTH/
 *  FREE_COMBAT state machine below — unchanged, and not part of the guide. */
export type ControlKind = "move" | "shoot" | "reload" | "swap" | "perk";

export interface IntroStep {
  id: string;
  title: string;
  getDescription: (scene: TutorialScene) => string;
  getHighlight: (scene: TutorialScene) => IntroHighlight;
  /** Only set on the 6 generated perk sub-steps — lets TutorialScene know to
   *  keep the simulated perk button overlay up across the whole run of them
   *  and which one to visually emphasize. */
  perkId?: PerkId;
}

/** Screen-space layout math mirrored from HUDScene's own button/bar
 *  positions (createReloadButton/stackedButtonPosition/updateMiniMap/etc.) —
 *  kept in sync manually since HUDScene doesn't expose these as public
 *  getters. If HUDScene's layout ever changes, these must be updated too. */
function reloadButtonRect(scene: TutorialScene) {
  const { width, height } = scene.cameras.main;
  const isMobile = Boolean(scene.registry.get("isMobile"));
  const isJoystick = scene.registry.get("mobileControlScheme") !== "split";
  const radius = 30;
  const raised = isMobile && isJoystick;
  const cx = raised ? width - 130 : width - 56;
  const cy = raised ? height - 210 - radius - 14 : height - 56;
  return { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
}

function stackedCircleRect(scene: TutorialScene, stackIndex: number) {
  const { width, height } = scene.cameras.main;
  const isMobile = Boolean(scene.registry.get("isMobile"));
  const isJoystick = scene.registry.get("mobileControlScheme") !== "split";
  const radius = 30;
  const raised = isMobile && isJoystick;
  const cx = raised ? width - 130 : width - 56;
  const reloadCy = raised ? height - 210 - radius - 14 : height - 56;
  const cy = reloadCy - (stackIndex + 1) * (radius * 2 + 14);
  return { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
}

function perkStatusIconRect(stackIndex: number) {
  // width is read at draw time by the caller (needs the scene) — this
  // returns just the y/size, x is always pinned to the right edge.
  const y = 118 + stackIndex * 34;
  return { yOffset: y, w: 130, h: 30 };
}

function minimapRect(scene: TutorialScene) {
  const isMobile = Boolean(scene.registry.get("isMobile"));
  return { x: 10, y: 96, w: isMobile ? 90 : 140, h: isMobile ? 65 : 100 };
}

function hpRect(scene: TutorialScene) {
  return { x: 8, y: 4, w: 210, h: 58 };
}

function ammoRect(scene: TutorialScene) {
  return { x: 8, y: 24, w: 240, h: 20 };
}

function objectiveRect(scene: TutorialScene) {
  const { width } = scene.cameras.main;
  return { x: width / 2 - 150, y: 6, w: 300, h: 26 };
}

function missionStatsRect(scene: TutorialScene) {
  const { width } = scene.cameras.main;
  // KILLS (y=10) and SCORE (y=28) are both right-aligned text ending at
  // x=width-10 — widened/heightened versus the first pass, which was
  // clipping the bottom of the SCORE line.
  return { x: width - 140, y: 2, w: 130, h: 46 };
}

function pauseButtonRect(scene: TutorialScene) {
  const { width } = scene.cameras.main;
  return { x: width - 102, y: 48, w: 96, h: 32 };
}

// Move stick: center (130, height-130), base radius 80 (see MobileControls.ts
// moveCenter/moveBaseRadius at default scale 1) — bounding box is exactly
// [50, height-210] to [210, height-50].
function joystickRect(scene: TutorialScene) {
  const { height } = scene.cameras.main;
  const isMobile = Boolean(scene.registry.get("isMobile"));
  if (!isMobile) return { x: 0, y: 0, w: scene.cameras.main.width / 2, h: height };
  return { x: 50, y: height - 210, w: 160, h: 160 };
}

// Fire stick: center (width-130, height-130), same 80 base radius.
function shootZoneRect(scene: TutorialScene) {
  const { width, height } = scene.cameras.main;
  const isMobile = Boolean(scene.registry.get("isMobile"));
  if (!isMobile) return { x: width / 2, y: 0, w: width / 2, h: height };
  const isJoystick = scene.registry.get("mobileControlScheme") !== "split";
  return isJoystick ? { x: width - 210, y: height - 210, w: 160, h: 160 } : { x: width / 2, y: 0, w: width / 2, h: height };
}

/** v54: short teaching-blurb PER perk, separate from perks.ts's full catalog
 *  description — that full text (2-3 sentences plus a cost line) wrapped to
 *  5-6 lines at the guide's enlarged font and spilled straight through the
 *  Next/Previous/Skip row. These stay to 1 short sentence + cost. */
const PERK_INTRO_BLURB: Record<PerkId, string> = {
  spare_weapon: "Adds a second weapon slot — swap between them mid-fight with a SWAP button.",
  regen: "Automatic: instantly heals to full the moment your HP drops below 20%.",
  super_shield: "Automatic: refills your shield to half if it stays empty for 15 seconds straight.",
  one_shot: "A skull button that arms one massive-damage shot on demand.",
  invisible: "Automatic: turns you invisible to enemies for 2s every 15s, all match long.",
  never_died: "Automatic: the first fatal hit instead locks your HP at 1 and grants 3s of invincibility.",
};

/** One entry per catalog perk (see src/lib/perks.ts) — TutorialScene shows
 *  ALL 6 simulated buttons/icons together the moment the first of these
 *  steps begins (regardless of what's actually owned, since this is a pure
 *  teaching aid), individually emphasizing whichever one is currently being
 *  explained, and tears the whole simulation down the moment the LAST one
 *  advances into the next step. */
const PERK_STEPS: IntroStep[] = PERK_ORDER.map((perkId, i) => {
  const def = PERKS[perkId];
  const isCircleStyle = perkId === "spare_weapon" || perkId === "one_shot";
  const circleStackIndex = perkId === "spare_weapon" ? 0 : perkId === "one_shot" ? 1 : -1;
  const statusStackIndex = ["regen", "super_shield", "invisible", "never_died"].indexOf(perkId);

  return {
    id: `perk_${perkId}`,
    title: `Perk: ${def.name}`,
    getDescription: () => `${PERK_INTRO_BLURB[perkId]} Costs ${def.cost.toLocaleString()} tickets (Character page's Perks tab).`,
    getHighlight: (scene) => {
      if (isCircleStyle) {
        const r = stackedCircleRect(scene, circleStackIndex);
        return { kind: "rect", getRect: () => r };
      }
      const { width } = scene.cameras.main;
      const { yOffset, w, h } = perkStatusIconRect(statusStackIndex);
      return { kind: "rect", getRect: () => ({ x: width - 10 - w, y: yOffset - 4, w, h }) };
    },
    perkId,
  } satisfies IntroStep;
});

/** Data-driven guided walkthrough, shown once before the existing hands-on
 *  tutorial (MOVE/SHOOT/RELOAD/KILL_ENEMY/STEALTH/FREE_COMBAT) starts. Adding,
 *  removing, or reordering a step is just editing this array — TutorialScene's
 *  controller code (Next/Previous/Skip/step-counter/highlight/control-lock
 *  machinery) never needs to change. */
export const INTRO_STEPS: IntroStep[] = [
  {
    id: "character",
    title: "Your Character",
    getDescription: () => "This is your character. You'll use the controls below to move around, fight off enemies, and clear the stage.",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => worldToScreenRect(scene, scene.player.sprite.x, scene.player.sprite.y, 42) }),
  },
  {
    id: "hp_ammo",
    title: "HP & Ammo",
    getDescription: () => "Top-left shows your current HP and how much ammo is left in your magazine (plus your total ammo reserve for today).",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => ({ ...hpRect(scene) }) }),
  },
  {
    id: "objective",
    title: "Objective",
    getDescription: () => "The top-center line always tells you the current goal for this stage — right now, eliminating every enemy.",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => objectiveRect(scene) }),
  },
  {
    id: "mission",
    title: "Kills & Score",
    getDescription: () => "Top-right tracks your kill count and score for the run, updated live as you fight.",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => missionStatsRect(scene) }),
  },
  {
    id: "enemy",
    title: "Enemy",
    getDescription: () => "This is an enemy. Watch out — don't let them hit you!",
    getHighlight: (scene) => scene.introEnemy
      ? { kind: "rect", getRect: () => worldToScreenRect(scene, scene.introEnemy!.sprite.x, scene.introEnemy!.sprite.y, 36) }
      : { kind: "none" },
  },
  {
    id: "movement",
    title: "Movement",
    getDescription: (scene) => Boolean(scene.registry.get("isMobile"))
      ? "Touch and drag on the LEFT half of the screen to walk, run, and dodge enemy attacks."
      : "Use WASD or the arrow keys to walk, run, and dodge enemy attacks.",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => joystickRect(scene) }),
  },
  {
    id: "shooting",
    title: "Shooting",
    getDescription: (scene) => Boolean(scene.registry.get("isMobile"))
      ? "Tap and hold on the RIGHT half of the screen to aim and fire at that spot."
      : "Click (or hold) the left mouse button to aim and fire.",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => shootZoneRect(scene) }),
  },
  {
    id: "reload",
    title: "Reload",
    getDescription: (scene) => Boolean(scene.registry.get("isMobile"))
      ? "This is your RELOAD button. Firing blocks while you reload, and it always refills to a full magazine."
      : "This is your RELOAD button — press R (or click it) to refill your magazine. Firing blocks while reloading.",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => reloadButtonRect(scene) }),
  },
  ...PERK_STEPS,
  {
    id: "minimap",
    title: "Mini Map",
    getDescription: () => "The mini map shows your position (green) and nearby enemies (red) at a glance — use it to plan your route and spot threats before they spot you.",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => minimapRect(scene) }),
  },
  {
    id: "stealth",
    title: "Stealth",
    getDescription: () => "Standing still near a tree hides you from enemies completely — a great way to break line of sight and plan your next move.",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => worldToScreenRect(scene, scene.treePosition.x, scene.treePosition.y, 50) }),
  },
  {
    id: "exit",
    title: "Pause / Exit",
    getDescription: () => "Use the PAUSE button (top-right) any time to pause, resume, or exit back to the main menu.",
    getHighlight: (scene) => ({ kind: "rect", getRect: () => pauseButtonRect(scene) }),
  },
];

/** Converts a world point (+ a "radius" the highlight should cover) into a
 *  screen-space rect using the camera's current worldView — correct at any
 *  zoom level or scroll position, unlike a fixed-offset screen rect. */
export function worldToScreenRect(scene: TutorialScene, worldX: number, worldY: number, worldRadius: number) {
  const cam = scene.cameras.main;
  const view = cam.worldView;
  const screenX = (worldX - view.x) * cam.zoom;
  const screenY = (worldY - view.y) * cam.zoom;
  const screenR = worldRadius * cam.zoom;
  return { x: screenX - screenR, y: screenY - screenR, w: screenR * 2, h: screenR * 2 };
}
