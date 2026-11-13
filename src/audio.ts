// The broadcast mixer, the same sound as Release Radio: the WREL theme opens and fades under
// the sign-on, the announcer comes through an old valve radio, a chime sounds before each
// storm warning and the theme comes back under the sign-off. Light crackle throughout.
// No dependencies, deterministic.
// WREL Weather, created by Jessica Mosley | LinkedIn: https://www.linkedin.com/in/jessmosley/ | GitHub: https://github.com/j-m-o/

import { readFileSync, writeFileSync } from "node:fs";
import type { Segment } from "./forecast.ts";

export const RATE = 22050;
const THEME_GAIN = 0.8;
const DUCK = 0.14;
const INTRO_SECONDS = 6.5;
const OUTRO_UNDER = 7;

// ---------------------------------------------------------------- WAV in and out

/** Any 8, 16 or 24-bit PCM WAV, mono or stereo, any rate: mono samples at 22.05 kHz. */
export function decodeWav(buf: Buffer): number[] {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error("not a WAV file");
  let pos = 12, fmt: { ch: number; rate: number; bits: number } | null = null, data: Buffer | null = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4), size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      if (buf.readUInt16LE(pos + 8) !== 1 && buf.readUInt16LE(pos + 8) !== 0xfffe) throw new Error("only PCM WAV is supported");
      fmt = { ch: buf.readUInt16LE(pos + 10), rate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) };
    } else if (id === "data") {
      data = buf.subarray(pos + 8, pos + 8 + size);
    }
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("WAV is missing its fmt or data chunk");
  const width = fmt.bits / 8, frame = width * fmt.ch, n = Math.floor(data.length / frame);
  const read = (o: number) => width === 2 ? data!.readInt16LE(o) / 32768
    : width === 1 ? (data![o]! - 128) / 128
    : width === 3 ? data!.readIntLE(o, 3) / 8388608
    : (() => { throw new Error(`unsupported sample width ${fmt!.bits}`); })();
  const mono = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) s += read(i * frame + c * width);
    mono[i] = s / fmt.ch;
  }
  if (fmt.rate === RATE) return mono;
  const step = fmt.rate / RATE, out: number[] = [];
  for (let p = 0; p < mono.length - 1; p += step) {
    const i = Math.floor(p), f = p - i;
    out.push(mono[i]! * (1 - f) + mono[i + 1]! * f);
  }
  return out;
}

export const loadWav = (path: string) => decodeWav(readFileSync(path));

export function encodeWav(samples: number[]): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0, "ascii"); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii"); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii"); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return buf;
}

export const writeWav = (samples: number[], path: string) => writeFileSync(path, encodeWav(samples));

// ---------------------------------------------------------------- one read, split into segments

function frames(x: number[], ms = 20): { step: number; rms: number[] } {
  const step = Math.floor((RATE * ms) / 1000), rms: number[] = [];
  for (let i = 0; i < x.length; i += step) {
    let s = 0, n = 0;
    for (let j = i; j < Math.min(x.length, i + step); j++, n++) s += x[j]! * x[j]!;
    rms.push(Math.sqrt(s / Math.max(1, n)));
  }
  return { step, rms };
}

export function trim(x: number[], floor = 0.01): number[] {
  let a = 0, b = x.length - 1;
  while (a < x.length && Math.abs(x[a]!) <= floor) a++;
  while (b > a && Math.abs(x[b]!) <= floor) b--;
  return a >= x.length ? x : x.slice(Math.max(0, a - 400), b + 2000);
}

export function pauses(x: number[]): { at: number; seconds: number }[] {
  const { step, rms } = frames(x);
  const voiced = rms.filter((v) => v > 0.005).sort((p, q) => p - q);
  const floor = voiced.length ? Math.max(0.004, 0.12 * voiced[Math.floor(voiced.length / 2)]!) : 0.004;
  const out: { at: number; seconds: number }[] = [];
  for (let i = 0; i < rms.length;) {
    if (rms[i]! < floor) {
      let j = i;
      while (j < rms.length && rms[j]! < floor) j++;
      if (i > 0 && j < rms.length && (j - i) * step >= 0.2 * RATE) out.push({ at: Math.floor((i + j) / 2) * step, seconds: ((j - i) * step) / RATE });
      i = j;
    } else i++;
  }
  return out;
}

/**
 * Splits one take of the whole script into its segments. An announcer's dramatic pauses can
 * be longer than his pauses between paragraphs, so this picks the set of pauses that best fits
 * each paragraph's expected length from its word count (preferring longer pauses), then checks
 * every piece, so a bad split fails loudly instead of putting words under the wrong caption.
 */
export function splitRead(x: number[], segs: Segment[]): Record<string, number[]> {
  const gaps = pauses(x), need = segs.length - 1;
  if (gaps.length < need) throw new Error(`found ${gaps.length} pauses, need ${need}: record the read with a clear pause between paragraphs`);
  const words = segs.map((s) => s.text.split(/\s+/).length);
  const perWord = x.length / words.reduce((a, b) => a + b, 0);
  const pos = [0, ...gaps.map((g) => g.at), x.length], len = [0, ...gaps.map((g) => g.seconds), 0], end = pos.length - 1;
  const best = segs.map(() => pos.map(() => Infinity)).concat([pos.map(() => Infinity)]);
  const back = segs.map(() => pos.map(() => 0)).concat([pos.map(() => 0)]);
  best[0]![0] = 0;
  for (let k = 0; k < segs.length; k++) {
    for (let b = 1; b < pos.length; b++) {
      if ((k === segs.length - 1) !== (b === end)) continue;
      for (let a = 0; a < b; a++) {
        if (best[k]![a] === Infinity) continue;
        const c = best[k]![a]! + 4 * Math.log(Math.max(1, pos[b]! - pos[a]!) / (words[k]! * perWord)) ** 2 - len[b]!;
        if (c < best[k + 1]![b]!) { best[k + 1]![b] = c; back[k + 1]![b] = a; }
      }
    }
  }
  const cuts: number[] = [];
  for (let k = segs.length, b = end; k > 0; k--) { cuts.push(pos[b]!); b = back[k]![b]!; }
  const bounds = [0, ...cuts.reverse()];
  const pieces = segs.map((_, k) => trim(x.slice(bounds[k], bounds[k + 1])));
  const rate = pieces.reduce((a, p) => a + p.length, 0) / words.reduce((a, b) => a + b, 0);
  segs.forEach((s, k) => {
    const ratio = pieces[k]!.length / (words[k]! * rate);
    if (ratio < 0.6 || ratio > 1.6) throw new Error(`segment ${s.id} came out ${ratio.toFixed(1)}x its expected length: check the read for extra pauses`);
  });
  return Object.fromEntries(segs.map((s, k) => [s.id, pieces[k]!]));
}

// ---------------------------------------------------------------- the radio sound

function biquad(x: number[], kind: "lp" | "hp", f: number): number[] {
  const w = (2 * Math.PI * f) / RATE, alpha = Math.sin(w) / (2 * 0.707), c = Math.cos(w), a0 = 1 + alpha;
  const [b0, b1, b2] = kind === "lp" ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const a1 = (-2 * c) / a0, a2 = (1 - alpha) / a0;
  const y = new Array<number>(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!, o = (b0! / a0) * v + (b1! / a0) * x1 + (b2! / a0) * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o;
  }
  return y;
}

/** A narrow valve-radio band, a little saturation, normalised. */
export function radioVoice(x: number[]): number[] {
  let y = biquad(biquad(biquad(biquad(x, "hp", 300), "hp", 300), "lp", 3200), "lp", 3600).map((v) => Math.tanh(1.8 * v));
  const peak = peakOf(y);
  y = y.map((v) => (0.8 * v) / peak);
  return y;
}

/** A small seeded generator, so the crackle is the same every time. */
function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function crackle(n: number, r: () => number, hiss = 0.004, popsPerSec = 2): number[] {
  const out = Array.from({ length: n }, () => (r() * 2 - 1) * hiss);
  for (let p = 0; p < Math.floor((n / RATE) * popsPerSec); p++) {
    const i = Math.floor(r() * n), amp = (0.02 + r() * 0.06) * (r() < 0.5 ? 1 : -1);
    for (let k = 0; k < 40 && i + k < n; k++) out[i + k]! += amp * Math.exp(-k / 6);
  }
  return out;
}

/** Three ascending bell tones (C, E, G): the station's storm chime. */
export function chime(): number[] {
  const out = new Array<number>(Math.floor(RATE * 2)).fill(0);
  [523.25, 659.25, 783.99].forEach((f, k) => {
    const start = Math.floor(k * 0.42 * RATE);
    for (let i = 0; i < Math.floor(1.3 * RATE) && start + i < out.length; i++) {
      const t = i / RATE, env = Math.exp(-t * 3.4) * Math.min(1, i / 60);
      out[start + i]! += 0.22 * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * 2.76 * f * t));
    }
  });
  return out;
}

/** The loudest sample. A loop, because spreading millions of samples into Math.max overflows the stack. */
export function peakOf(x: number[]): number {
  let m = 1e-9;
  for (const v of x) if (Math.abs(v) > m) m = Math.abs(v);
  return m;
}

const ramp = (i: number, a: number, b: number, ga: number, gb: number) => (i <= a ? ga : i >= b ? gb : ga + ((gb - ga) * (i - a)) / (b - a));

export interface Cue { t0: number; t1: number; kind: "theme" | "chime" | "voice"; segment: string | null }

export function build(segs: Segment[], voices: Record<string, number[]>, theme: number[] | null): { samples: number[]; cues: Cue[] } {
  const r = rng(1947);
  const out: number[] = [];
  const cues: Cue[] = [];
  const s = (n: number) => Math.floor(n * RATE);
  const mark = (kind: Cue["kind"], segment: string | null, a: number, b: number) =>
    cues.push({ t0: Math.round((a / RATE) * 1000) / 1000, t1: Math.round((b / RATE) * 1000) / 1000, kind, segment });
  const place = (chunk: number[], at: number) => {
    while (out.length < at + chunk.length) out.push(0);
    chunk.forEach((v, i) => { out[at + i]! += v; });
  };

  const first = segs[0]!, last = segs.at(-1)!;
  const v0 = radioVoice(voices[first.id]!);
  let startV: number;
  if (theme) {
    startV = s(INTRO_SECONDS) - s(0.3);
    const fadeFrom = startV + v0.length, stop = Math.min(theme.length, fadeFrom + s(1.5));
    place(theme.slice(0, stop).map((v, i) => v * THEME_GAIN * ramp(i, startV - s(0.5), startV + s(0.8), 1, DUCK) * ramp(i, fadeFrom, stop, 1, 0)), 0);
    mark("theme", null, 0, startV);
  } else {
    const c = chime();
    place(c, 0);
    mark("chime", null, 0, c.length);
    startV = c.length + s(0.3);
  }
  place(v0, startV);
  mark("voice", first.id, startV, startV + v0.length);
  let cursor = startV + v0.length;

  for (const seg of segs.slice(1, -1)) {
    cursor += s(0.7);
    if (seg.chime) {
      const c = chime();
      place(c, cursor);
      mark("chime", seg.id, cursor, cursor + c.length);
      cursor += c.length + s(0.2);
    }
    const v = radioVoice(voices[seg.id]!);
    place(v, cursor);
    mark("voice", seg.id, cursor, cursor + v.length);
    cursor += v.length;
  }

  cursor += s(0.7);
  const vl = radioVoice(voices[last.id]!);
  place(vl, cursor);
  mark("voice", last.id, cursor, cursor + vl.length);
  const endV = cursor + vl.length;
  if (theme) {
    const enter = Math.max(cursor, endV - s(OUTRO_UNDER)), n = theme.length, fadeA = n - s(2.5);
    place(theme.map((v, i) => v * THEME_GAIN * ramp(i, 0, s(1.2), 0, DUCK) * ramp(enter + i, endV + s(0.2), endV + s(1), 1, 1 / DUCK) * ramp(i, fadeA, n, 1, 0)), enter);
    mark("theme", null, endV, Math.max(endV, enter + n));
  } else {
    const c = chime();
    place(c, endV + s(0.5));
    mark("chime", null, endV + s(0.5), endV + s(0.5) + c.length);
  }
  for (let i = 0; i < s(0.3); i++) out.push(0);
  const hiss = crackle(out.length, r);
  let samples = out.map((v, i) => v + hiss[i]!);
  const peak = peakOf(samples);
  if (peak > 0.95) samples = samples.map((v) => (0.95 * v) / peak);
  return { samples, cues };
}
