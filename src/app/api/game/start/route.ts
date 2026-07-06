import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById } from "@/lib/google/player";
import { getStageById, getStageEnemies, getStageCovers } from "@/lib/google/stage";
import { getEnemyById, getAllEnemies } from "@/lib/google/enemy";
import { getCharacterById } from "@/lib/google/character";
import { getWeaponById } from "@/lib/google/weapon";
import { getEquippedWeaponId } from "@/lib/google/inventory";
import { getRemainingAmmo } from "@/lib/google/weaponAmmo";
import { isStageCompleted } from "@/lib/google/stageProgress";
import { computeFullStats, statsToLoadout } from "@/lib/stats";
import { parseStageNumber, templateStageId, stageStatMultiplier, extraEnemyCount } from "@/lib/stageTemplate";
import { getBossStageConfig, getBossEncounterCount, scaledBossHp } from "@/lib/google/bossStage";
import { getCompletedStageIds } from "@/lib/google/stageProgress";

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

  // Story stages loop every 10 numbers (stage 11 reuses stage 1's map, scaled harder) —
  // resolve the requested number to its template map before loading spawns/metadata.
  // Farm-stage ids (e.g. "farm_01") aren't numeric and skip this resolution entirely.
  const requestedNum = parseStageNumber(stageId);
  const lookupId = requestedNum ? templateStageId(requestedNum) : stageId;

  const [stage, spawns, covers] = await Promise.all([getStageById(lookupId), getStageEnemies(lookupId), getStageCovers(lookupId)]);
  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

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

  const baseEnemies = (
    await Promise.all(
      spawns.map(async (s) => {
        const enemy = await getEnemyById(s.enemyId);
        if (!enemy) return null;
        const enemyWeapon = await getWeaponById(enemy.weaponId);
        if (!enemyWeapon) return null;
        const hpMultiplier = enemy.id === "enemy_rocket" ? rocketHpMultiplier : 1;
        return {
          ...enemy,
          hp: Math.round(enemy.hp * multiplier * hpMultiplier),
          weapon: { ...enemyWeapon, damage: Math.round(enemyWeapon.damage * multiplier) },
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

  // Farm stages don't use StageEnemy rows — GameScene draws random enemies from
  // this full roster each wave (see spawnWave() in GameScene.ts).
  let enemyRoster: Array<{ id: string; weaponId: string; hp: number; coinReward: number; sprite: string; weapon: NonNullable<Awaited<ReturnType<typeof getWeaponById>>> }> = [];
  if (stage.isRepeatable) {
    const allEnemies = await getAllEnemies();
    enemyRoster = (
      await Promise.all(
        allEnemies.map(async (enemy) => {
          const enemyWeapon = await getWeaponById(enemy.weaponId);
          return enemyWeapon ? { ...enemy, weapon: enemyWeapon } : null;
        })
      )
    ).filter((e) => e !== null);
  }

  const loadout = statsToLoadout(character, weapon, stats, remainingAmmo);

  return NextResponse.json({
    success: true,
    stageData: { ...stage, id: stageId },
    enemies,
    enemyRoster,
    covers,
    character: loadout,
    weaponId,
  });
}

async function startBossStage(playerId: string) {
  const [config, bossEncounterCount, stagesCleared] = await Promise.all([
    getBossStageConfig(),
    getBossEncounterCount(playerId),
    getCompletedStageIds(playerId).then((ids) => ids.length),
  ]);

  const tiersUnlocked = Math.floor(stagesCleared / config.occursEveryNStages);
  if (bossEncounterCount >= tiersUnlocked) {
    return NextResponse.json({ error: "No boss stage available yet — clear more story stages first." }, { status: 400 });
  }

  const encounterNumber = bossEncounterCount + 1;
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

  // Instant-kill design: the boss's rockets deal absurdly high damage and hit via
  // the existing AoE-splash path (takeAoeDamage), which already bypasses armor%
  // entirely — so "one hit = dead" falls straight out of the existing damage
  // pipeline instead of needing a brand-new instant-kill flag/mechanic.
  const bossWeapon = {
    ...bossWeaponBase,
    damage: 999999,
    projectileCount: config.rocketCount,
    magazineSize: config.rocketCount,
    fireMode: "aoe" as const,
    accuracy: 100,
  };

  const bossEnemy = {
    id: "boss",
    weaponId: config.weaponId,
    hp: scaledBossHp(config, encounterNumber),
    coinReward: 0,
    sprite: "/assets/sprites/enemy/enemy_rocket.svg",
    weapon: bossWeapon,
    spawnX: width * 0.75,
    spawnY: height / 2,
  };

  const loadout = statsToLoadout(character, weapon, stats, remainingAmmo);

  return NextResponse.json({
    success: true,
    stageData: {
      id: `boss_${encounterNumber}`,
      name: `Boss Encounter #${encounterNumber}`,
      background: "/assets/sprites/background/battlefield_ground.svg",
      width,
      height,
      rewardCoin: 0,
      rewardExp: 0,
      isRepeatable: false,
    },
    enemies: [bossEnemy],
    enemyRoster: [],
    covers: [],
    character: loadout,
    weaponId,
  });
}
