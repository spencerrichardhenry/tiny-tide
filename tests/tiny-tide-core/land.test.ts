// tests/tiny-tide-core/land.test.ts — the continent's scenery (owner, 2026-10-08: "the continental landmass looks quite empty").
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { seabedHeight, WATER_LEVEL } from '../../src/tiny-tide/biomes';
import { LAND_MARGIN, landMeshes, placeLand, SIZE2_CLEAR } from '../../src/tiny-tide/land';
import { Ecosystem } from '../../src/tiny-tide/ecosystem';
import { landmassAt } from '../../src/tiny-tide/coast';

describe('land scenery', () => {
  const scenery = placeLand(1);
  it('places forests, villages and boulders, every one on dry continent land', () => {
    expect(scenery.pines.length).toBeGreaterThan(700); expect(scenery.cottages.length).toBeGreaterThan(40); expect(scenery.boulders.length).toBeGreaterThan(150);
    for (const p of [...scenery.pines, ...scenery.cottages, ...scenery.boulders]) {
      expect(landmassAt(p.x, p.z)).toBe('continent'); expect(seabedHeight(p.x, p.z)).toBeGreaterThan(WATER_LEVEL + LAND_MARGIN);
      expect(Math.max(Math.abs(p.x), Math.abs(p.z)), 'outside the size-2 square').toBeGreaterThan(SIZE2_CLEAR);
    }
  });
  it('is the same for a seed, and stays under 60 000 triangles in chunks', () => {
    expect(placeLand(1)).toEqual(scenery);
    const meshes = landMeshes(scenery, new T.MeshBasicMaterial()), tris = meshes.reduce((n, m) => n + m.geometry.getAttribute('position').count / 3, 0);
    expect(tris).toBeLessThan(60_000); expect(meshes.length).toBeGreaterThan(8);
  });
  it('spawns the new size-3 land food on the continent, and the coast lighthouses near the waterline', () => {
    const eco = new Ecosystem(1);
    for (const key of ['3:orchard', '3:tortoise', '3:beacon']) {
      const list = eco.entities.filter(e => e.spec.key === key);
      expect(list.length, key).toBeGreaterThan(0);
      for (const e of list) expect(landmassAt(e.x, e.z), key).toBe('continent');
    }
    for (const e of eco.entities.filter(x => x.spec.key === '3:beacon')) expect(seabedHeight(e.x, e.z)).toBeLessThan(WATER_LEVEL + 12);
  });
});
