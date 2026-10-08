// The coast (sub-project 2): one island for the size-1 amphibians and a continent for the land plans of sizes 2 and 3.
// Both are smooth lifts added to the base seabed (biomes.ts `seabedHeight` = base + coastLift), so the collision ground, the drawn
// seabed rings and every spawn agree. Each lift is zero outside its own support, and `coastBounds` gives the extra slope and
// curvature only near it: admission keeps the open-sea bounds (and its tight scan) everywhere else.
//
// The island (size 1, physical units): a dome with a sand beach, a shallow shelf for the shore plans, then an underwater cliff.
// It sits in the (−x, −z) corner of the size-1 square, outside the reef mesh (seabed_0, ±65) and the size-0 view (±58).
// The continent (sizes 2 and 3): a straight-ish coast along +x. Its foot is past the size-1 view (232), its waterline inside the
// size-2 reach, and at size 3 it is about 43 % of the square.

/** A profile along one distance: knots [distance, slope] with the slope linear between knots; the last slope is 0. The lift at a
 *  distance is the integral of the slope from there to the last knot (zero past it). */
interface Profile { d: Float64Array; s: Float64Array; tail: Float64Array; end: number; curvature: number; maxSlope: number }
function profile(knots: readonly (readonly [number, number])[]): Profile {
  const n = knots.length, d = new Float64Array(n), s = new Float64Array(n), tail = new Float64Array(n);
  knots.forEach(([a, b], i) => { d[i] = a; s[i] = b; });
  for (let i = n - 2; i >= 0; i--) tail[i] = tail[i + 1]! + (d[i + 1]! - d[i]!) * (s[i]! + s[i + 1]!) / 2;
  let curvature = 0, maxSlope = 0;
  for (let i = 0; i + 1 < n; i++) { curvature = Math.max(curvature, Math.abs(s[i + 1]! - s[i]!) / (d[i + 1]! - d[i]!)); maxSlope = Math.max(maxSlope, s[i]!); }
  return { d, s, tail, end: d[n - 1]!, curvature, maxSlope };
}
/** The largest slope and the largest slope change per unit (curvature) of the profile over distances [a, b]. */
const scratchBounds = { slope: 0, curvature: 0 };
/** Writes into one scratch object (no allocation: admission calls it for every ground scan). */
function boundsIn(p: Profile, a: number, b: number): { slope: number; curvature: number } {
  let slope = 0, curvature = 0;
  for (let i = 0; i + 1 < p.d.length; i++) {
    const d0 = p.d[i]!, d1 = p.d[i + 1]!; if (d1 < a || d0 > b) continue;
    const s0 = p.s[i]!, s1 = p.s[i + 1]!, f0 = Math.max(0, (a - d0) / (d1 - d0)), f1 = Math.min(1, (b - d0) / (d1 - d0));
    slope = Math.max(slope, s0 + (s1 - s0) * f0, s0 + (s1 - s0) * f1); curvature = Math.max(curvature, Math.abs(s1 - s0) / (d1 - d0));
  }
  scratchBounds.slope = slope; scratchBounds.curvature = curvature; return scratchBounds;
}
/** The lift at distance `x` (the integral of the slope from `x` to the end). */
function liftOf(p: Profile, x: number): number {
  if (x >= p.end) return 0;
  if (x <= p.d[0]!) return p.tail[0]! + (p.d[0]! - x) * p.s[0]!;
  let i = 0; while (p.d[i + 1]! < x) i++;
  const d0 = p.d[i]!, d1 = p.d[i + 1]!, s0 = p.s[i]!, s1 = p.s[i + 1]!, f = (x - d0) / (d1 - d0), sx = s0 + (s1 - s0) * f;
  return p.tail[i + 1]! + (d1 - x) * (sx + s1) / 2;
}

/** The open-sea seabed without the coast (the function the reef mesh, seabed_0, was baked from). */
export function baseSeabedHeight(x: number, z: number) {
  return Math.sin(x * .075) * Math.cos(z * .055) * 2.4 + Math.sin((x + z) * .018) * 4.5 + Math.sin(x * .006) * Math.sin(z * .009) * 13;
}
const COAST_WATER = 85;   // WATER_LEVEL (biomes.ts imports this module)

// ---- the island ----
export const ISLAND = { x: -130, z: -130, top: COAST_WATER + 6 } as const;
/** Inside to outside: dome, beach (the waterline is near r 25), shallow shelf, then the cliff. The cliff's straight part is sized so
 *  the top stands ISLAND.top over the base seabed at the centre. */
const ISLAND_HEAD: [number, number][] = [[0, 0], [10, .2], [26, .3], [34, .4], [50, 2.5]];
const ISLAND_BEND = 16.7;   // the cliff's foot: 2.5 → 0 (curvature .15)
const islandProfile = (() => {
  const head = profile([...ISLAND_HEAD, [50 + ISLAND_BEND, 0]]);
  const need = ISLAND.top - baseSeabedHeight(ISLAND.x, ISLAND.z), straight = Math.max(0, (need - head.tail[0]!) / 2.5);
  return profile([...ISLAND_HEAD, [50 + straight, 2.5], [50 + straight + ISLAND_BEND, 0]]);
})();
/** The island's outer radius (where its lift ends) and its dry radius (about: the waterline moves with the base seabed). */
export const ISLAND_RADIUS = islandProfile.end;
export const ISLAND_DRY_RADIUS = 25;
export const islandLift = (x: number, z: number) => {
  const dx = x - ISLAND.x, dz = z - ISLAND.z; if (Math.abs(dx) >= ISLAND_RADIUS || Math.abs(dz) >= ISLAND_RADIUS) return 0;
  const r = Math.sqrt(dx * dx + dz * dz); return r >= ISLAND_RADIUS ? 0 : liftOf(islandProfile, r);
};

// ---- the continent ----
/** The continent's foot (where its lift starts) is the line x = footX(z); its lift grows with the distance inland from it. */
const footX = (z: number) => 300 + 45 * Math.sin(z / 280 + 1);
export const CONTINENT_FOOT_MIN = 255;
/** Foot to the coast plateau: up at slope .6 (curvature .012 at the bends) to about 110 units; then a gentle rise (slope .1) of about
 *  45 more over 450 units inland, so the interior stands well over the sea for the largest walkers' ground margins. */
const continentProfile = (() => {
  const bend = 50, straight = (110 - .6 * bend - .35 * bend) / .6, a = bend + straight, b = a + bend;
  return profile([[0, 0], [bend, .6], [a, .6], [b, .1], [b + 400, .1], [b + 450, 0]]);
})();
const CONTINENT_RISE = continentProfile.tail[0]!;
/** The lift at a distance inland from the foot: the integral of the slope from the foot to there. */
const continentLiftAt = (inland: number) => inland <= 0 ? 0 : CONTINENT_RISE - liftOf(continentProfile, inland);
const continentLift = (x: number, z: number) => x <= CONTINENT_FOOT_MIN ? 0 : continentLiftAt(x - footX(z));

/** The coast's lift over the base seabed at a physical position. */
export function coastLift(x: number, z: number): number { return islandLift(x, z) + continentLift(x, z); }

/** Extra slope and curvature bounds of the coast inside the disc (x, z, reach), from the part of each profile the disc covers: zero
 *  where no lift can be. The island's ring term (slope / radius) is added to its curvature; the continent's slope grows by
 *  |∇ footX| ≤ 45/280 and its curvature by the footline's bend (45/280² × the slope). */
export const ISLAND_SLOPE = islandProfile.maxSlope, CONTINENT_SLOPE = .6 * Math.hypot(1, 45 / 280);
const FOOT_GRAD = 45 / 280, FOOT_BEND = 45 / 280 ** 2;
export function coastBounds(x: number, z: number, reach: number, out: { slope: number; curvature: number }): { slope: number; curvature: number } {
  out.slope = 0; out.curvature = 0;
  const dx = x - ISLAND.x, dz = z - ISLAND.z, r = Math.sqrt(dx * dx + dz * dz);   // Math.sqrt: Math.hypot allocated in this hot path
  if (r < ISLAND_RADIUS + reach) {
    const lo = Math.max(0, r - reach), b = boundsIn(islandProfile, lo, r + reach);
    out.slope += b.slope; out.curvature += b.curvature + (lo > 1 ? b.slope / lo : islandProfile.s[1]! / islandProfile.d[1]!);
  }
  if (x + reach > CONTINENT_FOOT_MIN) {
    // The distance inland varies by at most reach × (1 + FOOT_GRAD) across the disc, plus the footline's own swing.
    const d = x - footX(z), spread = reach * (1 + FOOT_GRAD), b = boundsIn(continentProfile, d - spread, d + spread);
    out.slope += b.slope * Math.hypot(1, FOOT_GRAD); out.curvature += b.curvature * (1 + FOOT_GRAD ** 2) + b.slope * FOOT_BEND;
  }
  return out;
}

/** Which landmass a position belongs to (for land spawns and start points), or null in open sea. */
export function landmassAt(x: number, z: number): 'island' | 'continent' | null {
  if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND_RADIUS) return 'island';
  return x > CONTINENT_FOOT_MIN ? 'continent' : null;
}
/** A start point on the dry land of a landmass (physical x, z): the island's beach facing the world centre, or the continent's
 *  shore `inland` units inland from the waterline on the z = 0 line. */
export function landStart(landmass: 'island' | 'continent', inland = 60): { x: number; z: number } {
  if (landmass === 'island') { const k = 14 / Math.hypot(ISLAND.x, ISLAND.z); return { x: ISLAND.x - ISLAND.x * k, z: ISLAND.z - ISLAND.z * k }; }
  let x = CONTINENT_FOOT_MIN; while (baseSeabedHeight(x, 0) + coastLift(x, 0) < COAST_WATER) x += 2;
  return { x: x + inland, z: 0 };
}
