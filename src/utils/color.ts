/**
 * WCAG contrast helpers for data-driven colors (user category colors, fixed
 * accents) that can't be pre-tuned as theme tokens. Semantic theme colors are
 * already AA-tuned in `constants/theme.ts` — use those directly; reach for
 * `readableTextColor` only when the color comes from data.
 */

/** #RRGGBB → [r, g, b] 0–255, or null when not parseable. */
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function channelToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). */
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #RRGGBB colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 21; // unparseable — don't force an adjustment
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * A text-safe variant of `color` against `bg`: keeps hue/saturation and shifts
 * lightness (darker on light backgrounds, lighter on dark ones) just enough to
 * reach the WCAG ratio — AA normal text by default. Returns `color` unchanged
 * when it already passes or is not #RRGGBB.
 */
export function readableTextColor(color: string, bg: string, target = 4.5): string {
  const fg = parseHex(color);
  const bgRgb = parseHex(bg);
  if (!fg || !bgRgb) return color;
  if (contrastRatio(color, bg) >= target) return color;

  const [h, s, l] = rgbToHsl(fg);
  const darkBg = luminance(bgRgb) < 0.5;
  // Binary-search lightness between the current value and the extreme; pick
  // the value closest to the original that still passes.
  let lo = darkBg ? l : 0;
  let hi = darkBg ? 1 : l;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const passes = contrastRatio(hslToHex(h, s, mid), bg) >= target;
    if (darkBg) {
      if (passes) hi = mid;
      else lo = mid;
    } else {
      if (passes) lo = mid;
      else hi = mid;
    }
  }
  const result = hslToHex(h, s, darkBg ? hi : lo);
  // Extremes may still fall short on mid-tone backgrounds — return the extreme.
  return contrastRatio(result, bg) >= target ? result : hslToHex(h, s, darkBg ? 1 : 0);
}
