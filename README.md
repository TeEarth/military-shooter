# Military Shooter 2D

2D open-world mission-based military shooter. **Google Sheets is the database** —
every read and write goes through a Next.js API route; the frontend and the
Phaser game client never talk to Google directly.

```
Game (Phaser/React)  →  Next.js API Route  →  Google Sheets API  →  Google Spreadsheet
```

## Tech Stack
- **Frontend**: Next.js 15 (App Router), React, TypeScript, TailwindCSS
- **Game Engine**: Phaser 3 (open-world stages, camera-follow, goalX finish line)
- **Database**: Google Sheets (via a service account) — no SQL database at all
- **Auth**: NextAuth v5, JWT sessions, bcrypt-hashed passwords stored in the `Players` sheet

---

## 1. Quick Start

```bash
npm install
```

1. Put your Google service account JSON key at `./credentials.json` (already git-ignored — never commit it).
2. Share the spreadsheet with the service account's `client_email` as **Editor**.
3. Copy `.env.example` to `.env` and fill in `GOOGLE_SHEET_ID` and `NEXTAUTH_SECRET`.
4. Create the sheet tabs + seed starter data (safe to re-run, it only appends when a sheet is empty):
   ```bash
   npm run sheets:init
   ```
5. Run the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

---

## 2. How the Google Sheet is used

**Nothing in the browser or the Phaser game ever calls the Google Sheets API.**
All access goes through `/lib/google/*` modules, which are only ever imported
from Next.js API routes (`/src/app/api/**`) and Server Components (`page.tsx`
files that run on the server). This keeps the service account key server-side
only and lets you swap the storage layer later without touching the frontend.

### `/lib/google/` file map

| File | Responsibility |
|---|---|
| `auth.ts` | Loads the service account credentials (file path or raw env vars) and builds the `GoogleAuth` client. |
| `google.ts` | Singleton `sheets_v4.Sheets` client + spreadsheet ID getter. |
| `sheet.ts` | Low-level generic sheet I/O: `readSheetRaw`, `appendRow`, `appendRows`, `findRow`, `findRows`, `updateRow`, `deleteRow`, `ensureSheetExists`. Every other module is built on top of this. |
| `cache.ts` | In-memory cache per sheet name, **60-second TTL**, refreshed lazily on next read. Writes call `invalidateSheetCache()` so the next read is always fresh. |
| `player.ts` | `Players` sheet — create/find/verify accounts, currency deltas, level-up math, daily ammo reset, `toPublicPlayer()` (strips `passwordHash` before sending to the client). |
| `character.ts` | `Characters` sheet — weapon/character catalog + `unlockType` rules. |
| `enemy.ts` | `Enemies` sheet — enemy stat catalog. |
| `weapon.ts` | `Weapons` sheet — a secondary weapon-stat catalog (used for future weapon-attachment systems separate from character base stats). |
| `inventory.ts` | `Inventory`, `PlayerCharacter`, `PlayerEquipment`, `Equipment`, and `Shop` sheets — ownership, equip/unequip, shop listings. |
| `stage.ts` | `Stage`, `StageEnemy`, `StageReward` sheets — stage metadata, enemy spawn points, stage-clear rewards. |
| `reward.ts` | Stage-completion reward granting, `Mail` sheet (send/claim), `Redeem` sheet (ticket → real reward request/approve/reject workflow). |
| `config.ts` | `Config`, `Settings`, `Analytics` sheets — key/value game config, admin email allowlist, daily analytics counters. |

### Sheet-by-sheet column reference

**Players** — `id, email, username, passwordHash, coin, diamond, ticket, level, exp, currentStage, currentCharacter, ammo, ammoDate, adsWatchedToday, isGuest, isBanned, lastLogin, createdAt, updatedAt`
The single source of truth for every player. `passwordHash` is bcrypt (never plaintext) and is always stripped before any API response leaves the server (`toPublicPlayer()`).

**Characters** — `id, name, unlockType, unlockValue, damage, hp, ammo, fireRate, accuracy, moveSpeed, sprite, priceCoin, priceDiamond, description, reloadSpeed, criticalChance, criticalDamage, armor, magazineSize, bulletSprite`
`unlockType` is one of `FREE | STAGE | PURCHASE | DIAMOND | EVENT`:
- `FREE` — always usable (Pistol).
- `STAGE` — unlocked automatically once `player.currentStage >= unlockValue` (Double Pistol unlocks at stage 10).
- `PURCHASE` — buyable with coins (`priceCoin`).
- `DIAMOND` — buyable with diamonds (`priceDiamond`).
- `EVENT` — reserved for future event-only unlocks (currently granted the same way as `DIAMOND`; hook your event logic into `unlockCharacterForPlayer()` in `inventory.ts`).

**Weapons** — `id, name, damage, reload, fireRate, criticalChance, accuracy, sprite`
A secondary weapon-stat table, independent from `Characters`, meant for a future "equip any weapon on any character" system. Not currently wired into gameplay — character stats drive combat today.

**Enemies** — `id, name, hp, damage, accuracy, speed, rewardCoin, rewardExp, dropRate, sprite`

**Equipment** — `id, type, rarity, damage, hp, armor, speed, critical, accuracy, priceCoin, priceDiamond, sprite`
`type` is one of `helmet | armor | glove | boot | backpack | accessory`. `rarity` is `common | rare | epic | legendary | mythic`.

**Inventory** — `playerId, itemId, quantity` (generic consumables/loot, separate from equipment/characters).

**PlayerCharacter** — `playerId, characterId, level, owned` (ownership + per-character level for future upgrade systems).

**PlayerEquipment** — `playerId, equipmentId, equipped`.

**Stage** — `id, name, background, width, height, music, goalX, rewardCoin, rewardExp, rewardTicket`
`width`/`height` define the full open-world map size in pixels — the player can walk the entire area, not just one screen. `goalX` is the finish-line x-coordinate; walking into it clears the stage.

**StageEnemy** — `stageId, enemyId, spawnX, spawnY` (one row per enemy spawned in that stage).

**StageReward** — `stageId, coin, exp, ticket, diamondChance` (overrides `Stage`'s own reward columns when present; `diamondChance` is a 0–1 probability of a bonus diamond drop).

**Shop** — `id, type, itemId, priceCoin, priceDiamond` (`type` is `character | equipment | lootbox`).

**Redeem** — `id, playerId, ticket, status, createdAt` (`status` is `pending | approved | rejected`). Ticket → real-reward requests, admin-approved only (see section 14).

**Mail** — `playerId, title, message, reward, claimed`. `reward` is a `"type:amount"` string, e.g. `"coin:100"`, `"diamond:5"`, `"equipment:helmet_common_01"`, `"character:ak47"`.

**DailyMission** — `id, title, description, goal, rewardType, rewardAmount` (mission catalog; per-player progress tracking is a future addition — see section 15).

**Config** — `key, value`. Currently used keys: `maxAmmoPerDay`, `ammoPerAd`, `maxAdsPerDay`, `ammoCostPerStage`, `ticketRedeemMin`, `adminEmails` (comma-separated list — see section 14 for how to make yourself an admin).

**Settings** — `key, value` (general app settings, e.g. `maintenanceMode`, `appVersion`).

**Analytics** — `date, newUser, playCount, revenue` (one row per day, incremented on registration/stage-complete/mock-payment).

---

## 3. Add a new character

Add one row to the `Characters` sheet. The game reads it immediately (after the 60s cache window). No code changes needed unless you want a new `unlockType` behavior.

---

## 4. Add a new stage

1. Add a row to `Stage` (pick a `width`/`height` for the open-world map size and a `goalX` finish line).
2. Add one row per enemy to `StageEnemy` with that `stageId`.
3. Optionally add a row to `StageReward` for custom coin/exp/ticket/diamond-chance rewards (otherwise it falls back to `Stage`'s own reward columns).
4. Stage IDs should look like `stageNN` (e.g. `stage06`) — the unlock/progress logic parses the trailing number to compare against `player.currentStage`.

---

## 5. Add a new enemy

Add a row to `Enemies`. Then reference its `id` in `StageEnemy.enemyId` for any stage you want it to appear in. If you want a distinct placeholder color/scale in-game before real art exists, add an entry to `ENEMY_COLORS`/`ENEMY_SCALE` in [Enemy.ts](src/game/entities/Enemy.ts) — optional, it'll fall back to a default look otherwise.

---

## 6. Change gun/weapon stats

Edit the character's row directly in the `Characters` sheet — `damage`, `fireRate`, `accuracy`, `reloadSpeed`, `magazineSize`, `criticalChance`, `criticalDamage` all drive the in-game `Player` entity directly, no redeploy needed.

---

## 7. Change Damage

`Characters.damage` (base) × a random crit roll using `criticalChance`/`criticalDamage` — see `Player.getDamage()` in [Player.ts](src/game/entities/Player.ts). For enemies, edit `Enemies.damage`.

---

## 8. Change HP

`Characters.hp` for the player, `Enemies.hp` for enemies. Both sheets, edit directly.

---

## 9. Change a character's sprite

Edit `Characters.sprite` (and `bulletSprite`) to point at a new file under `/public/assets/sprites/characters/`. Drop the image at that path — placeholder graphics are auto-generated in-game whenever a real texture is missing, so nothing breaks in the meantime.

---

## 10. Change a stage's background image

Edit `Stage.background` to point at a file under `/public/assets/sprites/background/`. If the file doesn't exist yet, `GameScene` auto-generates a colored placeholder (with a faint grid so you can see the map scale) instead of erroring — swap in the real image whenever it's ready and it's picked up automatically.

---

## 11. Add a new stage background

Drop the image into `/public/assets/sprites/background/`, then point a `Stage.background` row at it (see section 10).

---

## 12. Add sound

Drop audio files into `/public/assets/audio/`. Weapon sounds aren't wired into character rows yet (a natural follow-up: add a `soundShoot`/`soundReload` column to `Characters` and read it in `Player.ts`'s `shoot()`/reload methods, following the same pattern as `sprite`/`bulletSprite`).

---

## 13. Add a Premium character

Set `unlockType = DIAMOND` and `priceDiamond` to the desired cost on a `Characters` row. It'll show up in the Character screen with a diamond-purchase button automatically. For a character that should never be purchasable and only handed out via events/promotions, use `unlockType = EVENT` and grant it directly to specific players by calling `unlockCharacterForPlayer(playerId, characterId)` from an admin script or a future event-claim API route.

---

## 14. Where to add real payment later

- **Diamond top-ups**: [`/api/payment/mock/route.ts`](src/app/api/payment/mock/route.ts) currently grants diamonds unconditionally on any POST. Replace its body with your real payment gateway's webhook verification (Stripe, Omise, PromptPay, TrueMoney, etc.), then call the same `addCurrency(playerId, { diamond })` — the rest of the game doesn't need to change.
- **Ticket → real-world reward redemption**: already has a full workflow — `POST /api/ticket/redeem` deducts tickets and creates a `pending` row in the `Redeem` sheet; `PATCH /api/admin/tickets` (admin-only) approves or rejects it. Wire your payout process (bank transfer, TrueMoney, coupon code, etc.) into the `approve` branch of `processRedeemRequest()` in [reward.ts](src/lib/google/reward.ts).
- **Becoming an admin**: add your email to the `adminEmails` key in the `Config` sheet (comma-separated if there are multiple). `isAdminEmail()` in [config.ts](src/lib/google/config.ts) checks it on every admin route — no code deploy needed to promote/demote an admin.

---

## 15. Full project structure

```
/config                    — Runtime-tunable constants that aren't game *data* (display size, ads provider, base player stats, AI ranges)
  ads.ts                   — Ad provider switch (mock/admob/unity) + rewarded-ad reward amount
  economy.ts               — Starting currency amounts, ammo defaults, level-up curve
  enemy.ts                 — AI detection/line-of-sight ranges
  game.ts                  — Phaser canvas size, physics debug flag
  player.ts                — Base player HP/move speed/hitbox
  ticket.ts                — Client-side UI hint for minimum redeem (server enforces the real value from the Config sheet)

/scripts
  init-sheets.ts           — One-time setup: creates all 18 sheet tabs + headers, seeds starter game-balance data. Safe to re-run (`npm run sheets:init`).

/src
  /app                     — Next.js App Router pages (Server Components fetch via /lib/google/*, then hand plain data to Client Components)
    /admin                 — Admin dashboard (player search/grant/ban, ticket redeem approval) — gated by Config.adminEmails
    /api                   — Every route that's allowed to import /lib/google/*
      /admin/players        — search/list players, grant currency, ban/unban
      /admin/tickets        — list/approve/reject redeem requests
      /auth/[...nextauth]    — NextAuth handlers
      /auth/guest            — creates a throwaway guest account
      /auth/register         — email/password registration (bcrypt hash)
      /character/equip        — switch active character (checks unlockType/ownership)
      /characters              — character catalog
      /game/start               — deducts ammo, assembles {stage, enemies, character} payload for the Phaser client
      /game/complete            — grants stage-clear rewards, advances currentStage
      /leaderboard               — top players by level/exp (computed from Players sheet, no dedicated leaderboard sheet)
      /mailbox                    — list/claim Mail rows
      /payment/mock                — stub diamond top-up endpoint (see section 14)
      /player                      — current player's full profile
      /player/ammo                  — watch-ad-for-ammo action
      /shop/buy                      — purchase character/equipment with coin or diamond
      /stages                        — stage list + per-player unlocked flag
      /ticket/redeem                  — create/list ticket redemption requests
    /character, /daily, /game, /home, /inventory, /leaderboard, /login, /mailbox, /mission, /play, /settings, /shop — page routes (Server Components)
  /components               — Client Components (all game-state mutations go through fetch() calls to /api/*, never direct Google Sheets access)
  /game
    /entities               — Player.ts, Enemy.ts, CoverObject.ts (Phaser game objects, built from server-provided character/enemy stat payloads — no hardcoded stat tables)
    /scenes                 — BootScene → PreloadScene → GameScene → HUDScene / GameOverScene
  /lib
    /google                 — see section 2 above; the only code allowed to call the Google Sheets API
    auth.ts                  — NextAuth config (Credentials + Google OAuth, JWT sessions, no adapter — Google Sheets IS the persistence layer)
  /types                     — Shared TypeScript interfaces mirroring the sheet schemas
/public/assets               — sprites/audio placeholders (drop real files at the paths referenced by sheet rows; missing files auto-fallback to generated placeholders)
```

### Gameplay notes (fixed in this pass)

- **Bullet/enemy collisions**: enemies are added to a live `Phaser.Physics.Arcade.Group` (`enemyGroup`) instead of a one-time array snapshot, so `overlap()` correctly detects every bullet against every currently-alive enemy, every frame — the earlier "shooting enemies didn't reduce HP" bug was a stale-array collision target.
- **Walls/cover**: `CoverObject` has no HP and is never destroyed. Bullets `collide` (not `overlap`) with cover and are destroyed on contact — they cannot pass through.
- **Open-world stages**: `GameScene` sets `physics.world.setBounds()` and `cameras.main.setBounds()` to the stage's full `width`/`height` from the `Stage` sheet (not just the viewport), and the camera follows the player (`startFollow`) across the whole map. Walking into the `goalX` zone ends the stage as a win, independent of remaining enemies.

### Known simplifications / good next additions

- Equipment stat bonuses aren't yet summed into the in-game `Player` — only the equipped *character's* base stats are used. Wire `PlayerEquipment` + `Equipment` stat totals into the `/api/game/start` payload to close this gap.
- Daily mission *progress* isn't tracked per-player yet (only the mission catalog is shown) — add a `PlayerDailyMission` sheet (`playerId, missionId, date, progress, claimed`) mirroring the `PlayerCharacter` pattern to finish this.
- `Weapons` sheet is seeded but not yet consumed — it's there for a future "attach any weapon to any character" system.

---

## v2 additions: combat, monetization, VIP, loot boxes, admin account

### Accuracy = chance to miss, not just spread
Every shot (player and enemy) rolls `accuracy%` at the moment it's fired. Fail the roll and the bullet still flies and can still physically collide, but deals `0` damage — shown as a floating gray "MISS" in-game. Pass the roll and normal (or critical) damage applies. See `Player.shoot()` and `Enemy.tryShoot()` — damage is precomputed and stashed on `bullet.setData("damage", ...)`, and `GameScene`'s collision handlers just read it back.

### Armor HP vs regular HP
`Characters.armor` is now a separate damage buffer (`armorHp`), not a flat damage-reduction stat. Incoming damage drains `armorHp` first; only the overflow hits regular `hp`. Regular `hp` regenerates on its own (`config/player.ts`: `hpRegenPerSecond` after `hpRegenDelayMs` without taking a hit) — **armor never regenerates mid-life**, it's a one-time buffer per life/respawn. Both bars are drawn in the HUD (green = HP, blue = armor).

### Enemies have their own weapon types, fully sheet-configurable
Add a `weaponType` column value on any `Enemies` row: `pistol | rifle | shotgun | sniper | rocket`. Each type's cooldown, bullet speed, pellet count, spread, and preferred engagement range live in `config/enemy.ts` under `ENEMY_CONFIG.weapons` — shotgun enemies fire 5 pellets in a spread, snipers fire rarely but hard and accurate from long range, rockets are slow and hit hard. You can invent new enemies entirely from the sheet (new `id`, any stat combo, pick a `weaponType`) — no code change required. Enemy HP is shown as a bar above their sprite that updates live.

### Difficulty & pricing (rebalanced for monetization)
Enemy HP/damage and character/equipment prices were raised across the board (see `scripts/migrate-v2.ts` for the exact before/after) — enemies hit harder and have more HP, and top-tier weapons/equipment now cost real money (diamonds) or a lot of coins, by design, so there's a natural pull toward topping up. Tune further any time directly in the `Characters`/`Equipment`/`Enemies` sheets.

### TrueMoney ticket redemption with a VIP-tiered daily cap
- `POST /api/ticket/redeem` now takes `{ amount, trueMoneyNumber }` — the TrueMoney Wallet phone number is stored on the `Redeem` row for the admin to pay out manually (no live TrueMoney API call yet, same "admin approves" flow as before).
- Daily redeem cap = `Config.ticketRedeemMaxPerDay` (base, default 200) + `Player.vipLevel × Config.vipRedeemBonusPerLevel` (default +100/level). Tracked per-player via `Players.ticketRedeemedToday`/`ticketRedeemDate`, resetting daily like ammo does.
- **VIP level** is computed from `Players.totalTopupThb` (lifetime real-money spend) against `Config.vipTopupThresholds` (format `"500:1,2000:2,5000:3,15000:4,50000:5"` — THB spent : VIP level). Edit that Config value to retune tiers with zero code changes.
- `POST /api/payment/mock` now takes `priceThb` and feeds it into `totalTopupThb`/VIP recomputation — swap this handler for a real gateway webhook later; the VIP/top-up bookkeeping stays the same (see section 14 above).

### Loot boxes
New sheets: `LootBox` (`id, name, priceCoin, priceDiamond, sprite`) and `LootBoxItem` (`lootBoxId, rewardType, rewardValue, amount, weight`) — a weighted random table per box. `rewardType` is `coin | diamond | ticket | exp | equipment | character`; for `equipment`/`character` put the item's `id` in `rewardValue`. Add a row to `LootBox` and matching `LootBoxItem` rows to create a new box — no code change. Buy + open happens in one step via `POST /api/lootbox` (`{ lootBoxId }`), shown under the Shop's "Loot Boxes" tab.

### Owner admin account
Login `earth_npn@admin.local` / password `Earth629629` (username `Earth_npn`) was created directly in the `Players` sheet and added to `Config.adminEmails`. It plays through the normal game like any other account, but being in `adminEmails` unlocks `/admin` — from there you can grant yourself unlimited coin/diamond/ticket via the existing admin currency-grant action, so there's no separate "cheat mode," just the same admin tool every admin has. Change the password any time by re-hashing and updating the `passwordHash` cell directly, or add a password-change API route if you want self-service.

---

## v3 additions: shop fix, weapon armory, equipment page, pause/exit, farm stage

### Shop purchase bug fixed
`/api/shop/buy` now grants the item **before** deducting currency (previously it could deduct first and silently fail to grant), returns `updatedPlayer` in every response, and `ShopClient`/`CharacterClient`/`WeaponClient` update their coin/diamond state directly from that response — no more stale balance until a page reload. Buy/equip buttons are disabled and show `...` while a request is in flight to prevent double-submission.

### A real ownership bug this surfaced: Sheets booleans are `"TRUE"`/`"FALSE"`, not `"true"`
While wiring up the weapon system, found that every `owned`/`equipped`/`isBanned`/`claimed` boolean check across the codebase compared against the lowercase string `"true"` — but Google Sheets normalizes booleans written via the API to uppercase `"TRUE"`/`"FALSE"`. This meant **every purchased character, weapon, or equipped item silently read back as not-owned/not-equipped** on the next fetch. Fixed with a shared `parseBool()` helper in `sheet.ts` used everywhere a boolean cell is read — verified live that purchases now persist correctly across requests.

### Character/weapon split
Combat stats moved off `Characters` and onto a new `Weapons` sheet + `PlayerWeapon` ownership sheet (`playerId, weaponId, owned, equipped`) — mirrors the existing `PlayerCharacter` pattern. `Characters` now only determines HP/move speed/armor/sprite; `Weapons` determines damage/fire rate/accuracy/reload/magazine/crit. `/api/game/start` merges character + equipped weapon + summed equipped-`Equipment` stat bonuses into one `CombatLoadout` sent to Phaser (see `src/types/loadout.ts`). New `/weapon` page (armory, buy/equip) and `GET /api/weapons` sit alongside the existing `/character` page, which now shows a full live stat sheet (see below) instead of just being the equip screen.

### Equipment equip/unequip page
New `/equipment` page — shows owned gear grouped by slot (`Equipment.type` doubles as the slot), with EQUIP/UNEQUIP buttons that write to `PlayerEquipment` via `POST /api/equipment/equip`. Equipping unequips whatever else was in the same slot automatically (one item per slot).

### Live character stat sheet
`/character` now renders every stat column from the `Characters` sheet as normalized bars (`hp, moveSpeed, armor, damage, fireRate, accuracy, reloadSpeed, magazineSize, ammo, criticalChance, criticalDamage`), and refetches from `GET /api/characters?fresh=1` on mount — that query param bypasses the 60s sheet cache (`getCachedSheet(sheet, { force: true })`) so a balance edit made in the Google Sheet moments ago is reflected immediately, with no redeploy and no waiting out the cache window.

### Performance
- `GameClient.tsx` now fetches `/api/game/start` and dynamically imports Phaser + all scenes in parallel (`Promise.all`) instead of sequentially — the network round-trip and the JS chunk loads no longer wait on each other.
- `/api/game/complete`, `/api/stages`, and `/play`'s page load now run their independent Sheets reads in parallel instead of one-at-a-time.
- `refreshDailyAmmo` (called on `/play` and `/api/player`) already only writes when `ammoDate` differs from today — confirmed it was not writing on every pageview.
- The home page fires background `fetch()` calls to `/api/stages`, `/api/characters`, and `/api/weapons` on mount to warm the shared server-side sheet cache before the player clicks into Play/Character/Weapon.
- Added `loading.tsx` skeleton screens for `/home`, `/play`, `/character`, `/weapon`, `/equipment`, `/inventory` so navigation shows an immediate skeleton instead of a blank page during the server fetch.

### Pause / exit mid-game
Press **ESC** or the **⏸ PAUSE** button (top-right in the HUD) to pause — physics freezes (`scene.pause()`) and a `PauseScene` overlay appears with **Resume** and **Exit to Home**. Exit calls `onGameEnd` with `completed: false` (no rewards, but kills/deaths are still recorded for analytics), explicitly destroys the Phaser instance, and navigates back to `/home` — this also fixes a potential memory leak where a mid-game exit wouldn't reliably tear down the Phaser canvas.

### Repeatable farm stage
New `Stage.isRepeatable` column. `farm_01` ("Training Grounds") is always unlocked regardless of story progress, gives modest coin/exp with `diamondChance: 0` (grinding can't substitute for real spending), and completing it never advances `currentStage` (completing any `isRepeatable` stage is explicitly excluded from story-progress advancement — otherwise `farm_01`'s trailing `01` would have been misread as stage 1 and corrupted progression). Shown in its own "Farm missions" section in `/play`, tagged with a green **FARM** badge.

### Real character/enemy/cover art now actually loads
Previously `PreloadScene` only ever loaded the stage background — `Player.ts`/`Enemy.ts`/`CoverObject.ts` always generated placeholder shapes and never attempted to load the `sprite` paths from the sheets at all. Now `PreloadScene` loads the equipped character's sprite + bullet sprite, one image per distinct enemy type in the stage (from `Enemies.sprite`), and a fixed set of cover images from `/public/assets/sprites/tilemap/{wall,crate,rock,car,tree}.png` (covers are procedural, not sheet rows, so their art paths are fixed rather than per-stage). Drop real files at any of those paths and they load automatically — still falls back to the generated placeholder if a file is missing. Also reduced enemy scale factors (`heavy-soldier` 1.3→1.15, `boss` 2→1.5, etc.) so enemies read closer to human-proportional next to the player instead of towering over them.

---

## v4: Master Change Request rewrite

This was a large architectural rewrite — real assets wired in, character stats split from weapon stats, per-weapon daily ammo, a passive upgrade system, wave-scaled farm combat, kill-all win conditions with permanent story-stage locking, and a trimmed menu. The v2/v3 ticket-redeem, admin dashboard, and loot-box systems were removed entirely (see "Removed" below).

### Real SVG assets, wired end-to-end
All `public/assets/sprites/**/*.svg` files (5 characters, 11 weapons, 6 equipment pieces, 5 enemies, 2 cover types, 1 tileable background, 1 shop icon) are loaded via `this.load.svg(key, path, { width, height })` in `PreloadScene.ts` and actually displayed — not just loaded and ignored. Every character/enemy sprite shares a 128x128 viewBox; `Player.ts`/`Enemy.ts` both force a fixed 48x48 display size regardless of source art, so units are guaranteed equal on-screen size.

### Character stats vs. weapon stats — cleanly separated
- **Characters** (`bob`, `jackson`, `ryzor`, `mina`, `azzure`) set `hpMax`, `speed` (raw stat, converted to px/s via `PLAYER_CONFIG.speedMultiplier` — not clamped, so Azzure's raw `80` genuinely produces an absurd move speed as an intentional secret/end-game unit), `armorPercent` (a flat damage-reduction %, not a separate HP pool), `regenPer5s` (flat HP tick, always on), plus bonus `accuracy`/`critChance`/`critDamage`.
- **Weapons** (11: pistol → rasor_gun) set `damage`, `fireRate`, `fireMode` (`single | burst | spread | aoe | lob`), `projectileCount`, `accuracy`, `magazineSize`, `reloadTime`, `critChance`/`critDamage`, and `dailyAmmo`.
- `/api/game/start` merges character + equipped weapon + summed equipped-Equipment bonuses + Passive tier bonuses into one `CombatLoadout` (`src/types/loadout.ts`).
- Azzure's `SPECIAL` unlock requires ticket cost **AND** `vipLevel >= 5` **AND** `farmStageMaxWave > 15` — all three, checked in `meetsSpecialRequirements()` (`character.ts`) and enforced server-side in `/api/shop/buy`.

### Fire modes (`src/game/entities/WeaponFire.ts`)
Shared between `Player.ts` and `Enemy.ts` so both fire identically for a given weapon: `single` (one shot), `burst` (N shots staggered ~90ms apart), `spread` (N pellets fanned across an arc, e.g. shotgun's 16 pellets or gatling's 12), `aoe` (rocket — explodes for splash damage in `PLAYER_CONFIG.aoeRadius` on impact), `lob` (grenade — same AoE explosion, but the bullet ignores cover collision entirely so it flies over walls).

### Per-weapon daily ammo (replaces the old generic player-wide ammo pool)
New `PlayerWeaponAmmo` sheet (`playerId, weaponId, remainingAmmo, lastResetDate, adRefillsToday`). Each weapon's `dailyAmmo` quota resets at midnight (same pattern as the old `refreshDailyAmmo`, now in `weaponAmmo.ts`). Two refill paths, both live in the Weapon tab of `/character`: watch a rewarded ad for +10% of quota (capped at 5/day per weapon), or pay 30 diamonds for an instant 100% refill. `dailyAmmoPercent` from Passives boosts the effective quota both refills target.

### Passive system (`PassiveConfig` + `PlayerPassive` sheets)
8 global stats (`hpPercent, critChance, accuracy, damagePercent, reloadSpeedPercent, fireRatePercent, dailyAmmoPercent, critDamagePercent`), 10 tiers each, escalating cost in coin/diamond/ticket depending on the stat. `POST /api/passive/upgrade` buys the next tier; `getPassiveTotals()` sums every owned tier's `bonusPercent` and folds it into `/api/game/start`'s loadout math. New "Passive" tab on `/character`.

### Kill-all win condition + permanent story-stage lock
Reaching a `goalX` no longer exists — a stage now ends when every spawned enemy is dead (`GameScene.checkWinCondition()`). New `PlayerStageProgress` sheet (`playerId, stageId, completed`) marks a **non-repeatable** stage completed exactly once; `/api/game/start` rejects starting an already-completed story stage, and `StageSelectClient` shows "✓ CLEARED" instead of a Play button.

### Farm stage wave scaling
`farm_01` ("Training Grounds") spawns waves procedurally from the full `Enemies` roster (not `StageEnemy` rows — those are story-stage only): wave 1 spawns 3 enemies, `+1` enemy every 3 waves, and HP/damage compound `×1.1` per wave (`GameScene.spawnWave()`). Clearing a wave immediately starts the next one — the stage only ends via Pause → Exit or the player. `Players.farmStageMaxWave` records the best wave ever reached (also gates Azzure).

### Menu trimmed to spec
Main flow: Home → Character/Weapon+Passive (`/character`, tabbed) → Inventory (`/inventory`, drag-and-drop equip hub) → Play. Secondary menu: Shop, Mission, Leaderboard, Mailbox, Settings — exactly five. `/weapon` and `/equipment` as standalone pages were folded into `/character` and `/inventory` respectively.

### Drag-and-drop inventory hub
`/inventory` shows the equipped character centered, with four corner slots (weapon, helmet, vest, boots) — click a slot to open a picker list, or drag an item from the bottom inventory grid onto the matching slot (native HTML5 Drag and Drop API, no added dependency). Dropping an item on the wrong slot is rejected client-side; the server (`/api/weapon/equip`, `/api/equipment/equip`) is still the source of truth.

### Removed entirely
- **Ticket → TrueMoney redeem system** (`Redeem` sheet, `/api/ticket/redeem`, the VIP-topup-threshold formula) — no UI used it. `ticket` is still a plain currency (used to buy Mina, Sniper, Rocket/Grenade Launcher, Rasor Gun, and Passive tiers). `vipLevel` is now a **manual field** on `Players` — set it directly in the sheet; the topup→VIP formula will be defined later.
- **Admin dashboard** (`/admin`, `/api/admin/*`) and the `Config`/`Analytics` sheets — no code read `Analytics`, and admin currency edits are simplest done by editing the `Players` sheet directly.
- **Loot boxes** (`LootBox`/`LootBoxItem`, `/api/lootbox`) — Shop is back to a direct equipment-purchase catalog (`Shop` sheet: `id, equipmentId, priceCoin, priceDiamond, priceTicket`), one row per purchasable item, no RNG.
- **`/daily`** — merged into `/mission` as `Mission.type = "daily"` rows alongside `"personal"` ones, sharing one `PlayerMission` progress sheet.
- The old generic `Players.ammo/ammoDate/adsWatchedToday` fields — fully superseded by per-weapon `PlayerWeaponAmmo`.

### A real data bug caught during migration
Bulk-seeding `Characters` via a single `values.append` call silently corrupted Azzure's `speed` from `80` to `8` (single-value `values.update` afterward fixed it correctly — cause looks like a batched-append quirk, not a code bug, but worth knowing if you bulk-seed large rows again: verify numeric values landed correctly, don't assume `appendRows` is lossless for every cell).

### Account reset tool
`scripts/reset-player.ts <email>` resets a player to a brand-new state: starting currency, level 1, stage 1, Bob+Pistol as the only owned character/weapon, and clears `PlayerCharacter`/`PlayerWeapon`/`PlayerEquipment`/`PlayerStageProgress`/`PlayerWeaponAmmo`/`PlayerPassive`/`PlayerMission` rows for that player. Creates the account fresh if it doesn't exist yet (useful for Google-OAuth-only accounts that haven't logged in yet). Requires the email as a CLI arg on purpose — no accidental runs. Already run once for `earth.noppanut@gmail.com` per this request.
