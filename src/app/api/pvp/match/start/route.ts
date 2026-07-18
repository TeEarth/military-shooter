import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency } from "@/lib/db/player";
import { getMatchById, chargeMatchEntryFeeOnce } from "@/lib/db/pvp";

const PVP_ENTRY_TICKET_COST = 5;
import { getCharacterById } from "@/lib/google/character";
import { getWeaponById } from "@/lib/google/weapon";
import { getEquippedWeaponId } from "@/lib/db/inventory";
import { getRemainingAmmo } from "@/lib/db/weaponAmmo";
import { computeFullStats, statsToLoadout } from "@/lib/stats";
import { buildPerkPayload } from "@/lib/perkPayload";

const DEFAULT_WEAPON_ID = "pistol";
const ARENA_WIDTH = 1280;
const ARENA_HEIGHT = 720;

/**
 * Synthesizes a PvP arena payload, modeled directly on startBossStage() in
 * /api/game/start/route.ts — same synthetic stageData/enemies-less contract,
 * just with a second human spawn point instead of a boss. Each side calls
 * this for THEIR OWN loadout; there is no shared "the match" response — the
 * two clients only ever meet over the Realtime channel, not through this route.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId } = await req.json();
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  const match = await getMatchById(matchId);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.player1Id !== session.user.id && match.player2Id !== session.user.id) {
    return NextResponse.json({ error: "Not a participant in this match" }, { status: 403 });
  }
  if (match.status !== "active") return NextResponse.json({ error: "Match already ended" }, { status: 400 });

  const isPlayer1 = match.player1Id === session.user.id;
  const opponentId = isPlayer1 ? match.player2Id : match.player1Id;

  const [player, opponent] = await Promise.all([getPlayerById(session.user.id), getPlayerById(opponentId)]);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // v29: the 5-ticket entry fee is charged HERE (once a match genuinely
  // exists), not at queue-join — cancelling before an opponent is found now
  // costs nothing. Balance is checked BEFORE flipping the charged flag so an
  // insufficient-balance rejection never gets permanently (and incorrectly)
  // marked as "already charged" — chargeMatchEntryFeeOnce() only runs once we
  // know the deduction can actually succeed, and is itself idempotent per
  // player per match so a duplicate/retried call never re-charges.
  if (player.ticket < PVP_ENTRY_TICKET_COST) {
    return NextResponse.json({ error: `Need ${PVP_ENTRY_TICKET_COST} tickets to play PvP` }, { status: 400 });
  }
  const feeOwed = await chargeMatchEntryFeeOnce(matchId, isPlayer1);
  if (feeOwed) {
    await addCurrency(player.id, { ticket: -PVP_ENTRY_TICKET_COST });
  }

  const [character, equippedWeaponId, opponentCharacter, opponentWeaponId] = await Promise.all([
    getCharacterById(player.currentCharacter),
    getEquippedWeaponId(player.id),
    opponent ? getCharacterById(opponent.currentCharacter) : Promise.resolve(null),
    opponent ? getEquippedWeaponId(opponent.id) : Promise.resolve(null),
  ]);
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const weaponId = equippedWeaponId ?? DEFAULT_WEAPON_ID;
  const weapon = await getWeaponById(weaponId);
  if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });

  const stats = await computeFullStats(player.id, character, weapon);
  // PvP doesn't spend daily ammo reserves — reusing the ammo-gate would let
  // someone get locked out of PvP by an empty single-player ammo pool, which
  // isn't the point of a separate mode. Magazine size still applies normally.
  const remainingAmmo = await getRemainingAmmo(player.id, weaponId, Math.round(stats.dailyAmmo.final));
  const loadout = statsToLoadout(character, weapon, stats, Math.max(remainingAmmo, stats.dailyAmmo.final), player.skinColor);
  const { perks, spareLoadout } = await buildPerkPayload(player, weaponId);

  const mySpawn = isPlayer1
    ? { x: ARENA_WIDTH * 0.15, y: ARENA_HEIGHT / 2 }
    : { x: ARENA_WIDTH * 0.85, y: ARENA_HEIGHT / 2 };
  const opponentSpawn = isPlayer1
    ? { x: ARENA_WIDTH * 0.85, y: ARENA_HEIGHT / 2 }
    : { x: ARENA_WIDTH * 0.15, y: ARENA_HEIGHT / 2 };

  return NextResponse.json({
    success: true,
    matchId,
    isPlayer1,
    opponent: {
      id: opponentId,
      username: opponent?.username ?? "Opponent",
      sprite: opponentCharacter?.sprite ?? "",
      weaponId: opponentWeaponId ?? DEFAULT_WEAPON_ID,
      skinColor: opponent?.skinColor,
    },
    stageData: {
      id: `pvp_${matchId}`,
      name: "PvP Arena",
      background: "/assets/sprites/background/battlefield_ground.svg",
      width: ARENA_WIDTH,
      height: ARENA_HEIGHT,
      rewardCoin: 0,
      rewardExp: 0,
      isRepeatable: false,
      playerSpawnX: mySpawn.x,
      playerSpawnY: mySpawn.y,
    },
    opponentSpawn,
    character: loadout,
    weaponId,
    perks,
    spareLoadout,
  });
}
