// Land scenery on the coast's continent (owner, 2026-10-08: "the continental landmass looks quite empty"): pine forests, villages
// and boulders. Decoration only, sized for the size-3 giants that walk through them (no solids). Placement is pure and seeded; the
// geometry is low-poly and vertex-coloured, merged into a few chunks so a phone draws little of it (about 40 000 triangles in all).
import * as T from 'three';
import { random, seabedHeight, WATER_LEVEL } from './biomes';
import { CONTINENT_FOOT_MIN } from './coast';

export interface Pine { x: number; y: number; z: number; height: number; radius: number; tint: number }
export interface Cottage { x: number; y: number; z: number; width: number; depth: number; height: number; yaw: number; roof: number }
export interface Boulder { x: number; y: number; z: number; size: number; yaw: number; squash: number }
export interface LandScenery { pines: Pine[]; cottages: Cottage[]; boulders: Boulder[] }

/** Scenery stands on dry land at least this far over the water, inside this square (the size-3 view: 64 × 50 × 1.16). */
export const LAND_MARGIN = 3, LAND_HALF = 3712;
/** The size-2 square (±800 physical, with a margin) stays clear: there the scenery would tower over the Strider and hide it. */
export const SIZE2_CLEAR = 860;
const dry = (x: number, z: number) => seabedHeight(x, z) > WATER_LEVEL + LAND_MARGIN && Math.max(Math.abs(x), Math.abs(z)) > SIZE2_CLEAR;

export function placeLand(seed: number): LandScenery {
  const rand = random(seed * 613 + 4099), out: LandScenery = { pines: [], cottages: [], boulders: [] };
  const span = LAND_HALF - CONTINENT_FOOT_MIN, at = () => ({ x: CONTINENT_FOOT_MIN + rand() * span, z: (rand() * 2 - 1) * LAND_HALF });
  // Forests: clusters of 8 to 20 pines.
  for (let k = 0; k < 70; k++) {
    const c = at(), count = 8 + Math.floor(rand() * 13), spread = 60 + rand() * 120;
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, r = spread * Math.sqrt(rand()), x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (!dry(x, z)) continue;
      const height = 45 + rand() * 55;
      out.pines.push({ x, y: seabedHeight(x, z) - 2, z, height, radius: height * (.26 + rand() * .08), tint: rand() });
    }
  }
  // Lone pines.
  for (let i = 0; i < 260; i++) { const { x, z } = at(); if (!dry(x, z)) continue; const height = 40 + rand() * 50; out.pines.push({ x, y: seabedHeight(x, z) - 2, z, height, radius: height * .28, tint: rand() }); }
  // Villages: 4 to 9 cottages, the first ones near the coast.
  for (let k = 0; k < 16; k++) {
    let c = at();
    if (k < 8) { const z = (rand() * 2 - 1) * LAND_HALF; let x = CONTINENT_FOOT_MIN; while (x < LAND_HALF && !dry(x, z)) x += 8; c = { x: x + 40 + rand() * 120, z }; }
    const count = 4 + Math.floor(rand() * 6), yaw = rand() * Math.PI;
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, r = 20 + rand() * 70, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (!dry(x, z)) continue;
      out.cottages.push({ x, y: seabedHeight(x, z) - 1, z, width: 16 + rand() * 10, depth: 12 + rand() * 8, height: 10 + rand() * 6, yaw: yaw + (rand() - .5) * .6, roof: rand() });
    }
  }
  // Boulders, low so a giant steps over them.
  for (let i = 0; i < 240; i++) { const { x, z } = at(); if (!dry(x, z)) continue; out.boulders.push({ x, y: seabedHeight(x, z) - 3, z, size: 10 + rand() * 22, yaw: rand() * Math.PI * 2, squash: .45 + rand() * .3 }); }
  return out;
}

const C = (hex: string) => new T.Color(hex).convertSRGBToLinear();
const NEEDLES = [C('#3f7a4a'), C('#4f8f52'), C('#5d9a4f'), C('#356b45')], TRUNK = C('#7a5a3a'), WALL = C('#f2e3c4');
const ROOFS = [C('#c9573f'), C('#b8483a'), C('#d97a4a'), C('#8c5a7a')], STONE = C('#8d8f8a');

/** Vertex-coloured, flat-shaded triangles. */
class Builder {
  pos: number[] = []; col: number[] = [];
  tri(a: T.Vector3, b: T.Vector3, c: T.Vector3, color: T.Color) { for (const p of [a, b, c]) { this.pos.push(p.x, p.y, p.z); this.col.push(color.r, color.g, color.b); } }
  /** A cone or a prism ring from (y0, r0) to (y1, r1) around (x, z), `n` sides, rotated by `yaw`. r1 = 0 is a cone. */
  ring(x: number, z: number, y0: number, r0: number, y1: number, r1: number, n: number, yaw: number, color: T.Color) {
    for (let i = 0; i < n; i++) {
      const a0 = yaw + i / n * Math.PI * 2, a1 = yaw + (i + 1) / n * Math.PI * 2;
      const p = (a: number, r: number, y: number) => new T.Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      this.tri(p(a0, r0, y0), p(a1, r1, y1), p(a1, r0, y0), color);
      if (r1 > 0) this.tri(p(a0, r0, y0), p(a0, r1, y1), p(a1, r1, y1), color);
    }
  }
  geometry(): T.BufferGeometry {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }
}
function pine(b: Builder, p: Pine) {
  const needles = NEEDLES[Math.floor(p.tint * NEEDLES.length)]!, trunk = p.height * .22, r = p.radius;
  b.ring(p.x, p.z, p.y, r * .14, p.y + trunk + 2, r * .12, 5, p.tint * 6, TRUNK);
  b.ring(p.x, p.z, p.y + trunk, r, p.y + trunk + p.height * .55, 0, 7, p.tint * 3, needles);
  b.ring(p.x, p.z, p.y + trunk + p.height * .3, r * .72, p.y + p.height, 0, 7, p.tint * 3 + .4, needles);
}
function cottage(b: Builder, h: Cottage) {
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw), w = h.width / 2, d = h.depth / 2, top = h.y + h.height, ridge = top + h.height * .7;
  const P = (u: number, v: number, y: number) => new T.Vector3(h.x + u * c - v * s, y, h.z + u * s + v * c);
  const roof = ROOFS[Math.floor(h.roof * ROOFS.length)]!;
  const quad = (a: T.Vector3, b2: T.Vector3, c2: T.Vector3, d2: T.Vector3, color: T.Color) => { b.tri(a, b2, c2, color); b.tri(a, c2, d2, color); };
  const corners: [number, number][] = [[-w, -d], [w, -d], [w, d], [-w, d]];
  for (let i = 0; i < 4; i++) { const [u0, v0] = corners[i]!, [u1, v1] = corners[(i + 1) % 4]!; quad(P(u0, v0, h.y), P(u0, v0, top), P(u1, v1, top), P(u1, v1, h.y), WALL); }
  // Gable roof along u, with the overhang.
  const o = 1.15;
  quad(P(-w * o, -d * o, top), P(-w * o, 0, ridge), P(w * o, 0, ridge), P(w * o, -d * o, top), roof);
  quad(P(w * o, d * o, top), P(w * o, 0, ridge), P(-w * o, 0, ridge), P(-w * o, d * o, top), roof);
  b.tri(P(-w, -d, top), P(-w, d, top), P(-w, 0, ridge), WALL); b.tri(P(w, d, top), P(w, -d, top), P(w, 0, ridge), WALL);
}
function boulder(b: Builder, r: Boulder) {
  // A squashed, jittered octahedron with a split middle ring (12 triangles... 16 with the ring).
  const n = 6, y = r.y, top = y + r.size * r.squash * 1.6, mid = y + r.size * r.squash * .7;
  const ring = Array.from({ length: n }, (_, i) => { const a = r.yaw + i / n * Math.PI * 2, k = .8 + .4 * Math.abs(Math.sin(i * 2.3 + r.yaw)); return new T.Vector3(r.x + Math.cos(a) * r.size * k, mid, r.z + Math.sin(a) * r.size * k); });
  const apex = new T.Vector3(r.x, top, r.z), base = new T.Vector3(r.x, y, r.z);
  for (let i = 0; i < n; i++) { const a = ring[i]!, c = ring[(i + 1) % n]!; b.tri(a, apex, c, STONE); b.tri(a, c, base, STONE); }
}
/** The scenery as meshes of one shared material, chunked on a grid of `cell` physical units for frustum culling. */
export function landMeshes(scenery: LandScenery, material: T.Material, cell = 900): T.Mesh[] {
  const chunks = new Map<string, Builder>(), chunk = (x: number, z: number) => { const key = `${Math.floor(x / cell)}:${Math.floor(z / cell)}`; let b = chunks.get(key); if (!b) { b = new Builder(); chunks.set(key, b); } return b; };
  for (const p of scenery.pines) pine(chunk(p.x, p.z), p);
  for (const h of scenery.cottages) cottage(chunk(h.x, h.z), h);
  for (const r of scenery.boulders) boulder(chunk(r.x, r.z), r);
  return [...chunks.values()].map(b => { const m = new T.Mesh(b.geometry(), material); m.name = 'Land scenery'; return m; });
}
