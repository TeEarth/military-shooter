/** Data-driven content for the How to Play guide (src/app/how-to-play).
 *  Adding a new topic is just adding an entry here — no UI changes needed.
 *  Images reference real in-game asset files (public/assets/sprites/...). */

export interface HowToPlayImage {
  src: string;
  caption: string;
}

export interface HowToPlaySection {
  id: string;
  category: string;
  label: string;
  icon: string;
  title: string;
  images?: HowToPlayImage[];
  body: string[];
  tips?: string[];
}

export const HOW_TO_PLAY_CATEGORIES = [
  "Combat Basics",
  "Perks",
  "Stealth & Enemies",
  "Game Modes",
  "Progression",
  "Characters & Gear",
  "Economy",
  "Multiplayer",
] as const;

export const HOW_TO_PLAY_SECTIONS: HowToPlaySection[] = [
  // ---------- Combat Basics ----------
  {
    id: "movement",
    category: "Combat Basics",
    label: "Move & Aim",
    icon: "/assets/sprites/characters/soldier_player.svg",
    title: "Movement & Aiming",
    images: [{ src: "/assets/sprites/characters/bob_private.svg", caption: "Your soldier — always faces the direction you're aiming." }],
    body: [
      "Desktop: WASD or the arrow keys move your character; the mouse controls aim direction independently of movement, so you can strafe while facing an enemy.",
      "Mobile Layout 1 (default touch): drag the left half of the screen to move. Tap and hold anywhere on the right half to aim AND fire at that exact spot — release to stop.",
      "Mobile Layout 2: two fixed sticks — the left one moves, the right one aims and fires in whatever direction you drag it.",
      "Switch between the two mobile layouts, and resize both sticks, from Settings → Mobile Controls.",
    ],
    tips: [
      "Movement speed varies per character (see each character's SPEED stat on the Character page) — faster characters can kite tougher enemies more safely.",
      "You can move and shoot at the same time — there's no stationary-only firing mode.",
    ],
  },
  {
    id: "shooting",
    category: "Combat Basics",
    label: "Shooting",
    icon: "/assets/sprites/weapons/pistol.svg",
    title: "Shooting",
    images: [{ src: "/assets/sprites/bullets/bullet_round.svg", caption: "A standard round — every weapon has its own bullet sprite and speed." }],
    body: [
      "Desktop: left-click or hold Space to fire. Mobile: fire is built into the aim control (see Move & Aim above).",
      "Each weapon has its own fire rate, magazine size, accuracy, and fire mode — single-shot, burst, spread (shotgun-style), lobbed (grenade/rocket arcs), or AoE (splash damage on impact).",
      "Accuracy affects how tightly your shots cluster around the aim point — lower-accuracy weapons (like shotguns) spread more per shot but can hit multiple targets.",
      "Critical hits deal bonus damage at a chance determined by your weapon + character + equipment critical stats.",
    ],
    tips: [
      "Sniper rifles draw a real aiming laser line — use it to line up shots through gaps in cover before committing.",
      "AoE weapons (rocket launcher, grenade launcher) damage everything in the blast radius, including you if you're too close — keep distance when using them.",
    ],
  },
  {
    id: "reload",
    category: "Combat Basics",
    label: "Reload",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Reloading",
    body: [
      "Press R, right-click, or tap the on-screen RELOAD button to reload. Reloading is automatic once your magazine hits 0 and you try to fire again.",
      "Reload time varies per weapon — check the RELOAD stat on the Weapon tab of the Character page. A progress bar and countdown appear on the HUD while reloading.",
      "You can't fire while reloading, so time it for a lull in combat, ideally behind cover or while hidden.",
      "Daily ammo is a separate pool per weapon (see AMMO below) — reloading refills your magazine from that reserve, not from nowhere. Once the reserve hits 0, reloading can't refill anymore.",
    ],
    tips: [
      "If you own the Spare Weapon perk, swap to your second weapon instead of standing still through a slow reload.",
    ],
  },
  {
    id: "ammo-and-weapon-swap",
    category: "Combat Basics",
    label: "Ammo & Weapon Swap",
    icon: "/assets/sprites/weapons/double_pistol.svg",
    title: "Daily Ammo & Switching Weapons",
    body: [
      "Every weapon has a daily ammo pool (its magazine size × however many reloads it's worth) that resets once per day — shown as a bar on the Weapon tab and mid-stage on the HUD.",
      "Run out mid-stage? Use the on-screen REFILL button (PvE only) to top up by watching a rewarded ad or spending diamonds.",
      "Equip a different weapon anytime from the Character page's Weapon tab — your loadout carries into the next stage, farm run, or PvP match you start.",
      "The Spare Weapon perk (see Perks) lets you carry a SECOND weapon into a run and swap between the two mid-combat with the SWAP button, each with its own independent magazine/ammo.",
    ],
    tips: ["PvP doesn't touch your daily ammo pool at all — only magazine size applies there, so you can always practice freely."],
  },

  // ---------- Perks ----------
  {
    id: "perks-overview",
    category: "Perks",
    label: "What Are Perks?",
    icon: "/assets/sprites/ui/star_upgrade.svg",
    title: "Perks Overview",
    body: [
      "Perks are one-time ticket purchases from the Character page's Perks tab — once bought, they're permanent and work the same way in every mode (PvE story/farm/boss and PvP).",
      "Each perk gets its own on-screen button or status icon once owned — nothing to configure, just tap/click to use.",
      "There are 6 perks: Spare Weapon, Regeneration, Super Shield, One Shot, Invisible, and Never Died — each detailed below.",
    ],
    tips: ["Clickable perks (Spare Weapon, One Shot) stack as buttons above Reload, bottom-right. Fully automatic perks (Regeneration, Super Shield, Invisible, Never Died) just show a status icon, top-right — nothing to press."],
  },
  {
    id: "perk-spare-weapon",
    category: "Perks",
    label: "Spare Weapon",
    icon: "/assets/sprites/weapons/rasor_gun.svg",
    title: "Perk: Spare Weapon",
    body: [
      "Lets you set a second owned weapon as a \"spare\" and carry both into a run. Tap the SWAP button to switch between them — each keeps its own magazine and ammo independently.",
      "Great for pairing a long-range weapon with a close-range one, or keeping a backup ready while the other reloads.",
      "Swapping has a short cooldown, and you can't swap mid-reload.",
    ],
    tips: ["Set your spare weapon from the Character page before starting a run — it's locked in for that whole run once you launch."],
  },
  {
    id: "perk-regen",
    category: "Perks",
    label: "Regeneration",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Perk: Regeneration",
    body: [
      "Automatically triggers a full heal the instant your HP drops below 20% — no button to press, it just happens.",
      "Has a cooldown afterward before it can trigger again — the HUD's REGEN icon shows whether it's ready or counting down.",
    ],
    tips: ["Pairs well with aggressive playstyles — you can push into risky fights knowing a near-death moment gets bailed out once."],
  },
  {
    id: "perk-super-shield",
    category: "Perks",
    label: "Super Shield",
    icon: "/assets/sprites/equipment/vest_epic.svg",
    title: "Perk: Super Shield",
    body: [
      "If your shield (from equipped gear) stays completely empty for 15 continuous seconds, this perk automatically refills it to 50% of max — also automatic, no button.",
      "Has its own cooldown after triggering. The HUD's SHIELD icon shows the 15s countdown once your shield first hits 0, then the post-trigger cooldown.",
    ],
    tips: ["Only useful if you actually have shield capacity from equipped gear — check your SHIELD stat before relying on it."],
  },
  {
    id: "perk-one-shot",
    category: "Perks",
    label: "One Shot",
    icon: "/assets/sprites/ui/star_upgrade.svg",
    title: "Perk: One Shot",
    body: [
      "Tap the skull button to ARM your next shot — that single shot deals massive fixed damage (or a wide-but-weaker AoE blast for rocket/grenade weapons), guaranteed to hit (no accuracy/crit RNG).",
      "Long cooldown after arming, whether or not you actually land the shot — arm it right before you intend to fire, not early.",
    ],
    tips: [
      "Save it for tough single targets (boss stages, a PvP opponent at low HP) rather than trash enemies — the cooldown is long enough that using it carelessly wastes its value.",
      "Make sure you're not accidentally clicking through a UI button when you mean to fire the armed shot — check Settings if you notice any input weirdness.",
    ],
  },
  {
    id: "perk-invisible",
    category: "Perks",
    label: "Invisible",
    icon: "/assets/sprites/tilemap/obstacle_tree.svg",
    title: "Perk: Invisible",
    body: [
      "Fully automatic, no button — loops from the moment a match/stage starts until it ends: every 15 seconds you turn invisible to every enemy for 2 seconds.",
      "Unlike tree stealth, you can keep moving and shooting the entire time you're invisible — it doesn't require standing still or breaking line of sight.",
      "The HUD's INVISIBLE status icon shows ACTIVE while the 2s window is live, and counts down the 15s cooldown the rest of the time.",
    ],
    tips: ["Use the 2s window to reposition aggressively or slip past a dangerous angle — enemies keep patrolling as if you were never there."],
  },
  {
    id: "perk-never-died",
    category: "Perks",
    label: "Never Died",
    icon: "/assets/sprites/equipment/vest_epic.svg",
    title: "Perk: Never Died",
    body: [
      "A one-time \"last stand\" save, automatic and free — no button. The FIRST time a hit would take your HP to 0, your HP is locked at 1 instead and you're fully invincible for 3 seconds.",
      "During those 3 seconds you take zero damage from any source and can't die, but everything else works normally — you can still move, shoot, reload, and use other perks.",
      "Only triggers once per match/stage — once used, the HUD's NEVER DIED icon dims and shows USED for the rest of that run. It resets fresh on your next match/stage.",
      "A big \"NEVER DIED ACTIVATED!\" banner, a distinct chime, and a gold glow around your character all confirm the moment it triggers.",
    ],
    tips: ["It's a safety net, not extra HP or damage reduction — you still take full damage on every hit before and after the one save."],
  },

  // ---------- Stealth & Enemies ----------
  {
    id: "stealth",
    category: "Stealth & Enemies",
    label: "Stealth",
    icon: "/assets/sprites/tilemap/obstacle_tree.svg",
    title: "Stealth — Hiding in Trees",
    images: [{ src: "/assets/sprites/tilemap/obstacle_tree.svg", caption: "Trees are the only cover you can hide inside — bullets and footsteps pass straight through them." }],
    body: [
      "Trees behave differently from every other cover type: bullets and movement pass through them freely, but standing still near one (not moving, not shooting, not being shot) for about a second makes you HIDDEN.",
      "While hidden, nearby enemies lose track of you completely and fall back to patrolling — they can't detect you at any range until you move, shoot, or take damage again.",
      "The HUD shows a hide-progress bar while you're building up to hidden, and a HIDDEN label once it's active.",
    ],
    tips: [
      "Break contact by ducking into a tree's radius when your HP is low or you're overwhelmed — it's a free reset, not a one-time item.",
      "Don't fire from inside a tree expecting to stay hidden — shooting immediately breaks stealth.",
    ],
  },
  {
    id: "enemy-detection",
    category: "Stealth & Enemies",
    label: "Enemy Detection",
    icon: "/assets/sprites/enemy/enemy_pistol.svg",
    title: "How Enemies Detect & Engage You",
    body: [
      "Enemies operate in distance bands: far away they simply patrol; inside their detection range they close the distance; within shooting range they fire while (slowly) advancing; inside their preferred range they plant and unload.",
      "Every enemy carries a real weapon with its own damage/fire rate/accuracy — a shotgunner and a sniper play very differently even at the same HP.",
      "When a stage or wave first loads, enemies freeze for a few seconds (visibly blinking) so you get a moment to find cover before combat actually starts.",
      "Immobile enemies (turrets) never patrol or chase — they just stand their ground and fire at anything in range.",
    ],
    tips: ["Use the freeze window at the start of every wave/stage to reposition into cover before the first shots are fired."],
  },
  {
    id: "enemy-types",
    category: "Stealth & Enemies",
    label: "Enemy Types",
    icon: "/assets/sprites/enemy/enemy_shotgun.svg",
    title: "Enemy Types",
    images: [
      { src: "/assets/sprites/enemy/enemy_pistol.svg", caption: "Pistol — the most common, weakest enemy type." },
      { src: "/assets/sprites/enemy/enemy_shotgun.svg", caption: "Shotgun — dangerous up close, high HP." },
      { src: "/assets/sprites/enemy/enemy_sniper.svg", caption: "Sniper — high accuracy at any range." },
      { src: "/assets/sprites/enemy/enemy_rocket.svg", caption: "Rocket — AoE splash damage." },
      { src: "/assets/sprites/enemy/enemy_turret.svg", caption: "Turret — immobile, never chases." },
      { src: "/assets/sprites/enemy/enemy_boss.svg", caption: "Boss — encountered at the end of every Multiverse." },
    ],
    body: [
      "Pistol/AK47 — baseline enemies, low-to-mid HP, moderate damage.",
      "Shotgun — high HP, devastating up close but easy to out-range.",
      "Sniper — high accuracy at any distance, moderate HP; dangerous even from far away.",
      "Rocket/Grenade Launcher — AoE splash, so spreading out or breaking line of sight matters more than usual.",
      "Rasor Gun — a rare, high-damage enemy type unlocked into farm rosters at higher waves.",
      "Turret — immobile, never patrols or chases, just holds a position and fires at anything in range.",
      "Boss — a unique, high-HP enemy at the end of every Multiverse's story stages, with its own arena and summoned reinforcements.",
    ],
  },

  // ---------- Game Modes ----------
  {
    id: "story-stages",
    category: "Game Modes",
    label: "Story Stages",
    icon: "/assets/sprites/tilemap/obstacle_house.svg",
    title: "Story Stages",
    body: [
      "Each story stage has a fixed, hand-placed set of enemies — eliminate all of them to clear it.",
      "A story stage can only be cleared ONCE — there's no replaying an already-cleared stage (Retry only appears if you lose, not after a win).",
      "Clearing a stage grants a fixed coin + EXP reward and unlocks the next stage number. A NEXT STAGE button appears on the results screen so you don't need to return to Home between clears.",
      "Every 10 stages forms a Multiverse — clearing stage 10 unlocks that Multiverse's Boss Stage, and beating the boss unlocks the next Multiverse's story stages.",
    ],
  },
  {
    id: "training-grounds",
    category: "Game Modes",
    label: "Training Grounds (Farm)",
    icon: "/assets/sprites/tilemap/cover_crate.svg",
    title: "Training Grounds — Farm Stages",
    body: [
      "Farm stages are repeatable, endless-wave survival — unlike story stages, you can replay them as many times as you like.",
      "Enemies spawn in escalating waves; every new wave briefly freezes right after spawning so you can reposition first.",
      "Tougher enemy types unlock as your wave number climbs, and your best-ever wave reached unlocks certain weapons/characters for purchase.",
      "Reward is based on the highest wave you reach that run PLUS coin from any kills — there's no fixed \"clear\" bonus like a story stage. Quitting mid-wave still banks credit for the highest wave you fully cleared.",
    ],
    tips: ["Farm stages are the best place to practice a new weapon or perk — there's no risk of \"wasting\" a one-time story clear."],
  },
  {
    id: "boss-stages",
    category: "Game Modes",
    label: "Boss Stages",
    icon: "/assets/sprites/enemy/enemy_boss.svg",
    title: "Boss Stages",
    body: [
      "Unlocked after clearing stage 10/20/30... (once per Multiverse) — a single massive-HP boss fight with a large HP bar across the top of the screen.",
      "Boss arenas have zero cover at all, so positioning and ammo management matter more than hiding.",
      "The boss periodically calls in a fresh minion reinforcement at its own position — watch your flanks whenever you hear/see one appear.",
      "Beating a boss grants a large coin/diamond/ticket/banknote reward and unlocks the next Multiverse's story stages.",
    ],
  },
  {
    id: "tutorial-mode",
    category: "Game Modes",
    label: "Tutorial (Training Mode)",
    icon: "/assets/sprites/characters/soldier_player.svg",
    title: "Tutorial — Training Mode",
    body: [
      "New accounts start with a short, guided Tutorial on a dedicated Training Stage — it walks through movement, shooting, reloading, defeating an enemy, and stealth, one step at a time.",
      "It only ever shows once per account, and grants +10 tickets on completion. Quitting partway through resumes at the exact step you left off.",
    ],
  },
  {
    id: "missions",
    category: "Game Modes",
    label: "Missions",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Missions",
    body: [
      "The Mission page lists ongoing objectives — clearing stages, getting kills, reaching a farm wave — that pay out coin, EXP, or tickets once completed.",
      "Some missions are auto-generated milestones (e.g. reaching farm wave 5/10/15...) that scale their reward with the tier.",
      "Missions don't expire on their own — check back regularly so you don't leave free rewards unclaimed.",
    ],
  },

  // ---------- Progression ----------
  {
    id: "exp-and-vip",
    category: "Progression",
    label: "EXP & VIP Level",
    icon: "/assets/sprites/ui/star_upgrade.svg",
    title: "EXP & VIP Level",
    body: [
      "All EXP feeds a single VIP level, from VIP 0 up to VIP 10 (max) — shown on the Home page's top bar with a progress bar toward the next level.",
      "EXP sources: clearing a story stage (fixed amount), clearing a wave in a Farm stage (scales with the wave reached), and completing Missions.",
      "PvP and Gacha do NOT grant EXP — only real stage clears and missions do.",
      "Reaching VIP 10 for the first time grants a one-time bonus of green banknotes.",
    ],
    tips: ["Farm stages only bank EXP for waves you actually FINISH clearing — dying or quitting mid-wave doesn't grant credit for that in-progress wave."],
  },
  {
    id: "passive-upgrades",
    category: "Progression",
    label: "Passive Upgrades",
    icon: "/assets/sprites/ui/star_upgrade.svg",
    title: "Passive Upgrades",
    body: [
      "Permanent stat boosts (HP%, damage%, accuracy, reload speed, fire rate, daily ammo%, crit chance/damage) bought with coin from the Character page's Passive tab.",
      "Each tier costs more than the last, up to tier 10 per stat — these stack on top of whatever character/weapon/equipment you have equipped, applying everywhere.",
    ],
    tips: ["Passive upgrades are permanent and never reset — even a small amount of spare coin is worth investing here between runs."],
  },
  {
    id: "leaderboard",
    category: "Progression",
    label: "Leaderboard",
    icon: "/assets/sprites/ui/star_upgrade.svg",
    title: "Leaderboard",
    body: [
      "Ranks players by their highest Farm-stage wave reached, resetting weekly — separate from your permanent all-time best wave.",
      "Top-ranked players earn bonus rewards when the week resets.",
    ],
  },

  // ---------- Characters & Gear ----------
  {
    id: "characters",
    category: "Characters & Gear",
    label: "Characters",
    icon: "/assets/sprites/characters/bob_private.svg",
    title: "Characters",
    images: [
      { src: "/assets/sprites/characters/bob_private.svg", caption: "Bob — Private, free starting character." },
      { src: "/assets/sprites/characters/jackson_sergeant.svg", caption: "Jackson — Sergeant, coin-purchase." },
      { src: "/assets/sprites/characters/ryzor_lieutenant.svg", caption: "Ryzor — Lieutenant, diamond-purchase." },
      { src: "/assets/sprites/characters/mina_captain.svg", caption: "Mina — Captain, ticket-purchase." },
      { src: "/assets/sprites/characters/azzure_colonel.svg", caption: "Azzure — Colonel, special unlock (VIP + best farm wave)." },
    ],
    body: [
      "Each character has its own base HP, speed, accuracy, regen, armor, and crit stats — pick one that fits your playstyle.",
      "Unlock types vary: free, coin purchase, diamond purchase, ticket purchase, story-stage-gated, or SPECIAL (requires a minimum VIP level AND a minimum best farm wave).",
      "Equip a character from the Character page — it applies immediately to your next stage, farm run, or PvP match.",
    ],
  },
  {
    id: "character-skins",
    category: "Characters & Gear",
    label: "Color Skins",
    icon: "/assets/sprites/ui/gacha_burst.svg",
    title: "Character Color Skins",
    body: [
      "Cosmetic color-tint skins, bought with coin from the Character page — 5 colors per character (Default is free), each character keeps its OWN separate colors and equipped choice.",
      "Preview a color instantly by clicking a swatch before buying — nothing is charged until you press Confirm. Once confirmed, it applies immediately everywhere that character is shown (Home, Character page, in-game, PvP) with no reload needed.",
      "Purely cosmetic — never changes a character's actual stats or silhouette.",
      "You must already OWN a character before you can customize its color — the Color Skin section stays locked (with a 🔒 message) on any character you haven't unlocked yet.",
    ],
  },
  {
    id: "character-upgrade",
    category: "Characters & Gear",
    label: "Character Upgrade",
    icon: "/assets/sprites/ui/star_upgrade.svg",
    title: "Character Upgrade — Permanent HP",
    body: [
      "A permanent, uncapped HP boost bought with coin from the Character page — each level adds +10% of that character's ORIGINAL base HP (not compounding off the already-upgraded value), so 10 levels is always exactly +100%, never more.",
      "Cost doubles every level (50, 100, 200, 400 coin...) — independent PER character, upgrading one never touches any other character's level.",
      "Requires owning the character first — locked (with a 🔒 message) on anything you haven't unlocked yet.",
      "The cost shown always reflects the real price, even when you can't currently afford it — the button just shows NOT ENOUGH COIN alongside the exact amount instead of hiding it.",
    ],
    tips: ["This stacks with every other HP source (character base, passive HP%, equipment) — check the CURRENT HP / NEXT HP numbers on the upgrade panel to see the exact gain before buying."],
  },
  {
    id: "weapon-upgrade",
    category: "Characters & Gear",
    label: "Weapon Upgrade",
    icon: "/assets/sprites/weapons/ak47.svg",
    title: "Weapon Upgrade — Permanent Damage",
    body: [
      "Same shape as Character Upgrade, but for damage: a permanent, uncapped +10% of the weapon's ORIGINAL base damage per level, bought with coin from the Weapon tab.",
      "Cost TRIPLES every level (50, 150, 450, 1350 coin...) — independent PER weapon.",
      "Requires owning the weapon first — the Weapon Upgrade section only appears once a weapon is actually owned.",
      "Like Character Upgrade, the cost always stays visible even when you're short on coin.",
    ],
  },
  {
    id: "weapons",
    category: "Characters & Gear",
    label: "Weapons",
    icon: "/assets/sprites/weapons/ak47.svg",
    title: "Weapons",
    images: [
      { src: "/assets/sprites/weapons/pistol.svg", caption: "Pistol — free starting weapon." },
      { src: "/assets/sprites/weapons/shotgun.svg", caption: "Shotgun — short range, wide spread." },
      { src: "/assets/sprites/weapons/sniper.svg", caption: "Sniper — long range, high accuracy, slow fire rate." },
      { src: "/assets/sprites/weapons/rocket_launcher.svg", caption: "Rocket Launcher — AoE splash damage." },
      { src: "/assets/sprites/weapons/gatling.svg", caption: "Gatling — very high fire rate." },
    ],
    body: [
      "Every weapon has its own damage, fire rate, fire mode, accuracy, magazine size, reload time, crit stats, and daily ammo pool.",
      "Unlock types: free, coin, diamond, ticket, story-stage-gated, or farm-wave-gated (unlocked once your all-time best farm wave reaches a threshold, in ANY Multiverse).",
      "Buy and equip from the Character page's Weapon tab — equipping doesn't require owning the weapon outright first for FREE-type weapons, but every other type must be purchased before it can be equipped.",
    ],
    tips: ["Match your weapon to your playstyle: shotguns reward aggressive close range, snipers reward patient long range, AoE weapons reward crowd control."],
  },

  // ---------- Economy ----------
  {
    id: "currencies",
    category: "Economy",
    label: "Currencies",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Currencies",
    body: [
      "🪙 Coin — earned from stage/farm clears and kills; spent on weapons, characters, passive upgrades, and skin colors.",
      "💎 Diamond — premium currency; spent mainly on Gacha pulls and ammo refills.",
      "🎟️ Ticket — spent on PvP entry, revives, and some weapon/perk unlocks; earned from missions, Tutorial completion, and top-ups.",
      "💵 Green Banknote — earned from boss kills and personal stage-clear milestones; the ONLY currency that converts to real money via withdrawal.",
    ],
  },
  {
    id: "shop-and-trade",
    category: "Economy",
    label: "Trade / Exchange",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Trade — Exchanging Resources",
    body: [
      "The Trade page converts between in-game currencies (e.g. coin ↔ diamond) at fixed rates.",
      "This is separate from real-money top-up and cash withdrawal — Trade only ever moves in-game currencies against each other.",
    ],
  },
  {
    id: "gacha",
    category: "Economy",
    label: "Gacha",
    icon: "/assets/sprites/ui/gacha_burst.svg",
    title: "Gacha",
    images: [{ src: "/assets/sprites/ui/gacha_capsule_ticket.svg", caption: "A Gacha capsule pull." }],
    body: [
      "Spends diamonds or tickets on a randomized pull for characters, weapons, or equipment.",
      "Use the Skip button during the reveal animation to see the result immediately instead of watching the full reveal.",
      "Multi-pull discounts (when configured) are shown right on the pull button.",
    ],
  },
  {
    id: "top-up-and-cash-out",
    category: "Economy",
    label: "Top Up & Cash Out",
    icon: "/assets/sprites/ui/gacha_capsule_ticket.svg",
    title: "Topping Up & Cashing Out",
    body: [
      "Income page's Top Up section sells ticket packages for real money via card or PromptPay QR — PromptPay confirms automatically once scanned and paid, no refresh needed.",
      "Your top-up history (date, amount, method, status) is listed right under the packages.",
      "Green Banknotes can be withdrawn to a TrueMoney Wallet number (1 banknote = ฿1, capped at 100 baht/day) — withdrawals are reviewed and paid out manually by an admin, not instantly. Check Mailbox for the approval notice.",
    ],
  },
  {
    id: "mailbox",
    category: "Economy",
    label: "Mailbox",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Mailbox & Rewards",
    body: [
      "The Mailbox holds admin-sent rewards and system notices (like withdrawal approvals) — claim any pending reward directly from there.",
      "An unread-count badge appears on the Home page's Mailbox button whenever something's waiting.",
    ],
  },

  // ---------- Multiplayer ----------
  {
    id: "pvp",
    category: "Multiplayer",
    label: "PvP Arena",
    icon: "/assets/sprites/weapons/double_pistol.svg",
    title: "PvP",
    body: [
      "Real-time 1v1 — tap FIND MATCH and you'll be paired with the next player also searching, usually within seconds.",
      "Entry costs 5 tickets, charged only once actually matched; winning grants tickets, losing grants diamonds as a consolation.",
      "Your equipped character, weapon, passive upgrades, AND perks all carry into the match exactly like PvE — daily ammo limits don't apply, only magazine size.",
      "There's no pause in PvP (it would desync the live match) — make sure you're ready before queuing. Use the EXIT button to forfeit if you need to leave.",
    ],
    tips: ["All 6 perks (Spare Weapon, Regen, Super Shield, One Shot, Invisible, Never Died) work identically in PvP as in PvE — don't forget you have them mid-match."],
  },
];
