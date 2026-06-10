// Procedural 16-bit retro synthesizer using the Web Audio API

class SoundManager {
  private ctx: AudioContext | null = null;
  private musicInterval: any = null;
  private currentMusicType: 'map' | 'green' | 'cave' | 'castle' | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on the first user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopMusic();
    } else {
      if (this.currentMusicType) {
        this.playMusic(this.currentMusicType);
      }
    }
  }

  toggleMute() {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  getMuteState() {
    return this.isMuted;
  }

  // --- Sound Effects ---

  playJump() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle'; // Smooth jump sound

    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  playCoin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    const t = this.ctx.currentTime;
    // Retro standard coin double beep (987.77Hz to 1318.51Hz) - B5 to E6
    osc.frequency.setValueAtTime(987, t);
    osc.frequency.setValueAtTime(1318, t + 0.08);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  playPowerUp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square'; // Classic powerup sound (rising arpeggio)

    const t = this.ctx.currentTime;
    const notes = [330, 392, 659, 523, 587, 784]; // E4, G4, E5, C5, D5, G5
    const duration = 0.06;

    notes.forEach((freq, idx) => {
      osc.frequency.setValueAtTime(freq, t + idx * duration);
    });

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + notes.length * duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + notes.length * duration);
  }

  playPowerDown() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.3);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  playStomp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    // Squishy explosion noise using a rapid frequency drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  playShoot() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';

    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  playHurt() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(60, t + 0.25);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  playBlockHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';

    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.1, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  playClear() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    this.stopMusic();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';

    const t = this.ctx.currentTime;
    const fanfare = [523, 659, 784, 523 * 2, 659 * 2, 784 * 2]; // C5, E5, G5, C6, E6, G6
    const dur = 0.12;

    fanfare.forEach((f, i) => {
      osc.frequency.setValueAtTime(f, t + i * dur);
    });

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.setValueAtTime(0.2, t + fanfare.length * dur - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, t + fanfare.length * dur + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + fanfare.length * dur + 0.4);
  }

  playGameOver() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    this.stopMusic();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    const t = this.ctx.currentTime;
    const notes = [392, 349, 311, 262]; // G4, F4, D#4, C4
    const dur = 0.2;

    notes.forEach((f, i) => {
      osc.frequency.setValueAtTime(f, t + i * dur);
    });

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 1.2);
  }

  // --- Procedural 16-Bit Music Synthesizer ---

  playMusic(type: 'map' | 'green' | 'cave' | 'castle') {
    this.currentMusicType = type;
    if (this.isMuted) return;

    this.initCtx();
    if (!this.ctx) return;

    this.stopMusic();

    const ctx = this.ctx;

    // Upbeat Overworld style
    const mapMelody = [
      392, 440, 494, 523, 587, 659, 698, 784, // C Major run
      784, 698, 659, 587, 523, 494, 440, 392
    ];

    // Happy Green Hill style
    const greenMelody = [
      262, 329, 392, 523, 392, 523, 262, 329,
      294, 349, 440, 587, 440, 587, 294, 349,
      329, 392, 494, 659, 494, 659, 329, 392,
      349, 440, 523, 698, 523, 698, 392, 494
    ];

    // Mysterious, echoey Cave
    const caveMelody = [
      130, 164, 196, 261, 329, 196, 164, 130,
      146, 174, 220, 293, 349, 220, 174, 146,
      130, 164, 196, 261, 329, 196, 164, 130,
      98, 123, 146, 196, 246, 146, 123, 98
    ];

    // High intensity Castle dramatic progression
    const castleMelody = [
      220, 220, 233, 233, 261, 261, 277, 277,
      220, 293, 220, 293, 311, 311, 329, 329,
      440, 440, 415, 415, 392, 392, 349, 349,
      329, 293, 261, 220, 207, 196, 165, 110
    ];

    let melody: number[] = [];
    let speed = 0.15; // note duration
    let typeOsc: 'sine' | 'square' | 'triangle' | 'sawtooth' = 'triangle';
    let volume = 0.05;

    if (type === 'map') {
      melody = mapMelody;
      speed = 0.25;
      typeOsc = 'sine';
      volume = 0.04;
    } else if (type === 'green') {
      melody = greenMelody;
      speed = 0.18;
      typeOsc = 'square'; // Classic square sound
      volume = 0.03;
    } else if (type === 'cave') {
      melody = caveMelody;
      speed = 0.3;
      typeOsc = 'triangle';
      volume = 0.06;
    } else if (type === 'castle') {
      melody = castleMelody;
      speed = 0.14;
      typeOsc = 'sawtooth';
      volume = 0.03;
    }

    let noteIdx = 0;

    const playNote = () => {
      if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = typeOsc;

      const freq = melody[noteIdx % melody.length];
      const now = this.ctx.currentTime;

      osc.frequency.setValueAtTime(freq, now);
      
      // ADSR Envelope
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.02);
      gain.gain.setValueAtTime(volume, now + speed - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + speed);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + speed);

      noteIdx++;
    };

    // Play first note immediately, then loop
    playNote();
    this.musicInterval = setInterval(playNote, speed * 1000);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const audio = new SoundManager();
