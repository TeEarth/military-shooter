/**
 * Creates (or resets) a dedicated test account with a password login, huge
 * currency balances, every character/weapon/equipment owned, and high enough
 * VIP/farm-wave stats to test Azzure's SPECIAL unlock — but with NO story
 * stages marked completed, so every stage is playable from a clean slate.
 *
 * Usage: npx tsx scripts/create-test-account.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { findRow, updateRow, appendRow, appendRows, readSheetRaw, deleteRow } from "../src/lib/google/sheet";
import { createPlayer } from "../src/lib/google/player";

const EMAIL = "test@militaryshooter.local";
const PASSWORD = "Test1234!";
const USERNAME = "TestAdmin";

async function clearPlayerRows(sheetName: string, playerId: string) {
  const { rows } = await readSheetRaw(sheetName);
  const toDelete = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.playerId === playerId).reverse();
  for (const { i } of toDelete) {
    await deleteRow(sheetName, i);
    await new Promise((res) => setTimeout(res, 500));
  }
}

async function main() {
  let found = await findRow("Players", (r) => r.email === EMAIL);

  if (!found) {
    await createPlayer({ email: EMAIL, username: USERNAME, password: PASSWORD });
    found = await findRow("Players", (r) => r.email === EMAIL);
    if (!found) throw new Error("Failed to create test account");
    console.log(`Created ${EMAIL}`);
  } else {
    // Re-set the password in case this is being re-run.
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await updateRow("Players", found.rowIndex, { passwordHash });
    console.log(`${EMAIL} already existed — password reset`);
  }

  const playerId = found.row.id;

  await updateRow("Players", found.rowIndex, {
    coin: 9999999,
    diamond: 9999999,
    ticket: 9999999,
    level: 50,
    exp: 0,
    currentStage: 99,
    currentCharacter: "bob",
    currentWeapon: "pistol",
    vipLevel: 10,
    farmStageMaxWave: 50,
  });
  console.log("Set huge currency + high VIP/farm-wave/stage stats");

  // No story stages locked — always playable for testing.
  await clearPlayerRows("PlayerStageProgress", playerId);

  // Own every character and weapon so all of them are equippable/testable.
  await clearPlayerRows("PlayerCharacter", playerId);
  await clearPlayerRows("PlayerWeapon", playerId);
  await clearPlayerRows("PlayerEquipment", playerId);

  const { rows: characters } = await readSheetRaw("Characters");
  await appendRows("PlayerCharacter", characters.map((c) => ({ playerId, characterId: c.id, owned: true })));

  const { rows: weapons } = await readSheetRaw("Weapons");
  await appendRows("PlayerWeapon", weapons.map((w) => ({ playerId, weaponId: w.id, owned: true, equipped: w.id === "pistol" })));

  const { rows: equipment } = await readSheetRaw("Equipment");
  await appendRows("PlayerEquipment", equipment.map((e) => ({ playerId, equipmentId: e.id, slot: e.slot, equipped: false })));

  console.log("Granted every character, weapon, and equipment item");

  console.log(`\nDone. Log in with:\n  email: ${EMAIL}\n  password: ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
