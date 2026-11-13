// The WREL Weather player: one offline page with the cathedral radio, the honeycomb map that
// lights up the regions being read, and the captions. With a mixed broadcast it plays that;
// without one, it plays the theme and the browser's own voice reads the forecast.
// WREL Weather, created by Jessica Mosley | LinkedIn: https://www.linkedin.com/in/jessmosley/ | GitHub: https://github.com/j-m-o/
import { C, TILE, hexPath, icon } from "./icons.js";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAME = { sunny: "Sunny", partly: "Partly cloudy", wind: "Windy", snow: "Snow", fog: "Fog", heat: "Heat wave", rain: "Rain", storm: "Thunderstorm" };
const RADIO = `<svg viewBox="0 0 420 400" class="radio" aria-hidden="true">
<path d="M40 380 L40 190 C40 70 120 20 210 20 C300 20 380 70 380 190 L380 380 Z" fill="${C.purple}" stroke="${C.navy}" stroke-width="6" stroke-linejoin="round"/>
<path d="M66 360 L66 196 C66 96 132 48 210 48 C288 48 354 96 354 196 L354 360 Z" fill="none" stroke="${C.navy}" stroke-width="3" opacity=".55"/>
<g fill="${C.navy}"><path d="M104 250 L104 170 C104 130 126 104 150 104 C174 104 196 130 196 170 L196 250 Z"/>
<path d="M224 250 L224 170 C224 130 246 104 270 104 C294 104 316 130 316 170 L316 250 Z"/></g>
<rect x="150" y="62" width="120" height="30" rx="8" fill="${C.paper}" stroke="${C.navy}" stroke-width="3"/>
<text x="210" y="84" text-anchor="middle" fill="${C.navy}" font-family="Lexend, system-ui, sans-serif" font-size="18" font-weight="700" letter-spacing="3">WREL</text>
<circle cx="210" cy="305" r="44" fill="${C.paper}" stroke="${C.navy}" stroke-width="5"/>
<circle cx="210" cy="305" r="34" class="dial" fill="${C.gold}" stroke="${C.navy}" stroke-width="2"/>
<line x1="210" y1="305" x2="228" y2="283" stroke="${C.navy}" stroke-width="3" stroke-linecap="round"/>
<circle cx="110" cy="318" r="22" fill="${C.navy}"/><circle cx="110" cy="318" r="9" fill="${C.gold}"/>
<circle cx="310" cy="318" r="22" fill="${C.navy}"/><circle cx="310" cy="318" r="9" fill="${C.gold}"/>
<rect x="30" y="372" width="360" height="16" rx="6" fill="${C.navy}"/></svg>`;
function map(regions) {
    const n = regions.length, cols = n <= 12 ? 3 : Math.ceil(Math.sqrt(n * 0.8)), rows = Math.ceil(n / cols);
    const R = 92, w = Math.sqrt(3) * R, ox = w / 2 + 6, oy = R + 6;
    const W = Math.ceil(ox + cols * w + w / 2), H = Math.ceil(oy + 1.5 * R * (rows - 1) + R + 6);
    const tiles = regions.map((r, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        const cx = ox + col * w + (row % 2 ? w / 2 : 0), cy = oy + row * 1.5 * R;
        const temp = r.readings.temperature === null ? "no reading" : `${r.readings.temperature}&#176;`;
        return `<g class="hex" data-region="${esc(r.id)}"><title>${esc(`${r.id}: ${NAME[r.condition]}. ${r.headline}`)}</title>
<path d="${hexPath(cx, cy, R - 3)}" fill="${TILE[r.condition]}" stroke="${C.navy}" stroke-width="4" stroke-linejoin="round" class="tile"/>
${icon(r.condition, cx, cy - 20)}
<text x="${cx.toFixed(1)}" y="${(cy + 30).toFixed(1)}" text-anchor="middle" class="hname">${esc(r.id)}</text>
<text x="${cx.toFixed(1)}" y="${(cy + 50).toFixed(1)}" text-anchor="middle" class="htemp">${temp}</text></g>`;
    }).join("\n");
    return `<svg viewBox="0 0 ${W} ${H}" class="map" role="img" aria-label="Weather map of ${n} regions; the regions being read glow gold">${tiles}</svg>`;
}
function label(s) {
    if (s.kind === "warning" || s.kind === "advisory")
        return `${s.kind}: ${s.id}`;
    return s.id.replace("-", " ");
}
export function page(report, segs, broadcast, theme) {
    const caps = segs.map((s) => `<li class="cap" data-seg="${esc(s.id)}"><span class="lbl">${esc(label(s))}</span><p>${esc(s.text)}</p></li>`).join("");
    const storms = report.regions.filter((r) => r.condition === "storm").length;
    const data = JSON.stringify({ segs: segs.map(({ id, regions, text, kind, chime }) => ({ id, regions, text, kind, chime })), cues: broadcast?.cues ?? null });
    const audio = (id, b) => (b ? `<audio id="${id}" src="data:audio/wav;base64,${b.toString("base64")}" preload="auto"></audio>` : "");
    const record = [...report.regions].sort((a, b) => a.id.localeCompare(b.id)).map((r) => `<tr><th scope="row">${esc(r.id)}</th><td>${NAME[r.condition]}</td><td>${esc(r.headline)}</td><td>${esc(r.trend.text)}</td></tr>`).join("");
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>WREL Weather: ${esc(report.subject)}</title>
<style>
:root { --navy:${C.navy}; --soft:${C.soft}; --sky:${C.sky}; --paper:${C.paper}; --gold:${C.gold}; --purple:${C.purple}; }
* { box-sizing:border-box; }
body { margin:0; background:${C.page}; color:var(--navy); font:16px/1.5 "Atkinson Hyperlegible", system-ui, sans-serif; }
main { max-width:1360px; margin:28px auto; padding:28px 34px; background:var(--paper); border:4px solid var(--navy); border-radius:28px; }
h1, h2, .lbl, .chip, b, .hname { font-family:Lexend, system-ui, sans-serif; }
h1 { font-size:40px; margin:0; letter-spacing:.04em; }
h1 span { color:var(--purple); }
.tag { color:var(--soft); margin:0 0 18px; font-size:17px; }
.grid { display:grid; grid-template-columns:270px minmax(0,1fr) 340px; gap:26px; align-items:start; }
.radio { width:100%; height:auto; }
.playing .dial { animation:glow 1.6s ease-in-out infinite; }
@keyframes glow { 0%,100% { fill:${C.gold}; } 50% { fill:#FFE1A1; } }
.controls { display:flex; align-items:center; gap:10px; margin-top:14px; }
#play { width:56px; height:56px; border-radius:50%; border:4px solid var(--navy); background:var(--gold); color:var(--navy); font-size:20px; cursor:pointer; flex:none; }
.progress { flex:1; height:14px; background:var(--sky); border:2px solid var(--navy); border-radius:999px; overflow:hidden; }
.progress i { display:block; height:100%; width:0; background:var(--gold); }
#clock { font-variant-numeric:tabular-nums; }
.chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.chip { padding:4px 14px; border:2px solid var(--navy); border-radius:999px; font-weight:700; background:#fff; }
.small { border:2px solid var(--navy); background:#fff; color:var(--navy); border-radius:999px; padding:6px 14px; font:inherit; font-weight:700; cursor:pointer; }
button:focus-visible { outline:3px solid var(--purple); outline-offset:3px; }
.note { font-size:15px; color:var(--soft); }
.maplbl { font-family:Lexend, system-ui, sans-serif; font-size:13px; letter-spacing:.12em; color:var(--purple); font-weight:700; text-transform:uppercase; }
.map { width:100%; height:auto; }
.hex .tile { transition:stroke .2s, stroke-width .2s; }
.hex.on .tile { stroke:${C.gold}; stroke-width:9; }
.hname { font-size:16px; font-weight:700; fill:var(--navy); }
.htemp { font-size:15px; fill:var(--soft); }
.onair { background:var(--navy); color:var(--paper); border-radius:16px; padding:14px 10px; max-height:640px; overflow:auto; }
.onair h2 { font-size:12px; letter-spacing:.14em; color:var(--gold); margin:0 10px 8px; text-transform:uppercase; }
.caps { list-style:none; margin:0; padding:0; }
.cap { padding:8px 10px; margin-bottom:6px; border-radius:10px; opacity:.6; }
.cap.on { background:var(--soft); opacity:1; }
.cap .lbl { font-size:11px; letter-spacing:.12em; color:var(--gold); font-weight:700; text-transform:uppercase; }
.cap p { margin:2px 0 0; font-size:15px; line-height:1.4; }
.record { margin-top:24px; }
.record h2 { font-size:22px; margin:0 0 8px; }
table { width:100%; border-collapse:collapse; font-size:15px; }
th, td { text-align:left; padding:6px 10px; border-bottom:2px solid var(--sky); vertical-align:top; }
footer { margin-top:18px; font-size:14px; color:var(--soft); }
@media (max-width:1100px) { .grid { grid-template-columns:1fr; } .radio { max-width:260px; } main { margin:0; border-radius:0; } }
@media (prefers-reduced-motion:reduce) { .playing .dial { animation:none; } .hex .tile { transition:none; } }
</style></head>
<body><main>
<h1>WREL <span>WEATHER</span></h1>
<p class="tag">The six o&#8217;clock codebase forecast for ${esc(report.subject)}. Every word straight from the record.</p>
<div class="grid">
<div>${RADIO}
<div class="controls"><button id="play" aria-label="Play the forecast">&#9654;</button><div class="progress"><i id="prog"></i></div><span id="clock">0:00</span></div>
<div class="chips"><span class="chip" style="background:#CFC6EC">${storms} storm warning${storms === 1 ? "" : "s"}</span><span class="chip">${broadcast ? "Clyde on the air" : "Browser voice"}</span></div>
<p class="note">The theme opens the forecast, a chime sounds before each storm warning and the region being read glows gold.</p>
<div class="chips"><button class="small" id="themebtn">&#9835; Theme</button><button class="small" id="chimebtn">Chime</button></div>
</div>
<div><div class="maplbl">The map lights up as the forecast is read</div>${map(report.regions)}</div>
<section class="onair" aria-live="polite"><h2>On the air</h2><ol class="caps">${caps}</ol></section>
</div>
<section class="record"><h2>The Record</h2><table><thead><tr><th scope="col">Region</th><th scope="col">Weather</th><th scope="col">Why</th><th scope="col">Trend</th></tr></thead><tbody>${record}</tbody></table></section>
<footer>Every line is written by rules from the Codebase Weather Report. Theme music generated with ElevenLabs. ${broadcast ? "Announcer voice by ElevenLabs." : "The announcer is your browser's own voice until a recorded read is mixed in."} Advisory only: a person decides what it means. WREL Weather by Jessica Mosley.</footer>
</main>
${audio("b", broadcast?.wav ?? null)}
${audio("t", theme)}
<script>
const D = ${data};
const bc = document.getElementById('b'), th = document.getElementById('t'), btn = document.getElementById('play');
const hexes = [...document.querySelectorAll('.hex')], caps = [...document.querySelectorAll('.cap')];
const byId = Object.fromEntries(D.segs.map(s => [s.id, s]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
let run = 0, ac = null;
function mark(id) {
  const s = id ? byId[id] : null, on = new Set(s ? s.regions : []);
  hexes.forEach(h => { const hit = on.has(h.dataset.region); h.classList.toggle('on', hit); if (hit) h.parentNode.appendChild(h); });
  caps.forEach(c => { const hit = c.dataset.seg === id; c.classList.toggle('on', hit); if (hit) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
}
function onAir(on) { document.body.classList.toggle('playing', on); btn.innerHTML = on ? '&#10074;&#10074;' : '&#9654;'; btn.setAttribute('aria-label', on ? 'Stop' : 'Play the forecast'); }
function tick(a) { document.getElementById('prog').style.width = (100 * a.currentTime / (a.duration || 1)) + '%'; document.getElementById('clock').textContent = fmt(a.currentTime); }
function stop() { run++; if (window.speechSynthesis) speechSynthesis.cancel(); if (bc) bc.pause(); if (th) th.pause(); onAir(false); mark(null); }
function chime() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  [523.25, 659.25, 783.99].forEach((f, k) => {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + k * 0.42;
    o.frequency.value = f; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3); o.start(t0); o.stop(t0 + 1.4);
  });
  return sleep(1900);
}
function fade(a, to, ms) { const from = a.volume, t0 = performance.now(); return new Promise(res => (function step(now) { const k = Math.min(1, (now - t0) / ms); a.volume = from + (to - from) * k; k < 1 ? requestAnimationFrame(step) : res(); })(performance.now())); }
function voice() { const vs = window.speechSynthesis ? speechSynthesis.getVoices() : []; for (const n of ['Daniel', 'Google UK English Male', 'Arthur', 'Fred', 'Ralph', 'Microsoft George', 'Alex']) { const v = vs.find(v => v.name.includes(n)); if (v) return v; } return vs.find(v => v.lang && v.lang.startsWith('en')) || null; }
function speak(text) { return new Promise(res => { if (!window.speechSynthesis) { setTimeout(res, 2500); return; } const u = new SpeechSynthesisUtterance(text); u.rate = 0.92; u.pitch = 0.8; const v = voice(); if (v) u.voice = v; u.onend = res; u.onerror = res; speechSynthesis.speak(u); }); }
async function browserForecast() {
  const token = ++run, live = () => token === run; onAir(true);
  if (th) { th.currentTime = 0; th.volume = 0.8; th.play(); await sleep(6200); if (!live()) return; fade(th, 0.12, 800); }
  for (const [i, s] of D.segs.entries()) {
    if (!live()) return;
    if (s.chime) { await chime(); if (!live()) return; }
    if (s.kind === 'sign-off' && th) { th.currentTime = 0; th.volume = 0; th.play(); fade(th, 0.12, 1200); }
    mark(s.id); await speak(s.text);
    if (i === 0 && th) { await fade(th, 0, 1200); th.pause(); }
    await sleep(400);
  }
  if (th && live()) { await fade(th, 0.8, 900); await sleep(Math.max(0, (th.duration - th.currentTime - 2.5) * 1000)); await fade(th, 0, 2400); th.pause(); }
  if (live()) { onAir(false); mark(null); }
}
btn.onclick = () => { if (document.body.classList.contains('playing')) return stop(); if (bc) { run++; bc.currentTime = 0; bc.play(); onAir(true); } else browserForecast(); };
if (bc) {
  bc.ontimeupdate = () => { tick(bc); const c = D.cues.find(c => bc.currentTime >= c.t0 && bc.currentTime < c.t1); mark(c && c.kind === 'voice' ? c.segment : null); };
  bc.onended = () => { onAir(false); mark(null); };
} else if (th) th.ontimeupdate = () => tick(th);
document.getElementById('themebtn').onclick = () => { if (!th) return; if (!th.paused) return fade(th, 0, 1500).then(() => th.pause()); stop(); th.currentTime = 0; th.volume = 0.8; th.play(); };
document.getElementById('chimebtn').onclick = () => chime();
caps.forEach(c => c.onclick = () => mark(c.dataset.seg));
if (window.speechSynthesis) speechSynthesis.getVoices();
</script>
</body></html>
`;
}
