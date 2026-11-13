// Tests for WREL Weather. Run: node --test test/*.test.ts
// WREL Weather, created by Jessica Mosley | LinkedIn: https://www.linkedin.com/in/jessmosley/ | GitHub: https://github.com/j-m-o/

import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { RATE, build, decodeWav, encodeWav, loadWav, peakOf, splitRead, writeWav } from "../src/audio.ts";
import { DEMO_REPORT, THEME, main } from "../src/cli.ts";
import { checkReport, cueSheet, list, readText, script, spokenDate, spokenId, type Segment, type WeatherReport } from "../src/forecast.ts";
import { page } from "../src/player.ts";

const report = (): WeatherReport => JSON.parse(readFileSync(DEMO_REPORT, "utf8"));
const tmp = () => mkdtempSync(join(tmpdir(), "wrel-"));

/** A stand-in for a recorded read: a buzzing voice per sentence, short pauses between
 * sentences and a longer one between paragraphs, like a real announcer. */
function fakeRead(segs: Segment[], gap = 0.9): number[] {
  const out: number[] = [];
  segs.forEach((s, k) => {
    const sentences = s.text.split(/(?<=[.:!?])\s+/).filter(Boolean);
    sentences.forEach((sent, j) => {
      const n = Math.floor((sent.split(/\s+/).length / 2.6) * RATE);
      for (let i = 0; i < n; i++) out.push(0.4 * Math.sin(i / 9) * (0.6 + 0.4 * Math.sin(i / 1500)));
      if (j < sentences.length - 1) for (let i = 0; i < 0.3 * RATE; i++) out.push(0);
    });
    if (k < segs.length - 1) for (let i = 0; i < gap * RATE; i++) out.push(0);
  });
  return out;
}

describe("the forecast script", () => {
  const segs = script(report());
  const text = segs.map((s) => s.text).join(" ");

  it("signs on, reads warnings, then advisories, then fair weather, then signs off", () => {
    assert.deepEqual(segs.map((s) => s.kind), ["sign-on", "warning", "warning", "warning", "warning", "advisory", "advisory", "advisory", "fair", "sign-off"]);
    assert.deepEqual(segs.filter((s) => s.kind === "warning").map((s) => s.id), ["checkout", "accounts", "shipping", "recommend"]);
  });
  it("states the evidence from the Weather Report", () => {
    for (const fact of ["4 warnings, 3 advisories and 5 regions of fair weather", "A storm warning is in effect over checkout",
      "Incident number 7 remains open, and 3 tests failed this week", "Temperatures reached 92 degrees, with 60 commits",
      "69 commits this week, against a usual 11", "only 41 percent of the code is covered", "not one commit in 124 days",
      "Gusty winds over api gateway, with 4 outdated dependencies", "Friday, November 13th"]) {
      assert.ok(text.includes(fact), fact);
    }
  });
  it("lights up the right regions", () => {
    assert.deepEqual(segs.find((s) => s.id === "checkout")!.regions, ["checkout"]);
    assert.deepEqual([...segs.find((s) => s.kind === "fair")!.regions].sort(), ["cart", "catalog", "inventory", "notifications", "search"]);
    const lit = new Set(segs.flatMap((s) => s.regions));
    assert.equal(lit.size, report().regions.length);
  });
  it("chimes only before storm warnings", () => {
    assert.deepEqual(segs.filter((s) => s.chime).map((s) => s.id), ["checkout"]);
  });
  it("writes lists without a serial comma, and no em dashes", () => {
    assert.equal(list(["a", "b", "c"]), "a, b and c");
    assert.ok(!/, and (search|catalog|cart)/.test(text));
    assert.ok(!text.includes(String.fromCharCode(0x2014)));
  });
  it("says when a storm has cleared, and when instruments had no reading", () => {
    const r = report();
    const co = r.regions.find((x) => x.id === "checkout")!;
    co.readings.openIncidents = [];
    r.missing = ["coverage"];
    const t = script(r).map((s) => s.text).join(" ");
    assert.ok(t.includes("Incident number 7 struck this week and has since cleared"));
    assert.ok(t.includes("no reading for coverage"));
  });
  it("speaks dates and ids naturally", () => {
    assert.equal(spokenDate("2026-11-01T12:00:00Z"), "Sunday, November 1st");
    assert.equal(spokenId("INC-07"), "incident number 7");
  });
  it("gives one paragraph per segment for a single recorded read", () => {
    assert.equal(readText(segs).trim().split("\n\n").length, segs.length);
    assert.equal((cueSheet(report(), segs).match(/> CHIME/g) ?? []).length, 1);
  });
  it("is deterministic", () => {
    assert.deepEqual(script(report()), segs);
  });
});

describe("the report contract", () => {
  it("accepts the Weather Report's own output", () => assert.deepEqual(checkReport(report()), []));
  it("catches a report that is not one", () => {
    assert.ok(checkReport({}).length);
    assert.ok(checkReport({ asOf: "2026-11-13T00:00:00Z", regions: [{ id: "x", condition: "hail" }] }).length);
  });
});

describe("the audio", () => {
  const segs = script(report());
  it("reads and writes WAV, resampling stereo to mono", () => {
    const stereo = Buffer.alloc(44 + 4410 * 4);
    const enc = encodeWav([0.5, -0.5]);
    assert.equal(enc.toString("ascii", 0, 4), "RIFF");
    assert.deepEqual(decodeWav(enc).map((v) => Math.round(v * 2) / 2), [0.5, -0.5]);
    enc.copy(stereo, 0, 0, 44);
    stereo.writeUInt16LE(2, 22); stereo.writeUInt32LE(44100, 24); stereo.writeUInt32LE(4410 * 4, 40);
    for (let i = 0; i < 4410; i++) { stereo.writeInt16LE(1000, 44 + i * 4); stereo.writeInt16LE(-1000, 46 + i * 4); }
    const x = decodeWav(stereo);
    assert.ok(Math.abs(x.length - 2205) <= 2);
    assert.ok(x.every((v) => Math.abs(v) < 1e-9));
  });
  it("splits one read into its paragraphs, even with dramatic pauses", () => {
    const pieces = splitRead(fakeRead(segs), segs);
    assert.deepEqual(Object.keys(pieces), segs.map((s) => s.id));
  });
  it("refuses a read that does not match the script", () => {
    assert.throws(() => splitRead(fakeRead(segs.slice(0, 4)), segs));
  });
  it("mixes the broadcast: theme, chime before the storm, theme out", () => {
    const theme = loadWav(THEME);
    const { samples, cues } = build(segs, splitRead(fakeRead(segs), segs), theme);
    const kinds = cues.map((c) => c.kind);
    assert.equal(kinds[0], "theme");
    assert.equal(kinds.at(-1), "theme");
    assert.equal(kinds.filter((k) => k === "chime").length, 1);
    assert.equal(cues[kinds.indexOf("chime") + 1]!.segment, "checkout");
    assert.deepEqual(cues.filter((c) => c.kind === "voice").map((c) => c.segment), segs.map((s) => s.id));
    assert.ok(peakOf(samples) <= 0.951);
    assert.ok(samples.length / RATE > 60);
  });
  it("mixes the same broadcast every time", () => {
    const voices = splitRead(fakeRead(segs), segs);
    assert.deepEqual(build(segs, voices, null).samples.slice(0, 50000), build(segs, voices, null).samples.slice(0, 50000));
  });
});

describe("the player and the command line", () => {
  it("renders an offline page with every region and every segment", () => {
    const html = page(report(), script(report()), null, null);
    assert.equal((html.match(/class="hex"/g) ?? []).length, 12);
    assert.equal((html.match(/class="cap"/g) ?? []).length, 10);
    assert.doesNotMatch(html, /(src|href)="https?:\/\//);
    assert.ok(html.includes("speechSynthesis"));
  });
  it("runs the demo, and the demo with a recorded read", () => {
    const out = tmp();
    const write = process.stdout.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      assert.equal(main(["demo", "--out", out]), 0);
      assert.ok(readFileSync(join(out, "player.html"), "utf8").includes('<audio id="t"'));
      writeWav(fakeRead(script(report())), join(out, "read.wav"));
      assert.equal(main(["demo", "--out", out, "--voice-file", join(out, "read.wav")]), 0);
      assert.ok(readFileSync(join(out, "player.html"), "utf8").includes('<audio id="b"'));
      assert.ok(readdirSync(out).includes("broadcast.wav"));
      assert.equal(main(["check", "--report", DEMO_REPORT]), 0);
    } finally {
      process.stdout.write = write;
      rmSync(out, { recursive: true });
    }
  });
});

describe("hygiene", () => {
  it("never touches the network", () => {
    const src = join(import.meta.dirname, "..", "src");
    for (const f of readdirSync(src)) assert.doesNotMatch(readFileSync(join(src, f), "utf8"), /\bfetch\(|node:https?|node:net\b/, f);
  });
});
