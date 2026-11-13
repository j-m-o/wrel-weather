#!/usr/bin/env node
// The WREL Weather command line. Reads a Codebase Weather Report's report.json and puts the
// forecast on the air. Offline, no dependencies.
//
//   wrel-weather demo      [--out DIR] [--voice-file READ.wav]
//   wrel-weather broadcast --report report.json [--out DIR] [--voice-file READ.wav] [--theme THEME.wav]
//   wrel-weather check     --report report.json
//
// WREL Weather, created by Jessica Mosley | LinkedIn: https://www.linkedin.com/in/jessmosley/ | GitHub: https://github.com/j-m-o/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, encodeWav, loadWav, splitRead } from "./audio.ts";
import { checkReport, cueSheet, readText, script, type WeatherReport } from "./forecast.ts";
import { page } from "./player.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = [resolve(HERE, "..", "assets"), resolve(HERE, "..", "skills", "wrel-weather", "assets")].find((d) => existsSync(d))!;
export const DEMO_REPORT = join(ASSETS, "demo", "report.json");
export const THEME = join(ASSETS, "theme", "wrel_theme.wav");

function flags(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[++i]! : "true";
  }
  return out;
}

export function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  const f = flags(rest);
  const fail = (msg: string) => { process.stderr.write(`${msg}\n`); return 2; };
  const reportPath = cmd === "demo" ? DEMO_REPORT : f.report;

  if (cmd === "check") {
    if (!reportPath || !existsSync(reportPath)) return fail(`report.json not found: ${reportPath ?? "(give --report FILE)"}`);
    const problems = checkReport(JSON.parse(readFileSync(reportPath, "utf8")));
    process.stdout.write(problems.length ? `FAIL ${problems.join("; ")}\n` : "OK   report.json\n");
    return problems.length ? 1 : 0;
  }

  if (cmd === "demo" || cmd === "broadcast") {
    if (!reportPath || !existsSync(reportPath)) return fail(`report.json not found: ${reportPath ?? "(give --report FILE)"}. Run the Codebase Weather Report first.`);
    const data = JSON.parse(readFileSync(reportPath, "utf8"));
    const problems = checkReport(data);
    if (problems.length) return fail(`report.json: ${problems.join("; ")}`);
    const report = data as WeatherReport;
    const segs = script(report);
    const out = f.out ?? "wrel";
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "script.json"), JSON.stringify(segs, null, 2) + "\n");
    writeFileSync(join(out, "script.txt"), readText(segs));
    writeFileSync(join(out, "script.md"), cueSheet(report, segs));
    const themePath = f.theme ?? THEME;
    const theme = existsSync(themePath) ? loadWav(themePath) : null;
    let broadcast: { wav: Buffer; cues: ReturnType<typeof build>["cues"] } | null = null;
    if (f["voice-file"]) {
      const voices = splitRead(loadWav(f["voice-file"]), segs);
      const { samples, cues } = build(segs, voices, theme);
      broadcast = { wav: encodeWav(samples), cues };
      writeFileSync(join(out, "broadcast.wav"), broadcast.wav);
      writeFileSync(join(out, "cues.json"), JSON.stringify(cues, null, 1) + "\n");
    }
    writeFileSync(join(out, "player.html"), page(report, segs, broadcast, theme ? encodeWav(theme) : null));
    process.stdout.write(`WREL WEATHER  ${report.subject}\n` + segs.map((s) => `  [${s.kind}] ${s.text}`).join("\n")
      + `\n\nWrote ${join(out, "player.html")}${broadcast ? ` and ${join(out, "broadcast.wav")}` : ""}, script.txt (for one recorded read) and script.md (to read it live)\n`);
    return 0;
  }

  process.stdout.write(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 8).map((l) => l.replace(/^\/\/ ?/, "")).join("\n") + "\n");
  return cmd ? 2 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
