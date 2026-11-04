/**
 * Colour difference, ported line for line from backend/color_science.py so
 * the browser and the server agree to the last decimal. Keep them in step.
 */

export type Lab = [number, number, number];

// sRGB D65 reference white.
const XN = 95.047;
const YN = 100.0;
const ZN = 108.883;

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

/** sRGB hex to CIELAB (L 0 to 100). */
export function hexToLab(hex: string): Lab {
  const [r, g, b] = hexToRgb(hex).map((c) => toLinear(c / 255));
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) * 100;
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) * 100;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) * 100;
  const fx = f(x / XN);
  const fy = f(y / YN);
  const fz = f(z / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const mod360 = (d: number) => ((d % 360) + 360) % 360;

/** CIEDE2000. Under 1 is invisible, 1 to 2.3 very close, over 10 a different colour. */
export function deltaE2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = a1p || b1 ? mod360(deg(Math.atan2(b1, a1p))) : 0;
  const h2p = a2p || b2 ? mod360(deg(Math.atan2(b2, a2p))) : 0;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));

  const Lpbar = (L1 + L2) / 2;
  const Cpbar = (C1p + C2p) / 2;
  let hpbar: number;
  if (C1p * C2p === 0) hpbar = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hpbar = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hpbar = (h1p + h2p + 360) / 2;
  else hpbar = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(rad(hpbar - 30)) +
    0.24 * Math.cos(rad(2 * hpbar)) +
    0.32 * Math.cos(rad(3 * hpbar + 6)) -
    0.2 * Math.cos(rad(4 * hpbar - 63));
  const dTheta = 30 * Math.exp(-(((hpbar - 275) / 25) ** 2));
  const Cpbar7 = Cpbar ** 7;
  const RC = 2 * Math.sqrt(Cpbar7 / (Cpbar7 + 25 ** 7));
  const RT = -RC * Math.sin(rad(2 * dTheta));
  const LsqTerm = (Lpbar - 50) ** 2;
  const SL = 1 + (0.015 * LsqTerm) / Math.sqrt(20 + LsqTerm);
  const SC = 1 + 0.045 * Cpbar;
  const SH = 1 + 0.015 * Cpbar * T;

  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

export function deltaEHex(a: string, b: string): number {
  return deltaE2000(hexToLab(a), hexToLab(b));
}

/** Same bands as describe_delta_e in the backend. */
export function describeDeltaE(d: number): string {
  if (d < 1) return "indistinguishable";
  if (d < 2.3) return "very close";
  if (d < 5) return "close";
  if (d < 10) return "noticeably different";
  return "clearly different";
}
