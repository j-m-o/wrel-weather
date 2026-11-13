// The eight weather icons, flat with navy outlines, in Jessica's illustration style.
// Shared with the Codebase Weather Report so the map looks the same in both.
// WREL Weather, created by Jessica Mosley | LinkedIn: https://www.linkedin.com/in/jessmosley/ | GitHub: https://github.com/j-m-o/
export const C = {
    navy: "#1B2F5E", soft: "#3A4E7A", sky: "#DCEBF8", paper: "#F4F8FC", gold: "#F6B94B",
    purple: "#8E7BC9", coral: "#F4846B", mint: "#7CCBB0", blue: "#5B93CF", page: "#A9CBEB",
};
export const TILE = {
    sunny: "#FCE7B8", partly: C.sky, fog: "#C9D3E6", rain: "#FBD3C8",
    storm: "#CFC6EC", snow: "#FFFFFF", heat: "#F9C4A6", wind: "#CDEBDF",
};
const N = C.navy;
const f = (n) => n.toFixed(1);
function cloud(x, y, s = 1, fill = "#FFFFFF") {
    return `<path transform="translate(${x},${y}) scale(${s})" d="M-26 14 H26 A14 14 0 0 0 24 -14 A20 20 0 0 0 -12 -18 A16 16 0 0 0 -26 14 Z" fill="${fill}" stroke="${N}" stroke-width="${f(3.5 / s)}" stroke-linejoin="round"/>`;
}
function sun(x, y, r = 15, fill = C.gold) {
    const rays = Array.from({ length: 8 }, (_, k) => {
        const a = (k * Math.PI) / 4;
        return `<line x1="${f(x + Math.cos(a) * (r + 5))}" y1="${f(y + Math.sin(a) * (r + 5))}" x2="${f(x + Math.cos(a) * (r + 12))}" y2="${f(y + Math.sin(a) * (r + 12))}"/>`;
    }).join("");
    return `<g stroke="${N}" stroke-width="3.5" stroke-linecap="round">${rays}</g><circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${N}" stroke-width="3.5"/>`;
}
/** An icon centred on (x, y), drawn about 64 px across at scale 1. */
export function icon(kind, x = 0, y = 0, s = 1) {
    let g = "";
    switch (kind) {
        case "sunny":
            g = sun(0, 0, 16);
            break;
        case "partly":
            g = sun(10, -10, 12) + cloud(-4, 8, 0.85);
            break;
        case "fog":
            g = cloud(0, -6, 0.8) + [[-4, 18], [6, 27]].map(([o, yy]) => `<line x1="${-24 + o}" y1="${yy}" x2="${24 + o}" y2="${yy}" stroke="${N}" stroke-width="3.5" stroke-linecap="round"/>`).join("");
            break;
        case "rain":
            g = cloud(0, -6, 0.85) + [-12, 0, 12].map((dx) => `<line x1="${dx}" y1="16" x2="${dx - 5}" y2="28" stroke="${C.blue}" stroke-width="4" stroke-linecap="round"/>`).join("");
            break;
        case "storm":
            g = cloud(0, -8, 0.9, C.purple) +
                `<path d="M2 6 L-8 22 H1 L-4 34 L12 15 H3 L8 6 Z" fill="${C.gold}" stroke="${N}" stroke-width="3" stroke-linejoin="round"/>`;
            break;
        case "snow":
            g = [0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => `<line x1="${f(-18 * Math.cos(a))}" y1="${f(-18 * Math.sin(a))}" x2="${f(18 * Math.cos(a))}" y2="${f(18 * Math.sin(a))}" stroke="${C.blue}" stroke-width="4" stroke-linecap="round"/>`).join("")
                + `<circle r="5" fill="#FFFFFF" stroke="${N}" stroke-width="3"/>`;
            break;
        case "heat":
            g = sun(0, -6, 15, C.coral) + [-14, 0, 14].map((dx) => `<path d="M${dx} 26 q4 -4 0 -8 q-4 -4 0 -8" fill="none" stroke="${C.coral}" stroke-width="3.5" stroke-linecap="round"/>`).join("");
            break;
        case "wind":
            g = [[-6, 14], [6, 20], [18, 6]].map(([yy, ln]) => `<path d="M-24 ${yy} H${ln} a7 7 0 1 0 -7 -7" fill="none" stroke="${N}" stroke-width="3.5" stroke-linecap="round"/>`).join("");
            break;
    }
    return `<g transform="translate(${x},${y}) scale(${s})">${g}</g>`;
}
/** A standalone icon as an inline SVG element. */
export function iconSvg(kind, size = 64, label) {
    const a11y = label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`;
    return `<svg width="${size}" height="${size}" viewBox="-40 -38 80 80" ${a11y}>${icon(kind)}</svg>`;
}
export function hexPath(cx, cy, r) {
    return "M" + [-30, 30, 90, 150, 210, 270]
        .map((d) => `${f(cx + r * Math.cos((d * Math.PI) / 180))} ${f(cy + r * Math.sin((d * Math.PI) / 180))}`)
        .join(" L") + " Z";
}
