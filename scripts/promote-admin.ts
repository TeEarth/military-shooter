/**
 * Creates (or updates) the designated User Admin account and grants it
 * isAdmin. Safe to re-run — idempotent.
 *
 * REQUIRES scripts/sql/003_v16_schema.sql to have been run first (adds
 * players.is_admin) — this will fail with a "column does not exist" error
 * otherwise.
 *
 * Run with: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/promote-admin.ts
 * (never hardcode the email/password here — this file is committed to git).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPlayer, getPlayerByEmail, updatePlayer } from "../src/lib/db/player";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars before running this script.");
    process.exit(1);
  }

  let player = await getPlayerByEmail(ADMIN_EMAIL);

  if (!player) {
    player = await createPlayer({ email: ADMIN_EMAIL, username: "Admin", password: ADMIN_PASSWORD });
    console.log(`Created new player ${player.id} for ${ADMIN_EMAIL}`);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await updatePlayer(player.id, { passwordHash, isAdmin: true });
  console.log(`${ADMIN_EMAIL} is now an admin. Log in with that email + the password you set.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
