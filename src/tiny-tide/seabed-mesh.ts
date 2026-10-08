// The far seabed (owner playtest P3). Around the Blender reef mesh (seabed_0: 100 × 100 quads over ±65 physical units) the
// seabed is drawn as nested square rings sampled from seabedHeight, the collision ground. A linear triangle misses the curved
// ground by about .0035 × spacing² (seabedHeight's curvature), so each ring's spacing keeps that within .02 L for the smallest
// stage whose player can reach it (L = 2.43 × size for every starter): stage 1 reaches 200 (spacing 4, ≈ .06 of .19), stage 2
// reaches 800 (8, ≈ .22 of .78) and stage 3 reaches 3200 (24, ≈ 2.0 of 3.1). Past the stage-3 reach the ground is only seen up
// to the edge fade, so it is coarser. Each ring starts on the loop where the one inside it ends (the reef's own boundary for the
// first), so there are no cracks. The geometry is built once; a ring is drawn only at scales where it can be seen.
// At the Big scale (stage 3) the two fine rings would be a fraction of a local unit per quad (final review M1): above
// COARSE_SCALE they are hidden and one coarse ring (spacing 24, the stage-3 spacing) covers the same area, with the reef's boundary
// as its first loop and ring 2's first loop as its last, so it joins both without cracks.
import * as T from 'three';
import { PLAYER_HALF, seabedHeight, WATER_LEVEL } from './biomes';
import { ISLAND, ISLAND_RADIUS, islandLift } from './coast';
import { EDGE_FADE_END } from './edge';

export interface SeabedRing { from: number; to: number; spacing: number }
/** seabed_0 (Blender): the reef mesh's half size and its quads per side. */
export const SEABED_INNER_HALF = 65, SEABED_INNER_SEGMENTS = 100;
/** The edge fade ends here (tier-local units); nothing past it is seen at any stage. */
export const SEABED_VISIBLE = PLAYER_HALF * EDGE_FADE_END;
/** Chebyshev radii and spacings, in physical units. */
export const SEABED_RINGS: readonly SeabedRing[] = [
  { from: SEABED_INNER_HALF, to: 4 * SEABED_VISIBLE, spacing: 4 },
  { from: 4 * SEABED_VISIBLE, to: 16 * SEABED_VISIBLE, spacing: 8 },
  { from: 16 * SEABED_VISIBLE, to: 64 * PLAYER_HALF, spacing: 24 },
  { from: 64 * PLAYER_HALF, to: 64 * SEABED_VISIBLE, spacing: 48 },
];

/** The fine rings (0 and 1) are hidden, and the coarse ring drawn, above this world scale: there the fine spacing (8) is under 1/4 of
 *  a local unit. */
export const SEABED_FINE_RINGS = 2, COARSE_SCALE = 4 * SEABED_RINGS[1]!.spacing;
/** The coarse ring: the area of the fine rings at the stage-3 spacing. */
export const SEABED_COARSE_RING: SeabedRing = { from: SEABED_INNER_HALF, to: SEABED_RINGS[SEABED_FINE_RINGS - 1]!.to, spacing: SEABED_RINGS[SEABED_FINE_RINGS]!.spacing };
/** A ring is drawn when its inside can be seen at this world scale (physical units per render unit) and, for a fine ring, while the
 *  scale is at most COARSE_SCALE. */
export const seabedRingVisible = (r: SeabedRing, scale: number): boolean => r.from < SEABED_VISIBLE * scale && (SEABED_RINGS.indexOf(r) >= SEABED_FINE_RINGS || scale <= COARSE_SCALE);
export const seabedCoarseVisible = (scale: number): boolean => scale > COARSE_SCALE;

/** Loops from `r.from` to `r.to` at spacing `r.spacing`: Chebyshev radius and segments per side. The first loop has `first` segments,
 *  and the last `last` when given. */
function loopsOf(r: SeabedRing, first: number, last?: number): { radius: number; segments: number }[] {
  const steps = Math.ceil((r.to - r.from) / r.spacing), out = [{ radius: r.from, segments: first }];
  for (let j = 1; j <= steps; j++) { const radius = r.from + (r.to - r.from) * j / steps; out.push({ radius, segments: j === steps && last !== undefined ? last : Math.ceil(2 * radius / r.spacing) }); }
  return out;
}
/** The loops of ring `index`. Its first loop has the segments of the loop inside it. */
function loops(index: number): { radius: number; segments: number }[] {
  let first = SEABED_INNER_SEGMENTS;
  for (let i = 0; i < index; i++) first = loops(i).at(-1)!.segments;
  return loopsOf(SEABED_RINGS[index]!, first);
}

const LIGHT = new T.Color('#d6d2ad'), DEEP = new T.Color('#65a1a2'), SAND = new T.Color('#f0dfae'), GRASS = new T.Color('#7fae5a'), scratch = new T.Color();
/** The vertex colour of the Blender seabed (build_assets.py make_terrain), in linear space. The coast's land (coast.ts) is light
 *  sand from just under the waterline and turns to grass from 3 to 12 units above it. */
function seabedColor(x: number, z: number, out: T.Color, y = seabedHeight(x, z)): T.Color {
  const t = Math.max(0, Math.min(1, (Math.abs(x) + Math.abs(z)) / 650 + Math.sin(x * .08) * .09)), ripple = .96 + .04 * Math.sin(x * 3.7 + Math.sin(z * .7));
  out.copy(LIGHT).lerp(DEEP, t);
  if (y > WATER_LEVEL - 8) out.lerp(SAND, Math.min(1, (y - WATER_LEVEL + 8) / 6));
  if (y > WATER_LEVEL + 3) out.lerp(GRASS, Math.min(1, (y - WATER_LEVEL - 3) / 9));
  return out.multiplyScalar(ripple);
}
/** The ground the rings draw: the collision ground without the island, which has its own fine mesh on top (islandGeometry). */
export const ringHeight = (x: number, z: number) => seabedHeight(x, z) - islandLift(x, z);

/** The geometry of ring `index`: positions on seabedHeight, its normals and colours, and triangles that face up. */
export const seabedRingGeometry = (index: number): T.BufferGeometry => loopGeometry(loops(index));
/** The coarse ring's geometry: the reef's boundary inside, ring 2's first loop outside. */
export const seabedCoarseGeometry = (): T.BufferGeometry => loopGeometry(loopsOf(SEABED_COARSE_RING, SEABED_INNER_SEGMENTS, loops(SEABED_FINE_RINGS - 1).at(-1)!.segments));
function loopGeometry(ls: { radius: number; segments: number }[]): T.BufferGeometry {
  const count = ls.reduce((n, l) => n + 4 * l.segments, 0);
  const position = new Float32Array(3 * count), normal = new Float32Array(3 * count), color = new Float32Array(3 * count), starts: number[] = [];
  let v = 0;
  for (const { radius: r, segments: n } of ls) {
    starts.push(v);
    for (let side = 0; side < 4; side++) for (let i = 0; i < n; i++) {
      // The same expression as the Blender mesh ((u − .5) × 2r), so the first loop repeats the reef's boundary points.
      const a = (i / n - .5) * 2 * r, x = [a, r, -a, -r][side]!, z = [-r, a, r, -a][side]!, y = ringHeight(x, z);
      const gx = (ringHeight(x + .5, z) - ringHeight(x - .5, z)), gz = (ringHeight(x, z + .5) - ringHeight(x, z - .5)), k = 1 / Math.hypot(gx, 1, gz);
      seabedColor(x, z, scratch, y);
      position[3 * v] = x; position[3 * v + 1] = y; position[3 * v + 2] = z;
      normal[3 * v] = -gx * k; normal[3 * v + 1] = k; normal[3 * v + 2] = -gz * k;
      color[3 * v] = scratch.r; color[3 * v + 1] = scratch.g; color[3 * v + 2] = scratch.b;
      v++;
    }
  }
  const index3: number[] = [];
  const tri = (a: number, b: number, c: number) => {
    const ux = position[3 * b]! - position[3 * a]!, uz = position[3 * b + 2]! - position[3 * a + 2]!, vx = position[3 * c]! - position[3 * a]!, vz = position[3 * c + 2]! - position[3 * a + 2]!;
    if (uz * vx - ux * vz > 0) index3.push(a, b, c); else index3.push(a, c, b);
  };
  for (let j = 0; j + 1 < ls.length; j++) {
    const A = ls[j]!, B = ls[j + 1]!, a0 = starts[j]!, b0 = starts[j + 1]!;
    const at = (start: number, n: number, side: number, i: number) => start + (side * n + i) % (4 * n);
    for (let side = 0; side < 4; side++) {
      // Zip the two loops along this side by their positions along it.
      let i = 0, k = 0;
      while (i < A.segments || k < B.segments) {
        if (k >= B.segments || (i < A.segments && (i + 1) / A.segments <= (k + 1) / B.segments)) {
          tri(at(a0, A.segments, side, i), at(b0, B.segments, side, k), at(a0, A.segments, side, i + 1)); i++;
        } else { tri(at(a0, A.segments, side, i), at(b0, B.segments, side, k), at(b0, B.segments, side, k + 1)); k++; }
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(position, 3)); g.setAttribute('normal', new T.BufferAttribute(normal, 3)); g.setAttribute('color', new T.BufferAttribute(color, 3));
  g.setIndex(new T.BufferAttribute(new Uint32Array(index3), 1)); g.computeBoundingSphere();
  return g;
}

/** The island (coast.ts): a polar grid out to just past its radius, sampled from the collision ground, drawn over the rings (which
 *  leave the island out, ringHeight) with a polygon offset. Radial steps of 1.25 and 192 spokes keep it within .02 L at every size;
 *  its rim is where the island's lift is zero, so it meets the rings' surface. */
export const ISLAND_SPOKES = 192, ISLAND_STEP = 1.25;
export function islandGeometry(): T.BufferGeometry {
  const rings = Math.ceil((ISLAND_RADIUS + 2) / ISLAND_STEP), n = ISLAND_SPOKES, count = 1 + rings * n;
  const position = new Float32Array(3 * count), normal = new Float32Array(3 * count), color = new Float32Array(3 * count);
  const put = (v: number, x: number, z: number) => {
    const y = seabedHeight(x, z), gx = seabedHeight(x + .25, z) - seabedHeight(x - .25, z), gz = seabedHeight(x, z + .25) - seabedHeight(x, z - .25), k = 1 / Math.hypot(gx * 2, 1, gz * 2);
    seabedColor(x, z, scratch, y);
    position[3 * v] = x; position[3 * v + 1] = y; position[3 * v + 2] = z;
    normal[3 * v] = -gx * 2 * k; normal[3 * v + 1] = k; normal[3 * v + 2] = -gz * 2 * k;
    color[3 * v] = scratch.r; color[3 * v + 1] = scratch.g; color[3 * v + 2] = scratch.b;
  };
  put(0, ISLAND.x, ISLAND.z);
  for (let j = 1; j <= rings; j++) for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, r = j * ISLAND_STEP; put(1 + (j - 1) * n + i, ISLAND.x + Math.cos(a) * r, ISLAND.z + Math.sin(a) * r); }
  const index: number[] = [], at = (j: number, i: number) => j === 0 ? 0 : 1 + (j - 1) * n + (i % n);
  // Counter-clockwise seen from above (+y): with x = cos a, z = sin a, the angle grows clockwise from above, so each triangle goes
  // outward, then back in angle.
  for (let i = 0; i < n; i++) index.push(0, at(1, i + 1), at(1, i));
  for (let j = 1; j < rings; j++) for (let i = 0; i < n; i++) index.push(at(j, i), at(j, i + 1), at(j + 1, i), at(j, i + 1), at(j + 1, i + 1), at(j + 1, i));
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(position, 3)); g.setAttribute('normal', new T.BufferAttribute(normal, 3)); g.setAttribute('color', new T.BufferAttribute(color, 3));
  g.setIndex(new T.BufferAttribute(new Uint32Array(index), 1)); g.computeBoundingSphere();
  return g;
}
