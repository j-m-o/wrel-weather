// Repository checks: skill metadata, demo report, theme, JSON, compiled scripts present,
// no network, no em dashes. Run: node scripts/validate.ts
// WREL Weather, created by Jessica Mosley | LinkedIn: https://www.linkedin.com/in/jessmosley/ | GitHub: https://github.com/j-m-o/

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkReport } from "../src/forecast.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = join(ROOT, "skills", "wrel-weather");
const errors: string[] = [];

const md = readFileSync(join(SKILL, "SKILL.md"), "utf8");
const front = /^---\n([\s\S]*?)\n---\n/.exec(md)?.[1] ?? "";
if (!/^name: wrel-weather$/m.test(front)) errors.push("SKILL.md: name must be wrel-weather");
if ((/^description: (.*)$/m.exec(front)?.[1] ?? "").length < 40) errors.push("SKILL.md: description too short");

for (const p of checkReport(JSON.parse(readFileSync(join(SKILL, "assets", "demo", "report.json"), "utf8")))) errors.push(`demo report.json: ${p}`);
if (!existsSync(join(SKILL, "assets", "theme", "wrel_theme.wav"))) errors.push("assets/theme/wrel_theme.wav: the WREL theme is missing");

for (const f of readdirSync(join(ROOT, "src"))) {
  const js = join(SKILL, "scripts", f.replace(/\.ts$/, ".js"));
  if (!existsSync(js)) errors.push(`scripts/${f.replace(/\.ts$/, ".js")} missing: run npm run build`);
  else if (/\bfetch\(|node:https?/.test(readFileSync(js, "utf8"))) errors.push(`${f}: the skill never uses the network`);
}

const TEXT = new Set([".md", ".ts", ".js", ".json", ".yml", ".yaml", ".html"]);
function walk(dir: string): void {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".git", "dist"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!TEXT.has(extname(p))) continue;
    const text = readFileSync(p, "utf8");
    const rel = relative(ROOT, p);
    if (text.includes(String.fromCharCode(0x2014))) errors.push(`${rel}: contains an em dash`);
    if (extname(p) === ".json") { try { JSON.parse(text); } catch (e) { errors.push(`${rel}: invalid JSON (${(e as Error).message})`); } }
  }
}
walk(ROOT);

if (errors.length) {
  console.log("FAILED\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("OK: skill metadata, demo data contract, JSON, compiled scripts, no network, no em dashes");
