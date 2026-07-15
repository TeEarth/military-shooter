import Phaser from "phaser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Player } from "@/game/entities/Player";
import { RemotePlayer, type RemoteSnapshot } from "@/game/entities/RemotePlayer";
import { MobileControls } from "@/game/entities/MobileControls";
import type { StageData } from "@/types/stage";
import type { CombatLoadout } from "@/types/loadout";
import { PLAYER_CONFIG } from "../../../config/player";
import { sfx } from "@/lib/sfx";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

interface PvpOpponentInfo {
  id: string;
  username: string;
  sprite: string;
  weaponId: string;
}

/** How often (ms) this client broadcasts its own position/rotation/hp/firing
 *  state — 12Hz is plenty for a 2D top-down shooter and stays well inside
 *  Supabase Realtime's free-tier message quota for a 1v1 channel. */
const BROADCAST_INTERVAL_MS = 80;

/**
 * Real-time 1v1 PvP arena — sibling to GameScene, not a modification of it.
 * The local Player uses the exact same input/rendering as single-player
 * (desktop keys/mouse + MobileControls). The opponent is a RemotePlayer,
 * driven entirely by Realtime broadcast snapshots from their own client —
 * see the class doc on RemotePlayer for why (no server-authoritative netcode
 * in this v1; each client is trusted to report its own state and the damage
 * it deals to the other side).
 */
export class PvpScene extends Phaser.Scene {
  private player!: Player;
  private remotePlayer!: RemotePlayer;
  private bullets!: Phaser.Physics.Arcade.Group;

  private stageData!: StageData;
  private matchId!: string;
  private isPlayer1 = false;
  private opponent!: PvpOpponentInfo;
  private myId = "";

  private channel!: RealtimeChannel;
  private channelReady = false;
  private lastBroadcast = 0;
  private isFiring = false;
  private matchEnded = false;
  /** v25: bullets that overlapped remotePlayer.sprite this physics step,
   *  queued here instead of being processed (destroyed, etc.) immediately —
   *  see onBulletHitOpponent for why. */
  private pendingOpponentHits: Phaser.Physics.Arcade.Image[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private shootKey!: Phaser.Input.Keyboard.Key;
  private reloadKey!: Phaser.Input.Keyboard.Key;
  private reloadRequested = false;
  private failedAssetKeys!: Set<string>;
  private mobileControls?: MobileControls;

  constructor() {
    super({ key: "PvpScene" });
  }

  create() {
    this.stageData = this.registry.get("stageData") as StageData;
    this.matchId = this.registry.get("pvpMatchId") as string;
    this.isPlayer1 = Boolean(this.registry.get("pvpIsPlayer1"));
    this.opponent = this.registry.get("pvpOpponent") as PvpOpponentInfo;
    this.myId = this.registry.get("pvpMyId") as string;
    const opponentSpawn = this.registry.get("pvpOpponentSpawn") as { x: number; y: number };
    const character = this.registry.get("character") as CombatLoadout;
    this.failedAssetKeys = (this.registry.get("failedAssetKeys") as Set<string>) ?? new Set();
    this.matchEnded = false;

    sfx.startMusicLoop();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      sfx.stopMusicLoop();
      this.channel?.unsubscribe();
    });

    const { width: worldWidth, height: worldHeight } = this.stageData;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    const hasBg = this.textures.exists("stage_bg") && !this.failedAssetKeys.has("stage_bg");
    if (hasBg) {
      this.add.tileSprite(0, 0, worldWidth, worldHeight, "stage_bg").setOrigin(0, 0).setDepth(0);
    } else {
      this.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 0x2a2a3e).setDepth(0);
    }

    this.bullets = this.physics.add.group({ maxSize: 80, runChildUpdate: false });

    const spawnX = this.stageData.playerSpawnX || worldWidth * 0.15;
    const spawnY = this.stageData.playerSpawnY || worldHeight / 2;
    this.player = new Player(this, spawnX, spawnY, this.bullets, character, this.failedAssetKeys);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    this.remotePlayer = new RemotePlayer(this, opponentSpawn.x, opponentSpawn.y, this.opponent.username, this.opponent.sprite, this.failedAssetKeys);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.reloadKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.triggerReload();
    });

    if (this.registry.get("isMobile")) {
      this.mobileControls = new MobileControls(this, this.registry.get("mobileControlScheme"));
    }

    // v25 REAL root cause of "opponent vanishes on any hit/miss", finally
    // confirmed: for a GROUP-vs-single-SPRITE overlap, Phaser invokes the
    // callback as (sprite, groupMember) — the single sprite comes FIRST,
    // regardless of the order they were registered in. GameScene's own
    // enemyBullets-vs-player overlap already knew this (its callback is
    // named `(_playerObj, bulletObj)`), but this one took the first arg as
    // the bullet — so every bullet contact was actually flagging and
    // DESTROYING this.remotePlayer.sprite itself, not the bullet. That's
    // why the opponent's body vanished instantly on every shot with every
    // weapon (their sprite was literally destroyed), why a later
    // applySnapshot crashed on the destroyed sprite's missing body, and why
    // no amount of deferring the destroy helped — we were deferring the
    // destruction of the wrong object. Resolved defensively by identity
    // check rather than positionally, so it keeps working even if Phaser's
    // internal arg order ever changes.
    this.physics.add.overlap(this.bullets, this.remotePlayer.sprite, (a, b) => {
      const bulletObj = a === this.remotePlayer.sprite ? b : a;
      this.onBulletHitOpponent(bulletObj as Phaser.Physics.Arcade.Image);
    });

    this.events.on("lob-detonate", (data: { x: number; y: number; damage: number; explosionRadius: number }) => {
      sfx.play("explosion");
      // v25 fix: this circle was never stored/cleaned up — unlike GameScene's
      // identical effect (which fades it out and destroys it after 300ms),
      // this one was a permanent decal. Repeated AOE shots near the same
      // spot (very likely once the opponent is cornered/stationary) stacked
      // dozens of these translucent orange circles on top of each other,
      // and the compounding opacity eventually buried the character
      // underneath completely — exactly the "character disappears" report.
      const explosion = this.add.circle(data.x, data.y, data.explosionRadius, 0xff8800, 0.35).setDepth(15);
      this.tweens.add({ targets: explosion, alpha: 0, scale: 1.3, duration: 300, onComplete: () => explosion.destroy() });
      const dist = Phaser.Math.Distance.Between(data.x, data.y, this.remotePlayer.sprite.x, this.remotePlayer.sprite.y);
      if (dist <= data.explosionRadius && data.damage > 0) {
        this.reportHit(data.damage);
      }
    });

    this.setupRealtimeChannel();

    this.scene.launch("HUDScene", { stageData: this.stageData });
  }

  private setupRealtimeChannel() {
    const supabase = getBrowserSupabaseClient();
    this.channel = supabase.channel(`pvp:${this.matchId}`, { config: { broadcast: { self: false } } });

    this.channel.on("broadcast", { event: "state" }, ({ payload }) => {
      this.remotePlayer.applySnapshot(payload as RemoteSnapshot, this.failedAssetKeys);
    });

    this.channel.on("broadcast", { event: "hit" }, ({ payload }) => {
      const { targetId, damage } = payload as { targetId: string; damage: number };
      if (targetId !== this.myId || this.player.isDead) return;
      this.player.takeDamage(damage);
      sfx.play("hurt_player");
      this.showFloatingText(this.player.sprite.x, this.player.sprite.y - 20, `-${Math.round(damage)}`, "#ff4444");
      if (this.player.isDead) this.handleLoss();
    });

    // v25 fix: broadcastState()/reportHit() used to call channel.send()
    // unconditionally from the very first update() tick — but subscribe() is
    // async (a real WebSocket handshake), so almost every early send() landed
    // before the channel actually joined. supabase-js silently falls back to
    // a one-off REST POST in that case (see console: "Realtime send() is
    // automatically falling back to REST API"), which does not reliably fan
    // out to the other player's still-connecting WebSocket subscription —
    // this is exactly why opponents looked frozen/unresponsive and hits
    // never seemed to land. channelReady now gates every send() until
    // subscribe()'s callback actually reports "SUBSCRIBED".
    this.channel.subscribe((status) => {
      this.channelReady = status === "SUBSCRIBED";
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.error(`[PvP] realtime channel ${status.toLowerCase()}`);
      }
    });
  }

  /** Bullet directly overlapping the opponent's rendered position on THIS
   *  client — this is what makes THIS client authoritative over "did I land
   *  a hit", while the opponent's own client stays authoritative over their hp.
   *
   *  v25 fix (confirmed via a real browser console capture): this overlap is
   *  `this.bullets` (a group) vs `this.remotePlayer.sprite` (a single, bare
   *  sprite, not a group) — Phaser dispatches that specific shape as
   *  collideSpriteVsGroup, which is still mid-iteration over the bullets
   *  group's members when this callback runs. ANY mutation here — even just
   *  disabling the bullet's own body, which was the first attempted fix —
   *  was enough to corrupt the OTHER object in the pairing
   *  (remotePlayer.sprite ended up with its body reference nulled out,
   *  crashing a later applySnapshot call with "Cannot set properties of
   *  undefined"). GameScene's equivalent overlap (bullets vs the ENEMY
   *  GROUP, not a single sprite) never hits this, since group-vs-group is a
   *  different, unaffected internal Phaser path.
   *
   *  The only fully safe fix: touch NOTHING mutable here. Only read plain
   *  data off the bullet and flag it so this same bullet is never queued
   *  twice, then queue it for real processing (destroy, damage, effects —
   *  everything) in update(), which Phaser guarantees runs only after the
   *  physics step (and this entire collision pass) has fully finished. */
  private onBulletHitOpponent(bullet: Phaser.Physics.Arcade.Image) {
    if (!bullet.active || bullet.getData("hasHit")) return;
    bullet.setData("hasHit", true);
    this.pendingOpponentHits.push(bullet);
  }

  /** Runs after the physics step is fully done for this frame (see
   *  onBulletHitOpponent's doc) — safe to destroy bullets and mutate
   *  anything here. */
  private processPendingOpponentHits() {
    if (this.pendingOpponentHits.length === 0) return;
    const bullets = this.pendingOpponentHits;
    this.pendingOpponentHits = [];

    for (const bullet of bullets) {
      const damage = Number(bullet.getData("damage") ?? 0);
      const isMiss = bullet.getData("isMiss") === true;
      const isAoe = bullet.getData("isAoe") === true;
      const explosionRadius = Number(bullet.getData("explosionRadius") ?? PLAYER_CONFIG.aoeRadius);
      const impactX = bullet.x;
      const impactY = bullet.y;
      bullet.destroy();

      if (isAoe) {
        sfx.play("explosion");
        const explosion = this.add.circle(impactX, impactY, explosionRadius, 0xff8800, 0.35).setDepth(15);
        this.tweens.add({ targets: explosion, alpha: 0, scale: 1.3, duration: 300, onComplete: () => explosion.destroy() });
        if (damage > 0) this.reportHit(damage);
        continue;
      }

      if (isMiss || damage <= 0) {
        sfx.play("miss");
        this.showFloatingText(this.remotePlayer.sprite.x, this.remotePlayer.sprite.y, "MISS", "#999999");
        continue;
      }

      sfx.play("hit_enemy");
      this.showFloatingText(this.remotePlayer.sprite.x, this.remotePlayer.sprite.y, `-${damage}`, "#f39c12");
      this.reportHit(damage);
    }
  }

  /** Broadcasts a hit against the opponent — THEY apply it to their own real
   *  hp and echo the result back in their next state snapshot. */
  private reportHit(damage: number) {
    if (this.remotePlayer.isDead || !this.channelReady) return;
    this.channel.send({ type: "broadcast", event: "hit", payload: { targetId: this.opponent.id, damage } });
  }

  private showFloatingText(x: number, y: number, text: string, color: string) {
    const label = this.add.text(x, y, text, { fontFamily: "Orbitron, monospace", fontSize: "12px", color }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: label, y: y - 30, alpha: 0, duration: 600, onComplete: () => label.destroy() });
  }

  update(_time: number, delta: number) {
    if (this.matchEnded) return;

    // Physics/collision for this frame has already fully finished by the
    // time update() runs (see onBulletHitOpponent's doc) — safe to process now.
    this.processPendingOpponentHits();

    let moveLeft = this.cursors.left.isDown || this.wasd.A.isDown;
    let moveRight = this.cursors.right.isDown || this.wasd.D.isDown;
    let moveUp = this.cursors.up.isDown || this.wasd.W.isDown;
    let moveDown = this.cursors.down.isDown || this.wasd.S.isDown;
    let isShooting = this.shootKey.isDown || this.input.activePointer.leftButtonDown();
    const isReloading = Phaser.Input.Keyboard.JustDown(this.reloadKey) || this.reloadRequested;
    this.reloadRequested = false;

    const pointer = this.input.activePointer;
    let worldPointer = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    if (this.mobileControls) {
      const move = this.mobileControls.getMoveVector();
      const DEAD_ZONE = 0.3;
      moveLeft = move.x < -DEAD_ZONE;
      moveRight = move.x > DEAD_ZONE;
      moveUp = move.y < -DEAD_ZONE;
      moveDown = move.y > DEAD_ZONE;

      if (this.registry.get("mobileControlScheme") === "split") {
        const aimPoint = this.mobileControls.getAimScreenPoint();
        isShooting = aimPoint !== null;
        if (aimPoint) worldPointer = this.cameras.main.getWorldPoint(aimPoint.x, aimPoint.y);
      } else {
        const fire = this.mobileControls.getFireVector();
        const fireMagnitude = Math.hypot(fire.x, fire.y);
        isShooting = fireMagnitude > DEAD_ZONE;
        if (isShooting) {
          const AIM_DISTANCE = 2000;
          worldPointer = new Phaser.Math.Vector2(this.player.sprite.x + fire.x * AIM_DISTANCE, this.player.sprite.y + fire.y * AIM_DISTANCE);
        }
      }
    }

    this.isFiring = isShooting;
    this.player.update(moveLeft, moveRight, moveUp, moveDown, isShooting, isReloading, worldPointer, delta, undefined);

    this.checkWinCondition();
    this.broadcastState();

    this.events.emit("hud-update", {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      shield: this.player.shield,
      shieldMax: this.player.shieldMax,
      magazine: this.player.getMagazine(),
      magazineSize: this.player.getMagazineSize(),
      ammo: this.player.ammo,
      maxAmmo: this.player.maxAmmo,
      isReloading: this.player.isReloading,
      reloadProgress: this.player.getReloadProgress(),
      outOfAmmo: this.player.isOutOfAmmo(),
      kills: 0,
      score: 0,
      isFarmStage: false,
      playerPos: { x: this.player.sprite.x, y: this.player.sprite.y },
      enemyPositions: this.remotePlayer.isDead ? [] : [{ x: this.remotePlayer.sprite.x, y: this.remotePlayer.sprite.y }],
      stageWidth: this.stageData.width,
      stageHeight: this.stageData.height,
      hideProgress: 0,
      isHidden: false,
    });
  }

  private broadcastState(force = false) {
    if (!this.channelReady) return;
    const now = this.time.now;
    if (!force && now - this.lastBroadcast < BROADCAST_INTERVAL_MS) return;
    this.lastBroadcast = now;

    const snap: RemoteSnapshot = {
      x: this.player.sprite.x,
      y: this.player.sprite.y,
      rotation: this.player.sprite.rotation,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      isDead: this.player.isDead,
      weaponId: (this.registry.get("weaponId") as string) ?? "",
      firing: this.isFiring,
    };

    this.channel.send({ type: "broadcast", event: "state", payload: snap });
  }

  private checkWinCondition() {
    if (this.matchEnded) return;
    if (this.remotePlayer.isDead) this.handleWin();
  }

  private handleWin() {
    if (this.matchEnded) return;
    this.matchEnded = true;
    this.reportMatchResult(this.myId);
    this.endMatch(true);
  }

  private handleLoss() {
    if (this.matchEnded) return;
    // v29 fix: this fires from the "hit" broadcast handler, not from update() —
    // as soon as matchEnded flips true, update()'s top-of-function
    // `if (this.matchEnded) return;` guard means broadcastState() never runs
    // again on this client. Without forcing one last send here, the final
    // isDead:true snapshot could simply never reach the winner (especially
    // since the throttled broadcastState() may not have been due to fire yet),
    // leaving their client stuck thinking the match is still live.
    this.broadcastState(true);
    this.matchEnded = true;
    this.reportMatchResult(this.opponent.id);
    this.endMatch(false);
  }

  private async reportMatchResult(winnerId: string) {
    try {
      await fetch("/api/pvp/match/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: this.matchId, winnerId }),
      });
    } catch {
      // Best-effort — if this fails, the OTHER client's own call still resolves the match.
    }
  }

  private endMatch(won: boolean) {
    this.time.delayedCall(1200, () => {
      this.scene.stop("HUDScene");
      this.scene.start("PvpOverScene", { won, opponentUsername: this.opponent.username });
    });
  }

  /** On-screen RELOAD button (mobile HUD) — same one-shot pulse pattern as GameScene. */
  triggerReload() {
    if (this.matchEnded || this.scene.isPaused()) return;
    this.reloadRequested = true;
  }

  pauseGame() {
    // PvP has no pause (would desync the match) — no-op so the HUD's pause
    // button doesn't error if tapped.
  }

  /** v25: EXIT button (HUDScene's createExitButton) — forfeits the match
   *  (reports the opponent as winner, same as any other loss) and leaves.
   *  Uses a full navigation rather than React's router so the whole page
   *  (and every bit of Phaser/game state) tears down cleanly, same as
   *  GameOverScene's own HOME button. */
  exitMatch() {
    if (this.matchEnded) {
      window.location.href = "/home";
      return;
    }
    this.matchEnded = true;
    fetch("/api/pvp/match/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: this.matchId, winnerId: this.opponent.id }),
    })
      .catch(() => {})
      .finally(() => {
        window.location.href = "/home";
      });
  }
}
