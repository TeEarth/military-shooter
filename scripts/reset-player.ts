/**
 * Resets one player account to a brand-new-player state: starting currency,
 * level 1, Bob + Pistol as the only owned character/weapon, no equipment, no
 * stage progress, no farm-wave record. Deletes all PlayerCharacter/PlayerWeapon
 * /PlayerEquipment/PlayerStageProgress/PlayerWeaponAmmo/PlayerPassive rows for
 * this player, then recreates only the Bob+Pistol ownership rows.
 *
 * Safeguard: requires the email as a CLI arg so this can't be run against the
 * wrong account by accident.
 *
 * Usage: npx tsx scripts/reset-player.ts <email>
 */
import "dotenv/config";
import { findRow, updateRow, readSheetRaw, deleteRow, appendRow } from "../src/lib/google/sheet";
import { ECONOMY_CONFIG } from "../config/economy";
import { createPlayer } from "../src/lib/google/player";

async function clearPlayerRows(sheetName: string, playerId: string) {
  const { rows } = await readSheetRaw(sheetName);
  const toDelete = rows
    .map((r, i) => ({ row: r, index: i }))
    .filter(({ row }) => row.playerId === playerId)
    .reverse(); // delete bottom-up so earlier indices stay valid

  for (const { index } of toDelete) {
    await deleteRow(sheetName, index);
    await new Promise((r) => setTimeout(r, 600));
  }
  if (toDelete.length > 0) console.log(`  Cleared ${toDelete.length} rows from ${sheetName}`);
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/reset-player.ts <email>");
    process.exit(1);
  }

  let found = await findRow("Players", (r) => r.email.toLowerCase() === email.toLowerCase());

  if (!found) {
    // Account doesn't exist yet (e.g. hasn't logged in via Google OAuth yet) — create it
    // fresh so the reset below has something to normalize, and so the account is ready
    // before first login (auth.ts reuses this row by email instead of creating a duplicate).
    console.log(`No player found with email ${email} — creating a fresh account.`);
    await createPlayer({ email, username: email.split("@")[0], isGuest: false });
    found = await findRow("Players", (r) => r.email.toLowerCase() === email.toLowerCase());
    if (!found) throw new Error("Failed to create player account");
  }

  const playerId = found.row.id;
  console.log(`Resetting player ${playerId} (${email})...`);

  await updateRow("Players", found.rowIndex, {
    coin: ECONOMY_CONFIG.startingCoin,
    diamond: ECONOMY_CONFIG.startingDiamond,
    ticket: ECONOMY_CONFIG.startingTicket,
    level: 1,
    exp: 0,
    currentStage: 1,
    currentCharacter: "bob",
    currentWeapon: "pistol",
    farmStageMaxWave: 0,
  });
  console.log("  Reset currency/level/stage/character/weapon fields");

  await clearPlayerRows("PlayerCharacter", playerId);
  await clearPlayerRows("PlayerWeapon", playerId);
  await clearPlayerRows("PlayerEquipment", playerId);
  await clearPlayerRows("PlayerStageProgress", playerId);
  await clearPlayerRows("PlayerWeaponAmmo", playerId);
  await clearPlayerRows("PlayerPassive", playerId);
  await clearPlayerRows("PlayerMission", playerId);

  await appendRow("PlayerCharacter", { playerId, characterId: "bob", owned: true });
  await appendRow("PlayerWeapon", { playerId, weaponId: "pistol", owned: true, equipped: true });
  console.log("  Recreated Bob + Pistol ownership");

  console.log(`\nDone. ${email} is now reset to a fresh new-player state.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
