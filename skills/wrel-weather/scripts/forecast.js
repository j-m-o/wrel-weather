// The six o'clock forecast: turns a Codebase Weather Report (report.json) into the script
// a 1940s announcer reads on the air. Every sentence states a reading from the report and
// nothing else; the period flourishes are fixed per condition. No people are ever named.
// WREL Weather, created by Jessica Mosley | LinkedIn: https://www.linkedin.com/in/jessmosley/ | GitHub: https://github.com/j-m-o/
export const CONDITIONS = ["sunny", "partly", "wind", "snow", "fog", "heat", "rain", "storm"];
export const SEVERITY = { sunny: 0, partly: 1, wind: 2, snow: 3, fog: 4, heat: 5, rain: 6, storm: 7 };
export const STATION = "W. R. E. L.";
/** Checks that a report.json has what the broadcast needs. Returns its problems, or an empty list. */
export function checkReport(data) {
    const p = [];
    const o = data;
    if (typeof data !== "object" || data === null)
        return ["report.json must be a JSON object"];
    if (typeof o.asOf !== "string" || Number.isNaN(Date.parse(o.asOf)))
        p.push("asOf must be an ISO time");
    if (!Array.isArray(o.regions) || !o.regions.length)
        return [...p, "regions must be a non-empty list: run the Codebase Weather Report first"];
    o.regions.forEach((r, i) => {
        if (!r || typeof r.id !== "string" || !CONDITIONS.includes(r.condition) || typeof r.readings !== "object") {
            p.push(`regions[${i}] needs an id, a condition and readings`);
        }
    });
    if (!o.counts || typeof o.counts.warnings !== "number")
        p.push("counts are missing");
    return p.slice(0, 3);
}
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
/** "a", "a and b", "a, b and c": lists the way Jessica writes them, with no serial comma. */
export function list(items) {
    if (items.length <= 1)
        return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
function suffix(n) {
    return n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
}
export function spokenDate(iso) {
    const d = new Date(iso);
    const day = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    const month = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
    return `${day}, ${month} ${d.getUTCDate()}${suffix(d.getUTCDate())}`;
}
/** INC-07 becomes "incident number 7" so the announcer reads it naturally. */
export function spokenId(id) {
    const m = /^[A-Za-z]+-?0*(\d+)$/.exec(id);
    return m ? `incident number ${m[1]}` : `incident ${id}`;
}
/** Region ids as spoken: dashes become spaces, so api-gateway reads "api gateway". */
const spoken = (id) => id.replace(/[-_]+/g, " ");
function trendLine(r) {
    if (r.trend.direction === "worsening")
        return ` Conditions there have been worsening for ${plural(r.trend.weeks, "week")}.`;
    if (r.trend.direction === "improving")
        return ` Conditions there have been improving for ${plural(r.trend.weeks, "week")}.`;
    return "";
}
function warning(r) {
    const x = r.readings;
    const name = spoken(r.id);
    switch (r.condition) {
        case "storm": {
            const open = x.openIncidents.map(spokenId);
            const hit = x.weekIncidents.map(spokenId);
            let line = `A storm warning is in effect over ${name}. ` + (open.length
                ? `${list(open).replace(/^./, (c) => c.toUpperCase())} ${open.length === 1 ? "remains" : "remain"} open`
                : `${list(hit).replace(/^./, (c) => c.toUpperCase())} struck this week and has since cleared`);
            line += x.failing ? `, and ${plural(x.failing, "test")} failed this week.` : ".";
            if (x.temperature !== null && x.commits !== null)
                line += ` Temperatures reached ${x.temperature} degrees, with ${plural(x.commits, "commit")}.`;
            return line + trendLine(r);
        }
        case "rain":
            return `Rain over ${name}, where ${plural(x.failing ?? 0, "test is", "tests are")} failing this week.${trendLine(r)}`;
        case "heat":
            return `A heat warning for ${name}: ${plural(x.commits ?? 0, "commit")} this week, against a usual ${Math.round(x.commitsBaseline ?? 0)}. `
                + `Temperatures reached ${x.temperature} degrees.${trendLine(r)}`;
        default:
            return `${r.headline}${trendLine(r)}`;
    }
}
function advisory(r) {
    const x = r.readings;
    const name = spoken(r.id);
    switch (r.condition) {
        case "fog": {
            const before = r.history.at(-2)?.condition === "fog";
            return `Fog ${before ? "persists over" : "has rolled in over"} ${name}, where only ${x.visibility} percent of the code is covered by tests. Proceed with caution.`;
        }
        case "snow":
            return x.daysSinceCommit === null
                ? `And up in ${name}, a deep freeze: no commits on record.`
                : `And up in ${name}, a deep freeze: not one commit in ${x.daysSinceCommit} days.`;
        case "wind":
            return `Gusty winds over ${name}, with ${plural(x.wind ?? 0, "outdated dependency", "outdated dependencies")}.`;
        default:
            return r.headline;
    }
}
const bySeverity = (a, b) => SEVERITY[b.condition] - SEVERITY[a.condition] || (b.readings.temperature ?? 0) - (a.readings.temperature ?? 0) || a.id.localeCompare(b.id);
export function script(report) {
    const { warnings, advisories, fair } = report.counts;
    const segs = [{
            id: "sign-on", kind: "sign-on", regions: [], chime: false,
            text: `Good evening, ladies and gentlemen. This is ${STATION} and here is the weather for the ${report.subject}, `
                + `for the week ending ${spokenDate(report.asOf)}. Tonight: ${plural(warnings, "warning")}, `
                + `${plural(advisories, "advisory", "advisories")} and ${plural(fair, "region")} of fair weather.`,
        }];
    for (const r of report.regions.filter((x) => x.level === "warning").sort(bySeverity)) {
        segs.push({ id: r.id, kind: "warning", regions: [r.id], text: warning(r), chime: r.condition === "storm" });
    }
    for (const r of report.regions.filter((x) => x.level === "advisory").sort(bySeverity)) {
        segs.push({ id: r.id, kind: "advisory", regions: [r.id], text: advisory(r), chime: false });
    }
    const sunny = report.regions.filter((x) => x.condition === "sunny").map((x) => x.id).sort();
    const partly = report.regions.filter((x) => x.condition === "partly").map((x) => x.id).sort();
    if (sunny.length || partly.length) {
        const parts = [];
        if (sunny.length)
            parts.push(`sunny skies over ${list(sunny.map(spoken))}`);
        if (partly.length)
            parts.push(`partly cloudy over ${list(partly.map(spoken))}, where a few flaky tests drift by`);
        const text = `Elsewhere, fair weather: ${parts.join(", and ")}.`;
        segs.push({ id: "fair", kind: "fair", regions: [...sunny, ...partly], text, chime: false });
    }
    const missing = report.missing.length ? ` Tonight's instruments had no reading for ${list(report.missing)}.` : "";
    segs.push({
        id: "sign-off", kind: "sign-off", regions: [], chime: false,
        text: `And that's the weather.${missing} Every word straight from the record. This is ${STATION} wishing you clear skies and green builds. Good night.`,
    });
    return segs;
}
/** The whole script for one recorded read: one paragraph per segment. */
export function readText(segs) {
    return segs.map((s) => s.text).join("\n\n") + "\n";
}
/** A cue sheet for reading it live. */
export function cueSheet(report, segs) {
    const lines = [`# WREL Weather: ${report.subject}`, "", "Read each block. The map lights up the regions named in it.", "",
        "> THEME: let it play a few seconds, then start reading over it as it fades", ""];
    for (const s of segs) {
        if (s.chime)
            lines.push("> CHIME: before the storm warning", "");
        if (s.kind === "sign-off")
            lines.push("> THEME: bring it back in quietly under the sign off", "");
        lines.push(`## ${s.kind === "warning" || s.kind === "advisory" ? `${s.kind[0].toUpperCase()}${s.kind.slice(1)}: ${s.id}` : s.id.replace("-", " ").replace(/^./, (c) => c.toUpperCase())}`, "", s.text, "");
    }
    lines.push("> THEME: up full to play the show out", "");
    return lines.join("\n");
}
