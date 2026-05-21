// Web Audio sound bed for the host console.
//
// Everything is synthesized at runtime — no MP3 / WAV assets to ship and no
// licensing question. The mute preference is persisted to localStorage so a
// host's choice survives reloads.
//
// All public methods are no-ops if the engine is muted, the AudioContext
// failed to initialize, or the browser hasn't yet had a user gesture (browsers
// require one before audio can play; we resume the context lazily on each
// trigger and silently no-op if it's still suspended).
//
// Architecture
// ------------
//   voices ──┬─► [instrument bus] ─► [lobby bus] ──┐
//            │                                      ├─► master gain ─► compressor ─► destination
//   sfx ─────┘─────────────────────────────────────┤
//                                                   │
//   wet send ─► convolver(noise IR) ─► low-pass ───┘
//
// The convolver gives every voice access to a short shared "room" without
// shipping an IR file. The compressor on the bus glues the lobby groove to
// the SFX so neither pokes painfully above the other.

const MUTE_KEY = 'clutch:host:audio:muted';

// ---- Lobby groove (funky elevator) ---------------------------------------------
// 4-bar I–vi–ii–V loop in F major: Fmaj7 → Dm7 → Gm7 → C7. A 16th-note scheduler
// queues notes ~180ms ahead so the groove stays tight regardless of timer jitter.
const LOBBY_BPM = 100;
const SEC_PER_BEAT = 60 / LOBBY_BPM;
const SEC_PER_16 = SEC_PER_BEAT / 4;
const LOBBY_LOOKAHEAD = 0.18;
const LOBBY_TICK_MS = 25;

type Chord = { root: number; voicing: readonly number[] };
// Roots at octave 2; voicings are 3-5-7 intervals above the root (rootless rhodes comp).
const LOBBY_CHORDS: readonly Chord[] = [
  { root: 87.31, voicing: [4, 7, 11] }, // Fmaj7  — A, C, E
  { root: 73.42, voicing: [3, 7, 10] }, // Dm7    — F, A, C
  { root: 98.00, voicing: [3, 7, 10] }, // Gm7    — Bb, D, F
  { root: 65.41, voicing: [4, 7, 10] }, // C7     — E, G, Bb
];

type BassStep = { semitones: number; len16: number; gain: number } | null;
// Walking funk bass; semitones are above the chord root.
const LOBBY_BASS: readonly BassStep[] = [
  { semitones:  0, len16: 3, gain: 0.85 }, null, null, null,           // beat 1 — root
  null, null,                                                          // beat 2 — snare lands
  { semitones: 12, len16: 1, gain: 0.55 }, null,                       // 2.5 — octave bounce
  { semitones:  0, len16: 2, gain: 0.75 }, null,                       // beat 3 — root
  { semitones:  7, len16: 1, gain: 0.55 }, null,                       // 3.5 — fifth
  null,                                                                // beat 4 — snare lands
  { semitones: 12, len16: 1, gain: 0.50 },                             // 4.25 — octave
  { semitones:  3, len16: 1, gain: 0.40 },                             // 4.5  — minor third (passing)
  { semitones: -2, len16: 1, gain: 0.45 },                             // 4.75 — flat-7th lead-in
];

// 16th-note hi-hat with downbeat accents and ghost notes.
const LOBBY_HAT: readonly number[] = [
  0.45, 0.16, 0.30, 0.16, 0.45, 0.16, 0.30, 0.20,
  0.45, 0.16, 0.30, 0.16, 0.45, 0.16, 0.30, 0.26,
];

// Kick on 1, "and of 3", "and of 4" — syncopated funk pattern.
const LOBBY_KICK = new Set<number>([0, 10, 14]);
// Snare backbeat on 2 and 4.
const LOBBY_SNARE = new Set<number>([4, 12]);

type RhodesStep = { step: number; len16: number; gain: number };
// Offbeat chord stabs — the "chk-chk" of funk comping.
const LOBBY_RHODES: readonly RhodesStep[] = [
  { step:  2, len16: 1, gain: 0.32 },
  { step:  6, len16: 1, gain: 0.24 },
  { step: 10, len16: 2, gain: 0.34 },
  { step: 14, len16: 1, gain: 0.24 },
];

// ---- In-game music (cute / derpy / accelerates near time-up) ------------------
// Different key (D major), tempo (116 BPM), and color from the lobby groove so
// the transition into "we're playing now" lands obviously. Marimba carries a
// playful skipping melody; pizzicato bass walks under it; a light shaker
// keeps the eighths moving. The whole engine speeds up (`rush`) in the last
// few seconds for that "fingers are slipping off the buzzer" feel.
const GAME_BPM = 116;
const GAME_SEC_PER_BEAT = 60 / GAME_BPM;
const GAME_SEC_PER_16 = GAME_SEC_PER_BEAT / 4;
const GAME_LOOKAHEAD = 0.18;
const GAME_TICK_MS = 25;
const GAME_RUSH_MAX = 1.85; // tempo multiplier at full panic (≈215 BPM feel)

type GameChord = { root: number; voicing: readonly number[] };
// 4-bar loop: D – Bm – G – A (I – vi – IV – V). Roots at D2/A2 area; voicings
// are 3rds + 5ths so the marimba arpeggios can sit on top without clashing.
const GAME_CHORDS: readonly GameChord[] = [
  { root: 73.42, voicing: [0, 4, 7, 9] },  // D    (D, F#, A, B)
  { root: 61.74, voicing: [0, 3, 7, 10] }, // Bm7  (B, D, F#, A)
  { root: 49.00, voicing: [0, 4, 7, 9] },  // G    (G, B, D, E)
  { root: 55.00, voicing: [0, 4, 7, 9] },  // A    (A, C#, E, F#)
];

// Pizzicato bass — short, bouncy, "boop boop" cadence that drives the loop.
type GameBassStep = { semitones: number; len16: number; gain: number } | null;
const GAME_BASS: readonly GameBassStep[] = [
  { semitones: 12, len16: 1, gain: 0.85 }, null,                       // 1 — root up an octave
  { semitones: 19, len16: 1, gain: 0.55 }, null,                       // 1.5 — fifth above
  { semitones: 12, len16: 1, gain: 0.78 }, null,                       // 2
  { semitones: 16, len16: 1, gain: 0.55 }, null,                       // 2.5 — third
  { semitones: 12, len16: 1, gain: 0.80 }, null,                       // 3
  { semitones: 19, len16: 1, gain: 0.55 }, null,                       // 3.5
  { semitones: 17, len16: 1, gain: 0.62 }, null,                       // 4 — minor seventh wobble
  { semitones: 14, len16: 1, gain: 0.50 }, null,                       // 4.5 — passing tone
];

// Marimba: skipping melodic line that crosses the bar line. Step values are
// semitones above the chord root, played two octaves up so they sing.
type MarimbaNote = { step: number; semitones: number; len16: number; gain: number };
const GAME_MARIMBA: readonly MarimbaNote[] = [
  { step:  0, semitones: 24, len16: 2, gain: 0.55 },
  { step:  3, semitones: 28, len16: 1, gain: 0.42 },
  { step:  4, semitones: 31, len16: 2, gain: 0.55 },
  { step:  7, semitones: 28, len16: 1, gain: 0.42 },
  { step:  8, semitones: 26, len16: 2, gain: 0.50 },
  { step: 10, semitones: 24, len16: 1, gain: 0.42 },
  { step: 12, semitones: 31, len16: 2, gain: 0.55 },
  { step: 14, semitones: 36, len16: 1, gain: 0.42 },
];

// Shaker on every eighth — keeps the groove forward-leaning without
// overpowering the marimba. The kick on 1 + 9 anchors the bar.
const GAME_SHAKER: readonly number[] = [
  0.20, 0, 0.30, 0, 0.20, 0, 0.30, 0,
  0.20, 0, 0.30, 0, 0.20, 0, 0.34, 0,
];
const GAME_KICK = new Set<number>([0, 8]);
// Tiny stick-click on the "and" of 2 + 4 — keeps the groove playful without
// committing to a full snare backbeat.
const GAME_STICK = new Set<number>([6, 14]);

function loadMuted(): boolean {
  try { return window.localStorage.getItem(MUTE_KEY) === '1'; }
  catch { return false; }
}
function saveMuted(muted: boolean): void {
  try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); }
  catch { /* noop */ }
}

type PadVoice = { osc: OscillatorNode; lfo: OscillatorNode };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private spaceSend: GainNode | null = null;

  private muted = loadMuted();

  // Lobby state
  private lobbyOn = false;
  private lobbyBus: GainNode | null = null;
  private drumBus: GainNode | null = null;
  private hatBus: GainNode | null = null;
  private bassBus: GainNode | null = null;
  private rhodesBus: GainNode | null = null;
  private padOut: GainNode | null = null;
  private padVoices: PadVoice[] | null = null;
  private lobbyTimer: number | null = null;
  private lobbyNextStepTime = 0;
  private lobbyStep = 0; // 0..63, runs through 4 bars × 16 sixteenths

  // In-game music state
  private gameOn = false;
  private gameBus: GainNode | null = null;
  private marimbaBus: GainNode | null = null;
  private gamePerBus: GainNode | null = null;
  private gameBassBus: GainNode | null = null;
  private gameTimer: number | null = null;
  private gameNextStepTime = 0;
  private gameStep = 0; // 0..63
  // 0..1 — how "rush"-y the in-game loop currently is. The host pushes this
  // up smoothly in the last few seconds of a question so the engine speeds
  // up, transposes up, and adds a tremolo wobble for the panic feel.
  private gameRush = 0;

  isMuted(): boolean { return this.muted; }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
    if (muted) {
      this.stopLobbyMusic();
      this.stopGameMusic();
      if (this.master) {
        this.master.gain.cancelScheduledValues(this.now());
        this.master.gain.setValueAtTime(0, this.now());
      }
    } else if (this.master) {
      this.master.gain.cancelScheduledValues(this.now());
      this.master.gain.setValueAtTime(0.55, this.now());
    }
  }

  /** Lazily initialize the context. Browsers block audio until a user gesture,
   *  so we call this on the first trigger after one. */
  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      this.ctx = ctx;

      // Master signal path: voices → master gain → compressor → destination.
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.55;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-14, ctx.currentTime);
      comp.knee.setValueAtTime(20, ctx.currentTime);
      comp.ratio.setValueAtTime(3.5, ctx.currentTime);
      comp.attack.setValueAtTime(0.003, ctx.currentTime);
      comp.release.setValueAtTime(0.18, ctx.currentTime);

      master.connect(comp).connect(ctx.destination);
      this.master = master;
      this.compressor = comp;

      // Synthetic short room: noise-IR convolver, gently low-passed for warmth.
      const send = ctx.createGain();
      send.gain.value = 1.0;
      const rev = ctx.createConvolver();
      rev.buffer = this.makeReverbIR(1.6, 2.4);
      const wetLp = ctx.createBiquadFilter();
      wetLp.type = 'lowpass';
      wetLp.frequency.value = 4500;
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.32;
      send.connect(rev).connect(wetLp).connect(wetGain).connect(master);
      this.spaceSend = send;
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private resumeIfNeeded(): boolean {
    const ctx = this.ensureCtx();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      void ctx.resume().catch(() => { /* noop */ });
      return (ctx.state as AudioContextState) === 'running';
    }
    return true;
  }

  private now(): number { return this.ctx?.currentTime ?? 0; }

  // ---- Public SFX --------------------------------------------------------------

  /** Cute "pop" the host hears each time a player submits an answer. A quick
   *  rising blip + tiny shimmer — short enough to fire rapidly without piling
   *  up, soft enough that 20 answers in a row don't grate. Pitch is randomized
   *  slightly so back-to-back submissions don't sound mechanical. */
  answerSubmitted(): void {
    if (this.muted) return;
    if (!this.resumeIfNeeded() || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = this.now();
    // Random pitch jitter ±2 semitones around C5 so a flurry of submissions
    // sounds organic rather than a single tone hammering.
    const jitter = (Math.random() * 4 - 2) / 12;
    const base = 523.25 * Math.pow(2, jitter);

    // Body — sine pitch-up gives the "pop / blip" gesture.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * 0.7, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.55, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.20);

    // Tiny upper-octave shimmer for sparkle.
    const h = ctx.createOscillator();
    h.type = 'triangle';
    h.frequency.setValueAtTime(base * 2, t);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0, t);
    hg.gain.linearRampToValueAtTime(0.06, t + 0.005);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
    h.connect(hg).connect(this.master);
    h.start(t);
    h.stop(t + 0.12);

    // Tiny click transient for the "received" feel.
    this.click(t, 0.04);
  }

  /** Soft chime when a player joins the lobby. */
  playerJoined(): void {
    if (this.muted) return;
    if (!this.resumeIfNeeded() || !this.ctx || !this.master) return;
    const t = this.now();
    // Two-tone bell with shimmer top — minor 6th E5 → C6, plus a high partial.
    this.bell(t,        659.25, 0.55, 0.16, 0.30);
    this.bell(t + 0.07, 1046.5, 0.50, 0.13, 0.30);
    this.bell(t + 0.14, 1567.9, 0.30, 0.06, 0.40);
    this.click(t, 0.08);
  }

  /** Single tick on the last 5 seconds of a question timer. */
  countdownTick(secondsLeft: number): void {
    if (this.muted) return;
    if (!this.resumeIfNeeded() || !this.ctx || !this.master) return;
    const t = this.now();
    const final = secondsLeft <= 1;
    const baseFreq = final ? 1320 : 880;

    // Tonal body — pitch glides into place for a snappier "tock" character.
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(baseFreq * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.025);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(final ? 0.32 : 0.20, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (final ? 0.24 : 0.10));
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.30);

    // Harmonic shimmer — adds depth without changing the pitch.
    const h = this.ctx.createOscillator();
    h.type = 'triangle';
    h.frequency.setValueAtTime(baseFreq * 2, t);
    const hg = this.ctx.createGain();
    hg.gain.setValueAtTime(0, t);
    hg.gain.linearRampToValueAtTime(final ? 0.10 : 0.06, t + 0.004);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + (final ? 0.12 : 0.06));
    h.connect(hg).connect(this.master);
    h.start(t);
    h.stop(t + 0.16);

    this.click(t, final ? 0.14 : 0.08);
    if (this.spaceSend && final) {
      const wet = this.ctx.createGain();
      wet.gain.value = 0.18;
      g.connect(wet).connect(this.spaceSend);
    }
  }

  /** Long affirmative "buzzer" when the timer hits zero. */
  timeUp(): void {
    if (this.muted) return;
    if (!this.resumeIfNeeded() || !this.ctx || !this.master) return;
    const t = this.now();
    const ctx = this.ctx;
    // Stacked detuned squares + a saw for grit; slight downward pitch sag and
    // a vibrato wobble to read as "wrong answer / time's up".
    const stack: Array<{ f: number; gain: number; type: OscillatorType }> = [
      { f: 110, gain: 0.22, type: 'square'   },
      { f: 165, gain: 0.16, type: 'sawtooth' },
      { f: 220, gain: 0.14, type: 'square'   },
    ];
    for (const s of stack) {
      const o = ctx.createOscillator();
      o.type = s.type;
      o.frequency.setValueAtTime(s.f, t);
      o.frequency.linearRampToValueAtTime(s.f * 0.94, t + 0.30);

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 14;
      const lfoG = ctx.createGain();
      lfoG.gain.value = s.f * 0.025;
      lfo.connect(lfoG).connect(o.frequency);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(s.gain, t + 0.012);
      g.gain.linearRampToValueAtTime(s.gain * 0.7, t + 0.20);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.50);

      o.connect(lp).connect(g).connect(this.master);
      o.start(t);
      lfo.start(t);
      o.stop(t + 0.55);
      lfo.stop(t + 0.55);
    }
    // Soft noise tail under the buzz for body.
    this.noiseSwell(t, 0.42, 0.06, 1400, 1.2);
  }

  /** "Ready, set, go" pre-game beep. `final=true` is the triumphant "GO!". */
  countdownBeep(final: boolean): void {
    if (this.muted) return;
    if (!this.resumeIfNeeded() || !this.ctx || !this.master) return;
    const t = this.now();
    if (final) {
      // Major chord with brass attack + bell shimmer + thumping kick.
      this.brassChord(t, [523.25, 659.25, 783.99, 1046.5], 0.55, 0.32);
      this.bell(t + 0.06, 1568, 0.45, 0.14, 0.30);
      this.bell(t + 0.13, 2093, 0.32, 0.10, 0.30);
      this.kickVoice(t, 0.55, this.master);
      this.noiseSwell(t, 0.55, 0.10, 4200, 0.8);
    } else {
      // A round, satisfying "bip" — fundamental + octave + a touch of fifth.
      this.bell(t, 440, 0.20, 0.18, 0.20);
      this.bell(t, 880, 0.16, 0.10, 0.20);
      this.bell(t, 660, 0.14, 0.06, 0.20);
    }
  }

  /** Crowd-pleasing "ta-da" on the final podium reveal. */
  cheer(): void {
    if (this.muted) return;
    if (!this.resumeIfNeeded() || !this.ctx || !this.master) return;
    const t = this.now();
    // G major triad: arpeggiated bell run, brass chord landing, shimmer tail,
    // kick hit for impact, and two layered applause swells.
    const root = 392;     // G4
    const third = 493.88; // B4
    const fifth = 587.33; // D5
    const oct = 783.99;   // G5
    const oct2 = 1175.7;  // D6

    this.bell(t,         root,  0.30, 0.16, 0.35);
    this.bell(t + 0.07,  third, 0.30, 0.16, 0.35);
    this.bell(t + 0.14,  fifth, 0.32, 0.18, 0.35);
    this.bell(t + 0.22,  oct,   0.40, 0.22, 0.35);

    this.brassChord(t + 0.30, [root, third, fifth, oct], 0.85, 0.30);
    this.bell(t + 0.40, oct2, 0.80, 0.12, 0.40);
    this.kickVoice(t + 0.30, 0.45, this.master);

    this.noiseSwell(t + 0.05, 1.4, 0.20, 1800, 0.7);
    this.noiseSwell(t + 0.6,  1.6, 0.18, 2400, 0.7);
  }

  // ---- Public lobby music -------------------------------------------------------

  /** Start the funky elevator loop. Idempotent. */
  startLobbyMusic(): void {
    if (this.muted) return;
    if (!this.resumeIfNeeded() || !this.ctx || !this.master) return;
    if (this.lobbyOn) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(0.55, t + 1.4);
    bus.connect(this.master);
    this.lobbyBus = bus;

    // Sub-buses — adjusting these is how we get the mix right per instrument.
    this.drumBus   = this.makeBus(0.55, bus);
    this.hatBus    = this.makeBus(0.42, bus);
    this.bassBus   = this.makeBus(0.65, bus);
    this.rhodesBus = this.makeBus(0.50, bus);

    // Send some rhodes to the room for warmth — keeps the comping from sounding dry.
    if (this.spaceSend) {
      const wet = ctx.createGain();
      wet.gain.value = 0.40;
      this.rhodesBus.connect(wet).connect(this.spaceSend);
    }

    this.startLobbyPad(bus);

    this.lobbyOn = true;
    this.lobbyStep = 0;
    this.lobbyNextStepTime = ctx.currentTime + 0.18;
    this.lobbyTimer = window.setInterval(() => this.lobbyTick(), LOBBY_TICK_MS) as unknown as number;
  }

  stopLobbyMusic(): void {
    if (!this.lobbyOn && !this.lobbyBus) return;
    this.lobbyOn = false;
    if (this.lobbyTimer != null) {
      window.clearInterval(this.lobbyTimer);
      this.lobbyTimer = null;
    }
    if (!this.ctx || !this.lobbyBus) return;
    const t = this.ctx.currentTime;
    const bus = this.lobbyBus;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + 0.6);

    const voices = this.padVoices ?? [];
    window.setTimeout(() => {
      for (const v of voices) {
        try { v.osc.stop(); v.osc.disconnect(); } catch { /* noop */ }
        try { v.lfo.stop(); v.lfo.disconnect(); } catch { /* noop */ }
      }
      try { bus.disconnect(); } catch { /* noop */ }
    }, 800);

    this.lobbyBus = null;
    this.padVoices = null;
    this.padOut = null;
    this.drumBus = this.hatBus = this.bassBus = this.rhodesBus = null;
  }

  // ---- Public in-game music ----------------------------------------------------

  /** Start the in-game cute/derpy loop. Idempotent. The host calls this on
   *  question_start_host so the music is only audible while a question is on
   *  the screen. */
  startGameMusic(): void {
    if (this.muted) return;
    if (!this.resumeIfNeeded() || !this.ctx || !this.master) return;
    if (this.gameOn) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(0.50, t + 0.25);
    bus.connect(this.master);
    this.gameBus = bus;

    this.marimbaBus = this.makeBus(0.65, bus);
    this.gameBassBus = this.makeBus(0.55, bus);
    this.gamePerBus = this.makeBus(0.42, bus);

    // A whisper of room on the marimba — a bone-dry pluck reads as "cheap MIDI".
    if (this.spaceSend) {
      const wet = ctx.createGain();
      wet.gain.value = 0.28;
      this.marimbaBus.connect(wet).connect(this.spaceSend);
    }

    this.gameRush = 0;
    this.gameOn = true;
    this.gameStep = 0;
    this.gameNextStepTime = ctx.currentTime + 0.18;
    this.gameTimer = window.setInterval(() => this.gameTick(), GAME_TICK_MS) as unknown as number;
  }

  stopGameMusic(): void {
    if (!this.gameOn && !this.gameBus) return;
    this.gameOn = false;
    if (this.gameTimer != null) {
      window.clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    if (!this.ctx || !this.gameBus) return;
    const t = this.ctx.currentTime;
    const bus = this.gameBus;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + 0.35);
    window.setTimeout(() => {
      try { bus.disconnect(); } catch { /* noop */ }
    }, 500);
    this.gameBus = null;
    this.marimbaBus = this.gameBassBus = this.gamePerBus = null;
    this.gameRush = 0;
  }

  /** 0..1 — pushes the in-game loop into "rush" mode. The host pumps this up
   *  smoothly in the final ~5 seconds of a question. We expose a setter rather
   *  than letting the engine read the deadline itself so the same lib can be
   *  driven by tests, paused-game logic, or future modes (sudden death, etc.).
   */
  setGameMusicRush(rush: number): void {
    this.gameRush = Math.max(0, Math.min(1, rush));
  }

  // ---- Game-music internals ----------------------------------------------------

  /** Effective seconds-per-16th given the current rush level. At rush=0 we
   *  play at the natural 116 BPM; at rush=1 the loop has compressed to ~215
   *  BPM, the marimba transposes up an octave, and a tremolo wobble appears.
   *  We compute this fresh on every step so the panic ramp feels continuous,
   *  not stairstepped. */
  private gameStepDuration(): number {
    const speed = 1 + (GAME_RUSH_MAX - 1) * this.gameRush;
    return GAME_SEC_PER_16 / speed;
  }

  private gameTick(): void {
    if (!this.ctx || !this.gameOn) return;
    const stepDur = this.gameStepDuration();
    if (this.gameNextStepTime < this.ctx.currentTime - 0.05) {
      const skipped = Math.ceil((this.ctx.currentTime - this.gameNextStepTime) / stepDur);
      this.gameStep = (this.gameStep + skipped) % 64;
      this.gameNextStepTime = this.ctx.currentTime + 0.05;
    }
    while (this.gameNextStepTime < this.ctx.currentTime + GAME_LOOKAHEAD) {
      this.scheduleGameStep(this.gameStep, this.gameNextStepTime);
      this.gameNextStepTime += this.gameStepDuration();
      this.gameStep = (this.gameStep + 1) % 64;
    }
  }

  private scheduleGameStep(step: number, t: number): void {
    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;
    const chord = GAME_CHORDS[bar]!;
    const stepDur = this.gameStepDuration();
    // Octave bump in rush mode — same notes, just chirpier. We blend it in
    // gradually via a probability so the transition isn't a hard switch.
    const rushOct = this.gameRush > 0.55 ? 12 : 0;

    const shakerVel = GAME_SHAKER[stepInBar];
    if (shakerVel != null && shakerVel > 0) {
      const v = shakerVel * (1 + this.gameRush * 0.4);
      this.gameShakerVoice(t, v);
    }
    if (GAME_KICK.has(stepInBar)) {
      this.kickVoice(t, 0.55 + this.gameRush * 0.20, this.gamePerBus!);
    }
    if (GAME_STICK.has(stepInBar)) this.gameStickVoice(t, 0.32 + this.gameRush * 0.15);

    const b = GAME_BASS[stepInBar];
    if (b) {
      const freq = chord.root * Math.pow(2, b.semitones / 12);
      this.gameBassVoice(t, freq, b.len16 * stepDur, b.gain * (1 + this.gameRush * 0.10));
    }

    for (const m of GAME_MARIMBA) {
      if (m.step !== stepInBar) continue;
      const freq = chord.root * Math.pow(2, (m.semitones + rushOct) / 12);
      this.marimbaVoice(t, freq, m.len16 * stepDur, m.gain * (1 + this.gameRush * 0.18));
    }
  }

  private marimbaVoice(t: number, freq: number, len: number, gain: number): void {
    const ctx = this.ctx!;
    const dest = this.marimbaBus!;
    // FM mallet: 4:1 ratio gives a wood-bar "tonk", short envelope keeps it
    // popcorn-light. Tremolo gain when rushed for the panic flutter.
    const car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.setValueAtTime(freq, t);

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 4, t);
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(freq * 1.8, t);
    modG.gain.exponentialRampToValueAtTime(freq * 0.04, t + 0.08);
    mod.connect(modG).connect(car.frequency);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.10, len * 0.9));

    if (this.gameRush > 0.30) {
      // Add a subtle 7Hz tremolo for the panic feel — not enough to sound
      // queasy, just enough to feel "fingers tapping".
      const trem = ctx.createOscillator();
      trem.type = 'sine';
      trem.frequency.value = 7 + this.gameRush * 3;
      const tg = ctx.createGain();
      tg.gain.value = gain * 0.18 * this.gameRush;
      trem.connect(tg).connect(g.gain);
      trem.start(t);
      trem.stop(t + len + 0.05);
    }

    car.connect(lp).connect(g).connect(dest);
    mod.start(t); car.start(t);
    mod.stop(t + len + 0.05);
    car.stop(t + len + 0.05);
  }

  private gameBassVoice(t: number, freq: number, len: number, gain: number): void {
    const ctx = this.ctx!;
    const dest = this.gameBassBus!;
    // Pizzicato bass — short triangle blip with a quick low-pass envelope.
    // Reads as "boop" rather than the funkier saw-bass we use in the lobby.
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq * 1.005, t); // tiny detune adds life
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(freq * 0.5, t);

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 2.5;
    filt.frequency.setValueAtTime(220, t);
    filt.frequency.linearRampToValueAtTime(900, t + 0.015);
    filt.frequency.exponentialRampToValueAtTime(220, t + Math.max(0.06, len * 0.6));

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.10, len * 0.85));

    o.connect(filt);
    sub.connect(filt);
    filt.connect(g).connect(dest);
    o.start(t); sub.start(t);
    o.stop(t + len + 0.05);
    sub.stop(t + len + 0.05);
  }

  private gameShakerVoice(t: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5200;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 8200;
    bp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain * 0.55, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(hp).connect(bp).connect(g).connect(this.gamePerBus!);
    src.start(t);
    src.stop(t + 0.08);
  }

  private gameStickVoice(t: number, gain: number): void {
    const ctx = this.ctx!;
    // High triangle blip + click — like a wood-stick rim hit. Adds personality
    // without the weight of a real snare.
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1800, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.02);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.gamePerBus!);
    o.start(t);
    o.stop(t + 0.06);
  }

  // ---- Lobby internals ---------------------------------------------------------

  private makeBus(gain: number, dest: AudioNode): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = gain;
    g.connect(dest);
    return g;
  }

  private startLobbyPad(bus: GainNode): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.18;
    out.connect(bus);

    // Whisper-quiet F major triad behind the groove for harmonic glue.
    const freqs = [174.61, 220.00, 261.63];
    const voices: PadVoice[] = [];
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.5;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.10 + Math.random() * 0.06;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.8;

      lfo.connect(lfoG).connect(o.detune);
      o.connect(og).connect(out);
      o.start(t);
      lfo.start(t);
      voices.push({ osc: o, lfo });
    }
    this.padOut = out;
    this.padVoices = voices;
  }

  private lobbyTick(): void {
    if (!this.ctx || !this.lobbyOn) return;
    // If we fell behind (e.g. tab was backgrounded and intervals throttled),
    // skip the missed steps instead of firing a catch-up burst.
    if (this.lobbyNextStepTime < this.ctx.currentTime - 0.05) {
      const skipped = Math.ceil((this.ctx.currentTime - this.lobbyNextStepTime) / SEC_PER_16);
      this.lobbyStep = (this.lobbyStep + skipped) % 64;
      this.lobbyNextStepTime = this.ctx.currentTime + 0.05;
    }
    while (this.lobbyNextStepTime < this.ctx.currentTime + LOBBY_LOOKAHEAD) {
      this.scheduleLobbyStep(this.lobbyStep, this.lobbyNextStepTime);
      this.lobbyNextStepTime += SEC_PER_16;
      this.lobbyStep = (this.lobbyStep + 1) % 64;
    }
  }

  private scheduleLobbyStep(step: number, t: number): void {
    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;
    const chord = LOBBY_CHORDS[bar]!;

    const hatVel = LOBBY_HAT[stepInBar];
    if (hatVel != null && hatVel > 0) this.hatVoice(t, hatVel);
    if (LOBBY_KICK.has(stepInBar)) this.kickVoice(t, 0.85, this.drumBus!);
    if (LOBBY_SNARE.has(stepInBar)) this.snareVoice(t, 0.55);

    const b = LOBBY_BASS[stepInBar];
    if (b) {
      const freq = chord.root * Math.pow(2, b.semitones / 12);
      this.bassVoice(t, freq, b.len16 * SEC_PER_16, b.gain);
    }

    for (const r of LOBBY_RHODES) {
      if (r.step !== stepInBar) continue;
      // Voice the chord two octaves above the root for that classic comp range.
      const voice = chord.voicing.map(s => chord.root * Math.pow(2, (s + 24) / 12));
      this.rhodesVoice(t, voice, r.len16 * SEC_PER_16, r.gain);
    }
  }

  // ---- Instrument voices -------------------------------------------------------

  private kickVoice(t: number, gain: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    // Body: sine pitch-sweep from ~120Hz to 40Hz.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.22);

    // Click: triangle attack transient for the "thump".
    const c = ctx.createOscillator();
    c.type = 'triangle';
    c.frequency.setValueAtTime(800, t);
    c.frequency.exponentialRampToValueAtTime(80, t + 0.02);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0, t);
    cg.gain.linearRampToValueAtTime(gain * 0.40, t + 0.001);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    c.connect(cg).connect(dest);
    c.start(t);
    c.stop(t + 0.04);
  }

  private snareVoice(t: number, gain: number): void {
    const ctx = this.ctx!;
    const dest = this.drumBus!;
    // Tonal body for the head.
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(200, t);
    body.frequency.exponentialRampToValueAtTime(120, t + 0.06);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(gain * 0.5, t + 0.005);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    body.connect(bg).connect(dest);
    body.start(t);
    body.stop(t + 0.14);

    // Filtered noise for the snare wires.
    const src = ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.18);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(gain * 0.9, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(hp).connect(bp).connect(ng).connect(dest);
    src.start(t);
    src.stop(t + 0.20);
  }

  private hatVoice(t: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.06);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(g).connect(this.hatBus!);
    src.start(t);
    src.stop(t + 0.08);
  }

  private bassVoice(t: number, freq: number, len: number, gain: number): void {
    const ctx = this.ctx!;
    const dest = this.bassBus!;
    // Saw + sine sub through a low-pass envelope — a classic "Moogy" funk bass.
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(freq, t);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(freq * 0.5, t);

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 4;
    filt.frequency.setValueAtTime(180, t);
    filt.frequency.linearRampToValueAtTime(900, t + 0.04);
    filt.frequency.exponentialRampToValueAtTime(220, t + Math.max(0.08, len * 0.8));

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.linearRampToValueAtTime(gain * 0.55, t + Math.min(0.12, len * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);

    o1.connect(filt);
    o2.connect(filt);
    filt.connect(g).connect(dest);
    o1.start(t); o2.start(t);
    o1.stop(t + len + 0.05);
    o2.stop(t + len + 0.05);
  }

  private rhodesVoice(t: number, freqs: readonly number[], len: number, gain: number): void {
    const ctx = this.ctx!;
    const dest = this.rhodesBus!;
    // FM carrier+modulator at 2:1 — gives the tine-y rhodes attack.
    for (const f of freqs) {
      const car = ctx.createOscillator();
      car.type = 'sine';
      car.frequency.setValueAtTime(f, t);

      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(f * 2, t);
      const modG = ctx.createGain();
      modG.gain.setValueAtTime(f * 1.4, t);
      modG.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.30);
      mod.connect(modG).connect(car.frequency);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4200;

      const g = ctx.createGain();
      const peak = gain / freqs.length * 1.4;
      // Two-stage decay: fast initial drop (the "tine"), then slower body.
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.005);
      g.gain.linearRampToValueAtTime(peak * 0.4, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);

      car.connect(lp).connect(g).connect(dest);
      mod.start(t); car.start(t);
      mod.stop(t + len + 0.05);
      car.stop(t + len + 0.05);
    }
  }

  // ---- Generic helpers --------------------------------------------------------

  private bell(t: number, freq: number, dur: number, gain: number, wet: number): void {
    const ctx = this.ctx!;
    // FM bell with an inharmonic 1.414:1 ratio for that struck-metal character.
    const car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.setValueAtTime(freq, t);

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 1.414, t);
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(freq * 2.0, t);
    modG.gain.exponentialRampToValueAtTime(freq * 0.10, t + dur * 0.6);
    mod.connect(modG).connect(car.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    car.connect(g).connect(this.master!);
    if (this.spaceSend && wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.spaceSend);
    }
    mod.start(t); car.start(t);
    mod.stop(t + dur + 0.05);
    car.stop(t + dur + 0.05);
  }

  private brassChord(t: number, freqs: readonly number[], dur: number, gain: number): void {
    const ctx = this.ctx!;
    // Sawtooth with a filter sweep up — reads as a brass-section attack.
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);

      // Subtle vibrato for life.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const lfoG = ctx.createGain();
      lfoG.gain.value = f * 0.005;
      lfo.connect(lfoG).connect(o.frequency);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 2;
      lp.frequency.setValueAtTime(f * 0.8, t);
      lp.frequency.linearRampToValueAtTime(f * 5, t + 0.06);
      lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);

      const g = ctx.createGain();
      const peak = gain / freqs.length * 1.3;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.04);
      g.gain.linearRampToValueAtTime(peak * 0.75, t + 0.20);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      o.connect(lp).connect(g).connect(this.master!);
      if (this.spaceSend) {
        const w = ctx.createGain();
        w.gain.value = 0.20;
        g.connect(w).connect(this.spaceSend);
      }
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.05);
      lfo.stop(t + dur + 0.05);
    }
  }

  private click(t: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(0.012);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    src.connect(hp).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + 0.03);
  }

  private noiseSwell(t: number, dur: number, peak: number, centerHz = 1800, q = 0.7): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer(dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = centerHz;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master!);
    if (this.spaceSend) {
      const w = ctx.createGain();
      w.gain.value = 0.25;
      g.connect(w).connect(this.spaceSend);
    }
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
    return buf;
  }

  private makeReverbIR(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return ir;
  }
}

let singleton: AudioEngine | null = null;
export function getAudio(): AudioEngine {
  if (!singleton) singleton = new AudioEngine();
  return singleton;
}
