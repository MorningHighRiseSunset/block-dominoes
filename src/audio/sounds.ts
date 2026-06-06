import type { Player } from '../game/blockDominoes';

let ctx: AudioContext | null = null;
let unlocked = false;

/** Browsers include Web Audio — no extra software or files needed. */
export function unlockAudio(): void {
  if (unlocked && ctx?.state === 'running') return;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  unlocked = true;
}

/** Cream ↔ = soft thunk; teal ↕ = brighter plink. */
export function playPlaceSound(player: Player): void {
  if (!ctx) return;
  if (player === 0) playThunk();
  else playPlink();
}

function playThunk() {
  const t0 = ctx!.currentTime;
  const osc = ctx!.createOscillator();
  const gain = ctx!.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.12);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
  osc.connect(gain);
  gain.connect(ctx!.destination);
  osc.start(t0);
  osc.stop(t0 + 0.15);

  const noise = ctx!.createBufferSource();
  const buf = ctx!.createBuffer(1, ctx!.sampleRate * 0.06, ctx!.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  noise.buffer = buf;
  const nGain = ctx!.createGain();
  nGain.gain.setValueAtTime(0.12, t0);
  nGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
  noise.connect(nGain);
  nGain.connect(ctx!.destination);
  noise.start(t0);
  noise.stop(t0 + 0.07);
}

function playPlink() {
  const t0 = ctx!.currentTime;
  const osc = ctx!.createOscillator();
  const gain = ctx!.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880, t0);
  osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.1);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  osc.connect(gain);
  gain.connect(ctx!.destination);
  osc.start(t0);
  osc.stop(t0 + 0.2);

  const osc2 = ctx!.createOscillator();
  const g2 = ctx!.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1320, t0 + 0.02);
  g2.gain.setValueAtTime(0.0001, t0);
  g2.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  osc2.connect(g2);
  g2.connect(ctx!.destination);
  osc2.start(t0 + 0.02);
  osc2.stop(t0 + 0.14);
}
