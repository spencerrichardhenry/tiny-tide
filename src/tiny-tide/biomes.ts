import { coastLift, CONTINENT_FOOT_MIN, ISLAND, ISLAND_RADIUS, landmassAt } from './coast';
import { EDGE_REACH, EDGE_SOFT_START } from './edge';
import { APPENDED_FROM, SPECIES, tierSpecies, type FoodKind, type Species } from './species';

// Physical sizes in one persistent world. The camera stays close while the
// entire habitat shrinks continuously as the creature grows.
export const SIZES = [1, 4, 16, 64, 256] as const;
export const WATER_LEVEL = 85;
/** The play camera follows this much farther at sizes 0 and 1 (owner 2026-10-03: more of the fight is in view). Sizes 2 to 4: 1. */
export const EARLY_FOLLOW_SCALE = 1.2;
/** `override`: the QA follow scale (`?qaFollowScale=<n>`), else null. */
export const followScaleTarget = (stage: number, override: number | null = null) => override ?? (stage <= 1 ? EARLY_FOLLOW_SCALE : 1);
/** The play camera's follow distance (render units): 9 (10.5 on a portrait screen, aspect < .8) times the size's scale. */
export const followDistance = (aspect: number, scale: number) => (aspect < .8 ? 10.5 : 9) * scale;
/** Eases the follow scale toward `target` (a size change moves the camera smoothly, about 3 s). */
export const followScaleStep = (current: number, target: number, dt: number) => target + (current - target) * Math.exp(-1.5 * dt);
/** The player's hard bound (admission), in tier-local units. A soft current pushes back before it (edge.ts). */
export const PLAYER_HALF = 50;
/** Food and creatures roam (and flee and hunt) inside this square, in tier-local units: the edge's reach bound (44). */
export const WORLD_HALF = EDGE_REACH * PLAYER_HALF;
/** New food and creatures are placed inside this square (tier-local), outside the edge's push zone. */
export const SPAWN_HALF = EDGE_SOFT_START * PLAYER_HALF;
/** The collision ground (physical units): the open-sea seabed plus the coast's island and continent (coast.ts). A hot path (every ground
 *  sample of every admission): the open-sea formula is written out here, as baseSeabedHeight, and the coast code runs only near land. */
const ISLAND_X = ISLAND.x, ISLAND_Z = ISLAND.z, ISLAND_R = ISLAND_RADIUS, FOOT = CONTINENT_FOOT_MIN;
export function seabedHeight(x: number, z: number) {
  const b = Math.sin(x * .075) * Math.cos(z * .055) * 2.4 + Math.sin((x + z) * .018) * 4.5 + Math.sin(x * .006) * Math.sin(z * .009) * 13;
  if (x <= FOOT && (x - ISLAND_X >= ISLAND_R || ISLAND_X - x >= ISLAND_R || z - ISLAND_Z >= ISLAND_R || ISLAND_Z - z >= ISLAND_R)) return b;
  return b + coastLift(x, z);
}
export function random(seed: number): () => number {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export type Decor = 'coral' | 'kelp' | 'rock' | 'sand';
export interface BiomeType { name: string; weights: Partial<Record<FoodKind, number>>; decor: Decor; tint: string }
export interface Biome extends BiomeType { tier: number; x: number; z: number }
const TYPES: readonly (readonly BiomeType[])[] = [
  [{ name: 'Sprout meadow', weights: { plant: 3, lettuce: 2, spiny_snail: 1 }, decor: 'kelp', tint: '#2f8a7c' },
   { name: 'Copepod cloud', weights: { copepod: 4, drifter: 2 }, decor: 'sand', tint: '#2b7f93' },
   { name: 'Wormy sands', weights: { worm: 4, plant: .5, spiny_snail: 2 }, decor: 'sand', tint: '#3b7f86' },
   { name: 'Grape garden', weights: { seagrape: 3, kelp_snack: 2, drifter: 1 }, decor: 'coral', tint: '#2e7a8c' }],
  [{ name: 'Coral garden', weights: { seagrape: 2, shrimp: 2, sardine: 2, puffer: 1 }, decor: 'coral', tint: '#2a7e8e' },
   { name: 'Jelly drift', weights: { jellyfish: 4, puffer: 1 }, decor: 'sand', tint: '#30708f' },
   { name: 'Crab flats', weights: { crab: 4, snail: 2 }, decor: 'rock', tint: '#3a7a80' },
   { name: 'Lettuce beds', weights: { lettuce: 4, sardine: 1 }, decor: 'kelp', tint: '#2f8577' }],
  [{ name: 'Kelp forest', weights: { kelp_snack: 4, fish: 1.5 }, decor: 'kelp', tint: '#2a7a6c' },
   { name: 'Open blue', weights: { fish: 3, bird: 2 }, decor: 'sand', tint: '#246f92' },
   { name: 'Squid deep', weights: { squid: 4, eel: 1 }, decor: 'rock', tint: '#22587a' },
   { name: 'Ray shallows', weights: { ray: 4, plant: 2, eel: 1 }, decor: 'coral', tint: '#2f8790' }],
  [{ name: 'Island chain', weights: { tree: 3, lighthouse: 3 }, decor: 'sand', tint: '#88bbcb' },
   { name: 'Shipping lane', weights: { boat: 4 }, decor: 'sand', tint: '#80b4c9' },
   { name: 'Sky road', weights: { plane: 3, balloon: 3 }, decor: 'sand', tint: '#93c2d6' }],
  [{ name: 'Inner system', weights: {}, decor: 'sand', tint: '#141a36' },
   { name: 'Outer dark', weights: {}, decor: 'sand', tint: '#10142c' }],
];
export const BIOME_TYPES = TYPES;

/** Seeded biome centers, in tier-local units. Each run has its own layout. */
export function makeBiomes(seed: number, tier: number): Biome[] {
  const rand = random(seed * 31 + tier * 977 + 5);
  const types = TYPES[tier]!, count = types.length + 1 + Math.floor(rand() * 2), start = Math.floor(rand() * types.length);
  const offset = rand() * Math.PI * 2;
  return Array.from({ length: count }, (_, i) => {
    const type = types[(start + i) % types.length]!, a = offset + i / count * Math.PI * 2 + (rand() - .5) * .6, r = 12 + rand() * 26;
    return { ...type, tier, x: Math.cos(a) * r, z: Math.sin(a) * r };
  });
}
export function biomeAt(biomes: readonly Biome[], x: number, z: number): Biome {
  let best = biomes[0]!, distance = Infinity;
  for (const biome of biomes) { const d = (biome.x - x) ** 2 + (biome.z - z) ** 2; if (d < distance) { distance = d; best = biome; } }
  return best;
}

/** The physical height of a species at a physical position. */
export function spawnHeight(spec: Species, x: number, z: number, rand: () => number): number {
  const ground = seabedHeight(x, z), size = SIZES[spec.tier]!;
  switch (spec.kind) {
    case 'copepod': return ground + .6 + rand() * 1.8;
    case 'drifter': return ground + .6 + rand() * 1.6;
    case 'spiny_snail': return ground + 1;
    case 'worm': return ground + .1;
    case 'shrimp': return Math.max(ground + 3, 5 + rand() * 13);
    // Review R14(2) and the T18 review I1: low enough that a size-1 crawler's level Bite cone reaches them from the seabed (tier units above
    // the seabed). Measured: the crawler starter's Bite reaches a puffer origin up to 1.8–2.4 S above the seabed, so puffers spawn at .8–1.6 S.
    case 'puffer': return ground + (.8 + .8 * rand()) * size;
    case 'sardine': return ground + (1.25 + 1.25 * rand()) * size;
    case 'crab': case 'snail': return ground + 1;
    case 'jellyfish': return 12 + rand() * 24;
    case 'ray': return ground + 6;
    case 'fish': case 'squid': return 22 + rand() * 40;
    case 'bird': return WATER_LEVEL + 20 + rand() * 16;
    case 'boat': return WATER_LEVEL + 4;
    // On its own little island (world.ts draws one), or on the coast's dry land.
    case 'tree': case 'lighthouse': return ground < WATER_LEVEL - 1 ? WATER_LEVEL + 8 : ground + .5;
    case 'grove': return ground + .5;
    case 'plane': return WATER_LEVEL + 170 + rand() * 76;
    case 'balloon': return WATER_LEVEL + 220 + rand() * 80;
    case 'planet': return 650 + rand() * 690;
    default: return ground + .15 * size;
  }
}
/** A physical position for one creature of a species, biased toward its biomes. `blocked` (physical position) rejects a point, for
 *  example one inside a reef solid (owner playtest P4); the last fallback is not checked (installation recovers it). */
/** True when a spawn fits the coast (coast.ts): land food on the dry land of its landmass; sea life where the water is deep enough
 *  for it; flyers clear of the land; boats afloat. The open sea (no coast lift) always fits. */
export function coastFits(spec: Species, x: number, y: number, z: number): boolean {
  const size = SIZES[spec.tier]!, ground = seabedHeight(x, z);
  if (spec.zone) return landmassAt(x, z) === spec.zone && ground > WATER_LEVEL + .2 * size;
  if (spec.tier >= 4 || coastLift(x, z) === 0) return true;
  switch (spec.habitatProfileId) {
    case 'sp-prop': return true;
    case 'sp-air': return y > ground + 4 * size;
    case 'sp-surface': return ground < WATER_LEVEL - 10;
    // Sea life also keeps off the coast's steep flanks, where a seabed walker could not reach it.
    default: return ground < WATER_LEVEL - Math.min(1.5 * size, 10) && y < WATER_LEVEL - .5 * size && y > ground &&
      Math.hypot(seabedHeight(x + 1, z) - seabedHeight(x - 1, z), seabedHeight(x, z + 1) - seabedHeight(x, z - 1)) / 2 < .9;
  }
}
/** A point on the dry land of a land food's landmass (physical), inside the spawn square; null after 200 tries. */
function landPoint(spec: Species, rand: () => number, avoid?: { x: number; z: number; radius: number }) {
  const size = SIZES[spec.tier]!, half = SPAWN_HALF * size;
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = spec.zone === 'island' ? ISLAND.x + (rand() * 2 - 1) * ISLAND_RADIUS : CONTINENT_FOOT_MIN + rand() * (half - CONTINENT_FOOT_MIN);
    const z = spec.zone === 'island' ? ISLAND.z + (rand() * 2 - 1) * ISLAND_RADIUS : (rand() * 2 - 1) * half;
    if (Math.max(Math.abs(x), Math.abs(z)) > half || (avoid && Math.hypot(x - avoid.x, z - avoid.z) < avoid.radius)) continue;
    const y = spawnHeight(spec, x, z, rand);
    if (coastFits(spec, x, y, z)) return { x, y, z };
  }
  return null;
}
export function spawnPoint(spec: Species, biomes: readonly Biome[], rand: () => number, avoid?: { x: number; z: number; radius: number }, blocked?: (x: number, y: number, z: number) => boolean) {
  if (spec.zone) { const p = landPoint(spec, rand, avoid); if (p) return p; }
  const size = SIZES[spec.tier]!, best = Math.max(1, ...biomes.map(b => b.weights[spec.kind] ?? 1));
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = (rand() * 2 - 1) * SPAWN_HALF, z = (rand() * 2 - 1) * SPAWN_HALF;
    if (Math.hypot(x, z) < 4) continue;
    if (avoid && Math.hypot(x * size - avoid.x, z * size - avoid.z) < avoid.radius) continue;
    const weight = biomeAt(biomes, x, z).weights[spec.kind] ?? 1;
    if (attempt < 59 && rand() * best > weight) continue;
    const y = spawnHeight(spec, x * size, z * size, rand);
    if (blocked && blocked(x * size, y, z * size)) continue;
    return { x: x * size, y, z: z * size };
  }
  // The last fallback is on the −x axis: open sea at every size (the continent is toward +x, the island off the axis).
  return { x: -SPAWN_HALF * size * .8, y: spawnHeight(spec, 0, 0, rand), z: 0 };
}
export interface Spawn { id: number; spec: Species; x: number; y: number; z: number; phase: number }
/** The opening population of every tier. The ids are stable for a seed. A point that `blocked(tier, x, y, z)` rejects (a reef solid,
 *  owner playtest P4) is replaced by a spawnPoint search with its own RNG, so every other spawn of the seed stays where it was. */
export function populate(seed: number, blocked?: (tier: number, x: number, y: number, z: number) => boolean): Spawn[] {
  // `legacy`: the spawn's id before the combat rows were appended (T16). A reef-blocked spawn's own RNG is seeded with it, so the rows
  // appended after every legacy row (which shift the ids of the higher tiers) move no legacy spawn.
  const out: Spawn[] = []; let id = 0, legacy = 0;
  for (let tier = 0; tier < SIZES.length; tier++) {
    const rand = random(seed * 7 + tier * 119 + 8721), biomes = makeBiomes(seed, tier), block = (x: number, y: number, z: number) => !!blocked?.(tier, x, y, z);
    const firsts = new Set<string>();
    for (const spec of tierSpecies(tier).filter(x => !x.zone)) for (let i = 0; i < spec.count; i++) {
      let point = spec.kind === 'planet' ? planetPoint(i, rand) : spawnPoint(spec, biomes, rand);
      const key = SPECIES.indexOf(spec) < APPENDED_FROM ? legacy++ : 100_000 + id;
      // A spawn the coast does not fit (coast.ts) moves the same way, so every other spawn of the seed stays where it was.
      const fits = (x: number, y: number, z: number) => !block(x, y, z) && coastFits(spec, x, y, z);
      if (spec.kind !== 'planet' && !fits(point.x, point.y, point.z)) point = spawnPoint(spec, biomes, random(seed * 977 + key * 31 + 5), undefined, (x, y, z) => !fits(x, y, z));
      // A few landmarks are placed where the opening camera can see them.
      if (!firsts.has(spec.key)) {
        firsts.add(spec.key);
        if (spec.key === '2:fish') Object.assign(point, { x: 12, y: 19, z: -21 });
        if (spec.key === '2:ray') Object.assign(point, { x: -35, y: 34, z: -27 });
        if (spec.key === '3:boat') Object.assign(point, { x: 63, y: WATER_LEVEL + 4, z: -50 });
        if (spec.key === '3:tree') Object.assign(point, { x: -175, y: WATER_LEVEL + 8, z: -235 });
      }
      out.push({ id: id++, spec, ...point, phase: rand() * Math.PI * 2 });
    }
  }
  // The coast's land food (coast.ts) comes after every other spawn, each species with its own RNG: no earlier id or place moves.
  for (const spec of SPECIES.filter(x => x.zone)) {
    const rand = random(seed * 389 + SPECIES.indexOf(spec) * 7919 + 17), biomes = makeBiomes(seed, spec.tier);
    for (let i = 0; i < spec.count; i++) out.push({ id: id++, spec, ...spawnPoint(spec, biomes, rand), phase: rand() * Math.PI * 2 });
  }
  return out;
}
/** Planet 0 is the home world below the ocean. The others orbit above it. */
function planetPoint(index: number, rand: () => number) {
  if (index === 0) return { x: 0, y: -345, z: 0 };
  const angle = index * 2.39996 + rand() * .5, r = (7 + Math.sqrt(index) * 5) * SIZES[4];
  return { x: Math.cos(angle) * r, y: 650 + index % 4 * 230, z: Math.sin(angle) * r };
}
export const PLANET_COUNT = SPECIES.find(spec => spec.kind === 'planet')!.count;
