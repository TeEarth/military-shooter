/**
 * Sound-effect engine using the Web Audio API.
 *
 * v14: gunshot/hit/footstep sounds now play real generated WAV samples
 * (public/assets/audio/sfx/*.wav — synthesized offline for realism, not
 * recorded) instead of the old toy oscillator "blip".
 * v36: replaced with the user's own recorded clips (trimmed to just the
 * actual shot/explosion/reload transient — see the source zip's original
 * files, which ran 1-6s each and would have badly lagged behind the actual
 * fire rate). shoot_heavy now also covers ak47/gatling AND m16a1/m16a4 (one
 * shared recording), rasor_gun gets its own dedicated shoot_rasor, and
 * rocket_launcher gets a real launch sound (previously silent on fire —
 * only explosion played on impact). reload/explosion are sample-backed now
 * too, replacing the old procedural versions. Any sfx here without a
 * sample still falls back to the procedural blip below.
 */

type SfxName =
  | "shoot_pistol"
  | "shoot_rifle" // m16a1 / m16a4 / ak47 / gatling — one shared recording
  | "shoot_shotgun"
  | "shoot_sniper"
  | "shoot_rasor"
  | "shoot_rocket"
  | "explosion" // rocket / grenade impact
  | "reload"
  | "hit_enemy"
  | "hurt_player"
  | "footstep"
  | "pickup_coin"
  | "pickup_item"
  | "ui_click"
  | "gacha_reveal"
  | "gacha_charge"
  | "gacha_charge_rare"
  | "gacha_flip"
  | "gacha_legendary"
  | "victory"
  | "defeat"
  | "miss";

/** Sample-backed sfx names → their WAV file + a per-sample playback gain
 *  (footstep is deliberately quiet per the user's request; gunshots/hits are
 *  already normalized to a sane level in the generator itself). */
const SAMPLE_FILES: Partial<Record<SfxName, { url: string; gain: number }>> = {
  shoot_pistol: { url: "/assets/audio/sfx/gunshot_pistol.wav", gain: 0.8 },
  shoot_rifle: { url: "/assets/audio/sfx/gunshot_rifle.wav", gain: 0.8 },
  shoot_shotgun: { url: "/assets/audio/sfx/gunshot_shotgun.wav", gain: 0.8 },
  shoot_sniper: { url: "/assets/audio/sfx/gunshot_sniper.wav", gain: 0.85 },
  shoot_rasor: { url: "/assets/audio/sfx/gunshot_rasor.wav", gain: 0.75 },
  shoot_rocket: { url: "/assets/audio/sfx/gunshot_rocket.wav", gain: 0.8 },
  explosion: { url: "/assets/audio/sfx/boom.wav", gain: 0.85 },
  reload: { url: "/assets/audio/sfx/reload_all.wav", gain: 0.8 },
  hit_enemy: { url: "/assets/audio/sfx/hit_enemy.wav", gain: 0.7 },
  hurt_player: { url: "/assets/audio/sfx/hurt_player.wav", gain: 0.8 },
  footstep: { url: "/assets/audio/sfx/footstep.wav", gain: 0.35 },
};

const MUSIC_LOOP_URL = "/assets/audio/music/battle_loop.wav";

class SfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 0.6;
  private sampleBuffers = new Map<string, AudioBuffer>();
  private samplePromises = new Map<string, Promise<AudioBuffer>>();
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicWanted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.preloadSamples(this.ctx);
    }
    // Browsers suspend AudioContext until a user gesture; resume opportunistically.
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Kicks off every sample fetch+decode up front so the first shot/footstep
   *  of a session doesn't fall back to the procedural blip unnecessarily. */
  private preloadSamples(ctx: AudioContext) {
    const urls = new Set<string>([...Object.values(SAMPLE_FILES).map((s) => s.url), MUSIC_LOOP_URL]);
    for (const url of urls) this.loadSample(ctx, url);
  }

  private loadSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    const cached = this.samplePromises.get(url);
    if (cached) return cached;
    const promise = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.sampleBuffers.set(url, buffer);
        return buffer;
      });
    this.samplePromises.set(url, promise);
    return promise;
  }

  /** Plays an already-decoded sample immediately; returns false if not loaded yet
   *  (caller should fall back to the procedural version in that case). */
  private playSampleIfReady(name: SfxName): boolean {
    const spec = SAMPLE_FILES[name];
    if (!spec) return false;
    const buffer = this.sampleBuffers.get(spec.url);
    if (!buffer) return false;
    const ctx = this.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = spec.gain;
    src.connect(gain).connect(this.masterGain!);
    src.start();
    return true;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  setMuted(m: boolean) {
    this.muted = m;
    // The music loop's source node keeps running through mute (only one-shot
    // `play()` calls check `this.muted`), so mute/unmute it explicitly here.
    if (this.musicGain) this.musicGain.gain.value = m ? 0 : 1;
  }

  /** Quiet background battle music, started on entering a combat stage and
   *  stopped on leaving it (see GameScene.ts). Loops seamlessly — idempotent,
   *  calling it while already playing does nothing. */
  startMusicLoop() {
    this.musicWanted = true;
    if (this.musicSource) return;
    const ctx = this.getCtx();
    this.loadSample(ctx, MUSIC_LOOP_URL).then((buffer) => {
      if (!this.musicWanted) return; // stopMusicLoop() was called while loading
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = this.muted ? 0 : 1;
      src.connect(gain).connect(this.masterGain!);
      src.start();
      this.musicSource = src;
      this.musicGain = gain;
    });
  }

  stopMusicLoop() {
    this.musicWanted = false;
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* already stopped */ }
      this.musicSource = null;
      this.musicGain = null;
    }
  }

  /** Public entry point used everywhere in the game/UI. */
  play(name: SfxName) {
    if (this.muted) return;
    try {
      if (name in SAMPLE_FILES && this.playSampleIfReady(name)) return;

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
        case "shoot_rasor":
          this.blip(ctx, out, { freq: 300, decay: 0.05, noiseMix: 0.7, type: "square" });
          break;
        case "shoot_rocket":
          this.blip(ctx, out, { freq: 200, decay: 0.12, noiseMix: 0.75, type: "sawtooth" });
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
        case "gacha_charge":
          this.charge(ctx, out, 220, 620, 0.85);
          break;
        case "gacha_charge_rare":
          this.charge(ctx, out, 260, 1100, 0.85);
          break;
        case "gacha_flip":
          this.blip(ctx, out, { freq: 1400, decay: 0.05, noiseMix: 0.35, type: "sine" });
          break;
        case "gacha_legendary":
          this.chime(ctx, out, [523, 659, 784, 1046, 1318, 1568], 0.12);
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

  /** Rising energy-charge sweep for the gacha "sphere charging" beat —
   *  frequency ramps up over the full duration, building tension into the
   *  explosion. Higher toFreq for rarer pulls reads as a more intense charge. */
  private charge(ctx: AudioContext, out: AudioNode, fromFreq: number, toFreq: number, duration: number) {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(fromFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(toFreq, t0 + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, t0);
    filter.frequency.exponentialRampToValueAtTime(3000, t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(filter).connect(gain).connect(out);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
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
 * - Combat stage start/end → sfx.startMusicLoop() / sfx.stopMusicLoop() for the
 *   quiet background battle music (see GameScene.ts create()/shutdown()).
 */
