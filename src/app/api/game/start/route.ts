import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, type Player } from "@/lib/db/player";
import { getStageById, getStageEnemies, getStageCovers } from "@/lib/google/stage";
import { getEnemyById, getAllEnemies } from "@/lib/google/enemy";
import { getCharacterById } from "@/lib/google/character";
import { getWeaponById } from "@/lib/google/weapon";
import { getEquippedWeaponId } from "@/lib/db/inventory";
import { getRemainingAmmo } from "@/lib/db/weaponAmmo";
import { isStageCompleted } from "@/lib/db/stageProgress";
import { computeFullStats, statsToLoadout } from "@/lib/stats";
import { parseStageNumber, templateStageId, stageStatMultiplier, extraEnemyCount } from "@/lib/stageTemplate";
import { getBossConfigForEncounter, getBossEncounterCount } from "@/lib/db/bossStage";
import { getCompletedStageIds } from "@/lib/db/stageProgress";
import { buildPerkPayload } from "@/lib/perkPayload";
import { getEquippedSkinColor } from "@/lib/skinColors";

const DEFAULT_WEAPON_ID = "pistol";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stageId } = await req.json();

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (stageId === "boss_next") {
    return startBossStage(player.id);
  }

  if (stageId === "tutorial") {
    return startTutorialStage(player);
  }

  // Story stages loop every 10 numbers (stage 11 reuses stage 1's map, scaled harder)
  // ONLY if no purpose-built Stage row exists for that exact number — a later
  // multiverse's real stage11-20 rows take priority over the modulo reuse.
  // Farm-stage ids (e.g. "farm_01") aren't numeric and skip this resolution entirely.
  const requestedNum = parseStageNumber(stageId);
  let lookupId = stageId;
  if (requestedNum) {
    const exact = await getStageById(stageId);
    lookupId = exact ? stageId : templateStageId(requestedNum);
  }

  const [stage, spawns, covers] = await Promise.all([getStageById(lookupId), getStageEnemies(lookupId), getStageCovers(lookupId)]);
  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

  // v17: placeholder stages (real content not designed yet) aren't playable —
  // matches the disabled state in StageSelectClient, enforced server-side too.
  if (stage.comingSoon) {
    return NextResponse.json({ error: "This stage hasn't been designed yet." }, { status: 400 });
  }

  // v17: Multiverse 2+ is gated behind clearing that many bosses — story
  // progression (currentStage) alone would otherwise let a player walk past
  // the boss fight straight into the next multiverse, since currentStage
  // already advances past 10 the moment stage10 is cleared.
  if (stage.multiverse > 1) {
    const bossEncounterCount = await getBossEncounterCount(player.id);
    if (stage.multiverse > 1 + bossEncounterCount) {
      return NextResponse.json({ error: "Clear the boss stage to unlock this multiverse first." }, { status: 400 });
    }
  }

  // Story stages are one-and-done — once completed, never playable again. Checked
  // against the actual requested stage number/id, not the reused template.
  if (!stage.isRepeatable && (await isStageCompleted(player.id, stageId))) {
    return NextResponse.json({ error: "This stage has already been cleared and cannot be replayed." }, { status: 400 });
  }

  const [character, equippedWeaponId] = await Promise.all([
    getCharacterById(player.currentCharacter),
    getEquippedWeaponId(player.id),
  ]);

  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const weaponId = equippedWeaponId ?? DEFAULT_WEAPON_ID;
  const weapon = await getWeaponById(weaponId);
  if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });

  const stats = await computeFullStats(player.id, character, weapon);
  const remainingAmmo = await getRemainingAmmo(player.id, weaponId, Math.round(stats.dailyAmmo.final));

  if (remainingAmmo <= 0) {
    return NextResponse.json({ error: "Out of ammo for this weapon today. Watch an ad or spend diamonds to refill." }, { status: 400 });
  }

  const multiplier = requestedNum ? stageStatMultiplier(requestedNum) : 1;

  // v12: the stage-layout PDF's stage10 description explicitly calls out that
  // enemy #5 (Rocket) gets 5x its normal HP on that map — tied to the stage10
  // TEMPLATE itself, so every reused instance (stage10, stage20, stage30, ...)
  // gets it too, not just the literal first stage10 playthrough.
  const ROCKET_HP_MULTIPLIER_STAGE = "stage10";
  const rocketHpMultiplier = lookupId === ROCKET_HP_MULTIPLIER_STAGE ? 5 : 1;

  // v25: stage20's own PDF description calls out enemy #10 (Rasor Gun) getting
  // 5x hp and 2x damage on that specific map — same "tied to the template"
  // pattern as stage10's rocket multiplier above.
  const RASOR_BOOST_STAGE = "stage20";
  const rasorHpMultiplier = lookupId === RASOR_BOOST_STAGE ? 5 : 1;
  const rasorDamageMultiplier = lookupId === RASOR_BOOST_STAGE ? 2 : 1;

  const baseEnemies = (
    await Promise.all(
      spawns.map(async (s) => {
        const enemy = await getEnemyById(s.enemyId);
        if (!enemy) return null;
        const enemyWeapon = await getWeaponById(enemy.weaponId);
        if (!enemyWeapon) return null;
        const hpMultiplier = enemy.id === "enemy_rocket" ? rocketHpMultiplier : enemy.id === "enemy_rasor_gun" ? rasorHpMultiplier : 1;
        const specialDamageMultiplier = enemy.id === "enemy_rasor_gun" ? rasorDamageMultiplier : 1;
        return {
          ...enemy,
          hp: Math.round(enemy.hp * multiplier * hpMultiplier),
          weapon: { ...enemyWeapon, damage: Math.round(enemyWeapon.damage * multiplier * enemy.damageMultiplier * specialDamageMultiplier) },
          spawnX: s.spawnX,
          spawnY: s.spawnY,
        };
      })
    )
  ).filter((e) => e !== null);

  // Difficulty tiers (every 10 stages) also add extra enemies on top of the
  // template's normal spawn list — clone random existing spawns with a small
  // position jitter rather than requiring new StageEnemy rows per tier.
  const extra = requestedNum ? extraEnemyCount(requestedNum) : 0;
  const enemies = [...baseEnemies];
  for (let i = 0; i < extra && baseEnemies.length > 0; i++) {
    const template = baseEnemies[i % baseEnemies.length];
    enemies.push({ ...template, spawnX: template.spawnX + ((i % 2 === 0 ? 1 : -1) * 60), spawnY: template.spawnY + ((i % 2 === 0 ? -1 : 1) * 60) });
  }

  // Farm stages don't use StageEnemy rows for POSITIONS (GameScene draws random
  // enemies from this roster each wave — see spawnWave() in GameScene.ts), but
  // v20 repurposes the same StageEnemy rows as a roster WHITELIST: if a farm
  // stage has any StageEnemy rows, only those enemy ids are eligible; if it has
  // none (e.g. the original farm_01), every enemy is eligible, unchanged from
  // before. This is what lets Multiverse 2's farm stage restrict itself to its
  // own 5 enemy types instead of pulling from the whole global roster.
  let enemyRoster: Array<{ id: string; weaponId: string; hp: number; coinReward: number; sprite: string; weapon: NonNullable<Awaited<ReturnType<typeof getWeaponById>>> }> = [];
  if (stage.isRepeatable) {
    const allEnemies = await getAllEnemies();
    const allowedIds = new Set(spawns.map((s) => s.enemyId));
    const pool = allowedIds.size > 0 ? allEnemies.filter((e) => allowedIds.has(e.id)) : allEnemies;
    enemyRoster = (
      await Promise.all(
        pool.map(async (enemy) => {
          const enemyWeapon = await getWeaponById(enemy.weaponId);
          if (!enemyWeapon) return null;
          return { ...enemy, weapon: { ...enemyWeapon, damage: Math.round(enemyWeapon.damage * enemy.damageMultiplier) } };
        })
      )
    ).filter((e) => e !== null);
  }

  const loadout = statsToLoadout(character, weapon, stats, remainingAmmo, getEquippedSkinColor(player.skinColors, character.id));
  const { perks, spareLoadout } = await buildPerkPayload(player, weaponId);

  return NextResponse.json({
    success: true,
    stageData: { ...stage, id: stageId },
    enemies,
    enemyRoster,
    covers,
    character: loadout,
    weaponId,
    perks,
    spareLoadout,
  });
}

async function startBossStage(playerId: string) {
  const [bossEncounterCount, completedStageIds] = await Promise.all([
    getBossEncounterCount(playerId),
    getCompletedStageIds(playerId),
  ]);

  // v31 fix: this used to derive "is a boss available" from a generic
  // stages-cleared-count / pacing formula (Math.floor(stagesCleared / 10)),
  // which could drift out of sync with which multiverse the player actually
  // just finished (e.g. it kept resolving encounter 1's — Multiverse 1's —
  // config even after Multiverse 2's stages were cleared, so the "boss"
  // fought there was still Multiverse 1's map/stats). Locking the next boss
  // encounter directly to "has the exact milestone stage (stage10, stage20,
  // stage30, ...) been cleared" removes that drift entirely — encounter N
  // always requires stage(N*10) specifically, matching one boss per multiverse.
  const encounterNumber = bossEncounterCount + 1;
  const requiredStageId = `stage${encounterNumber * 10}`;
  if (!completedStageIds.includes(requiredStageId)) {
    return NextResponse.json({ error: `Clear ${requiredStageId} first to unlock this boss.` }, { status: 400 });
  }

  const config = await getBossConfigForEncounter(encounterNumber);
  const bossWeaponBase = await getWeaponById(config.weaponId);
  if (!bossWeaponBase) return NextResponse.json({ error: "Boss weapon not found" }, { status: 404 });

  const player = await getPlayerById(playerId);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const [character, equippedWeaponId] = await Promise.all([
    getCharacterById(player.currentCharacter),
    getEquippedWeaponId(playerId),
  ]);
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const weaponId = equippedWeaponId ?? DEFAULT_WEAPON_ID;
  const weapon = await getWeaponById(weaponId);
  if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });

  const stats = await computeFullStats(playerId, character, weapon);
  const remainingAmmo = await getRemainingAmmo(playerId, weaponId, Math.round(stats.dailyAmmo.final));
  if (remainingAmmo <= 0) {
    return NextResponse.json({ error: "Out of ammo for this weapon today. Watch an ad or spend diamonds to refill." }, { status: 400 });
  }

  const width = 1280;
  const height = 720;

  // v24: each multiverse's boss row carries its own explicit damageMultiplier
  // (e.g. Multiverse 2's boss hits 3x harder) instead of a single compounding
  // growthPercent formula shared by every encounter — see getBossConfigForEncounter.
  const bossWeapon = {
    ...bossWeaponBase,
    damage: Math.round(bossWeaponBase.damage * config.damageMultiplier),
  };

  const bossEnemy = {
    id: "boss",
    weaponId: config.weaponId,
    hp: config.hp,
    coinReward: 0,
    sprite: "/assets/sprites/enemy/enemy_boss.svg",
    immobile: false,
    weapon: bossWeapon,
    spawnX: width * 0.75,
    spawnY: height / 2,
  };

  // v17/v24: the boss calls in a fresh minion once every 15s (see
  // GameScene.ts's spawnBossMinion) — enemyRoster[0] is that minion's
  // template, which type varies per multiverse (see config.minionEnemyId).
  const minionTemplate = await getEnemyById(config.minionEnemyId);
  const minionWeapon = minionTemplate ? await getWeaponById(minionTemplate.weaponId) : null;
  const enemyRoster = minionTemplate && minionWeapon ? [{ ...minionTemplate, weapon: minionWeapon }] : [];

  const loadout = statsToLoadout(character, weapon, stats, remainingAmmo, getEquippedSkinColor(player.skinColors, character.id));
  const { perks, spareLoadout } = await buildPerkPayload(player, weaponId);

  return NextResponse.json({
    success: true,
    perks,
    spareLoadout,
    stageData: {
      id: `boss_${encounterNumber}`,
      name: `Boss Encounter #${encounterNumber}`,
      // v17: boss arena has no cover anywhere (see GameScene.ts's
      // createCovers() short-circuit for isBossStage) — v24: background is
      // now per-multiverse (e.g. Multiverse 2's boss fights on sand).
      background: config.background,
      width,
      height,
      rewardCoin: 0,
      rewardExp: 0,
      isRepeatable: false,
      bossSummonIntervalMs: config.summonIntervalMs,
    },
    enemies: [bossEnemy],
    enemyRoster,
    covers: [],
    character: loadout,
    weaponId,
  });
}

const TUTORIAL_WIDTH = 1280;
const TUTORIAL_HEIGHT = 720;
/** Doesn't touch the player's real daily ammo pool — the tutorial always has
 *  plenty to complete the SHOOT/RELOAD/KILL_ENEMY steps regardless of how
 *  much (if any) real ammo the account has left today. */
const TUTORIAL_AMMO = 999;

/**
 * Synthetic stage for the first-time Training Mode flow (see
 * src/game/scenes/TutorialScene.ts) — modeled on startBossStage()'s
 * synthetic-payload pattern. Uses the player's REAL equipped character/weapon
 * so the tutorial teaches the actual loadout they'll play with, but on a
 * small dedicated map (one tree, enemies spawned by the scene's state
 * machine, not StageEnemy rows) instead of any real story/farm stage.
 */
async function startTutorialStage(player: Player) {
  const [character, equippedWeaponId] = await Promise.all([
    getCharacterById(player.currentCharacter),
    getEquippedWeaponId(player.id),
  ]);
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const weaponId = equippedWeaponId ?? DEFAULT_WEAPON_ID;
  const weapon = await getWeaponById(weaponId);
  if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });

  const stats = await computeFullStats(player.id, character, weapon);
  const loadout = statsToLoadout(character, weapon, stats, TUTORIAL_AMMO, getEquippedSkinColor(player.skinColors, character.id));

  return NextResponse.json({
    success: true,
    stageData: {
      id: "tutorial",
      name: "Training Grounds — Tutorial",
      background: "/assets/sprites/background/battlefield_ground.svg",
      width: TUTORIAL_WIDTH,
      height: TUTORIAL_HEIGHT,
      rewardCoin: 0,
      rewardExp: 0,
      isRepeatable: false,
      playerSpawnX: 120,
      playerSpawnY: TUTORIAL_HEIGHT / 2,
    },
    enemies: [],
    enemyRoster: [],
    covers: [{ coverType: "tree", x: 760, y: TUTORIAL_HEIGHT / 2 }],
    character: loadout,
    weaponId,
    perks: { spareWeapon: false, regen: false, superShield: false, oneShot: false },
    spareLoadout: null,
    tutorialStep: player.tutorialStep,
  });
}
