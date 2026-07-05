/**
 * Procedural sound-effect engine using the Web Audio API.
 *
 * No audio asset files are used here — every sound is synthesized at
 * runtime with oscillators + noise buffers. This keeps the bundle tiny
 * and means there is nothing to record/license. Drop this file in as-is
 * and call `sfx.play(...)` from game/UI code (see wiring notes at bottom).
 */

type SfxName =
  | "shoot_pistol"
  | "shoot_rifle"
  | "shoot_shotgun"
  | "shoot_sniper"
  | "shoot_heavy" // gatling / ak / rasor rapid guns
  | "explosion" // rocket / grenade
  | "reload"
  | "hit_enemy"
  | "hurt_player"
  | "footstep"
  | "pickup_coin"
  | "pickup_item"
  | "ui_click"
  | "gacha_reveal"
  | "victory"
  | "defeat"
  | "miss";

class SfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 0.6;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    // Browsers suspend AudioContext until a user gesture; resume opportunistically.
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  /** Public entry point used everywhere in the game/UI. */
  play(name: SfxName) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const out = this.masterGain!;
      switch (name) {
        case "shoot_pistol":
          this.blip(ctx, out, { freq: 620, decay: 0.08, noiseMix: 0.5, type: "square" });
          break;
        case "shoot_rifle":
          this.blip(ctx, out, { freq: 480, decay: 0.06, noiseMix: 0.6, type: "square" });
          break;
        case "shoot_shotgun":
          this.blip(ctx, out, { freq: 180, decay: 0.18, noiseMix: 0.85, type: "sawtooth" });
          break;
        case "shoot_sniper":
          this.blip(ctx, out, { freq: 140, decay: 0.35, noiseMix: 0.4, type: "sawtooth", crack: true });
          break;
        case "shoot_heavy":
          this.blip(ctx, out, { freq: 300, decay: 0.05, noiseMix: 0.7, type: "square" });
          break;
        case "explosion":
          this.explosion(ctx, out);
          break;
        case "reload":
          this.reload(ctx, out);
          break;
        case "hit_enemy":
          this.blip(ctx, out, { freq: 900, decay: 0.05, noiseMix: 0.3, type: "triangle" });
          break;
        case "hurt_player":
          this.blip(ctx, out, { freq: 160, decay: 0.2, noiseMix: 0.5, type: "sawtooth" });
          break;
        case "footstep":
          this.thud(ctx, out, 110);
          break;
        case "pickup_coin":
          this.chime(ctx, out, [880, 1320], 0.08);
          break;
        case "pickup_item":
          this.chime(ctx, out, [660, 990, 1320], 0.09);
          break;
        case "ui_click":
          this.blip(ctx, out, { freq: 1000, decay: 0.03, noiseMix: 0.1, type: "square" });
          break;
        case "gacha_reveal":
          this.chime(ctx, out, [523, 659, 784, 1046], 0.14);
          break;
        case "victory":
          this.chime(ctx, out, [523, 659, 784, 1046, 1318], 0.18);
          break;
        case "defeat":
          this.chime(ctx, out, [392, 349, 293, 220], 0.22);
          break;
        case "miss":
          this.blip(ctx, out, { freq: 2000, decay: 0.04, noiseMix: 0.1, type: "sine" });
          break;
      }
    } catch {
      // Audio can legitimately fail (autoplay policy, no AudioContext, etc.) — never throw from SFX.
    }
  }

  /** Short percussive "shot"-style hit: tone + burst of noise through a fast decay envelope. */
  private blip(
    ctx: AudioContext,
    out: AudioNode,
    opts: { freq: number; decay: number; noiseMix: number; type: OscillatorType; crack?: boolean }
  ) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freq * 0.4), t0 + opts.decay);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(1 - opts.noiseMix, t0);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t0 + opts.decay);

    osc.connect(oscGain).connect(out);
    osc.start(t0);
    osc.stop(t0 + opts.decay + 0.02);

    if (opts.noiseMix > 0) {
      const noise = this.makeNoise(ctx, opts.decay + (opts.crack ? 0.15 : 0));
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(opts.noiseMix, t0);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + opts.decay + (opts.crack ? 0.15 : 0));
      noise.connect(noiseGain).connect(out);
      noise.start(t0);
    }
  }

  private explosion(ctx: AudioContext, out: AudioNode) {
    const t0 = ctx.currentTime;
    const noise = this.makeNoise(ctx, 0.6);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, t0);
    filter.frequency.exponentialRampToValueAtTime(80, t0 + 0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
    noise.connect(filter).connect(gain).connect(out);
    noise.start(t0);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(90, t0);
    sub.frequency.exponentialRampToValueAtTime(30, t0 + 0.5);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.8, t0);
    subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    sub.connect(subGain).connect(out);
    sub.start(t0);
    sub.stop(t0 + 0.55);
  }

  private reload(ctx: AudioContext, out: AudioNode) {
    const t0 = ctx.currentTime;
    // two quick mechanical clicks
    [0, 0.12].forEach((offset) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(1400, t0 + offset);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, t0 + offset);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + offset + 0.04);
      osc.connect(g).connect(out);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.05);
    });
  }

  private thud(ctx: AudioContext, out: AudioNode, freq: number) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  private chime(ctx: AudioContext, out: AudioNode, freqs: number[], step: number) {
    freqs.forEach((f, i) => {
      const t0 = ctx.currentTime + i * step;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + step * 1.8);
      osc.connect(g).connect(out);
      osc.start(t0);
      osc.stop(t0 + step * 2);
    });
  }

  private makeNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }
}

/** Singleton — import `sfx` anywhere and call `sfx.play("shoot_pistol")`. */
export const sfx = new SfxEngine();

/**
 * WIRING NOTES for Claude Code (where to call sfx.play(...)):
 * - src/game/entities/Player.ts / GameScene.ts: on fire → pick shoot_* based on
 *   weapon's fireMode (pistol/rifle family → shoot_rifle, shotgun → shoot_shotgun,
 *   sniper → shoot_sniper, gatling/ak47/rasor_gun → shoot_heavy,
 *   rocket_launcher/grenade_launcher → explosion on impact, not on fire).
 * - on reload start → sfx.play("reload")
 * - on bullet-enemy hit (damage applied) → sfx.play("hit_enemy"); on miss roll → sfx.play("miss")
 * - on player taking damage → sfx.play("hurt_player")
 * - on footstep timer while moving → sfx.play("footstep") (throttle to ~2-3/sec)
 * - on coin/diamond pickup or quest reward → sfx.play("pickup_coin") / pickup_item
 * - on any button click across pages → sfx.play("ui_click")
 * - GachaClient.tsx reveal animation → sfx.play("gacha_reveal")
 * - GameOverScene.ts → sfx.play("victory") or sfx.play("defeat") depending on result
 * - Respect a mute toggle in Settings: call sfx.setMuted(...) / sfx.setVolume(...)
 */
