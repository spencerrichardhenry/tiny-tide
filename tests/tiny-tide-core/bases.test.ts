// tests/tiny-tide-core/bases.test.ts — base bodies (owner, 2026-10-07): each evolution starts again from the new plan's base body.
import { describe, expect, it, vi } from 'vitest';
vi.setConfig({ testTimeout: 60_000 });
import { BASES, baseBody } from '../../src/tiny-tide/bases';
import { genomeCost, problems, starterGenome, STARTER_NEXT_SERIAL, type Genome } from '../../src/tiny-tide/genome';
import { startAnchor } from '../../src/tiny-tide/motion';
import { bodyLengthOf, playerActor } from '../../src/tiny-tide/mount';
import { part } from '../../src/tiny-tide/parts';
import { PLANS, plan } from '../../src/tiny-tide/plans';
import { stageBounds, stageWorldQueries } from '../../src/tiny-tide/world-queries';

const withMouth = (id: string): Genome => { const g = starterGenome(); g.parts[0] = { ...g.parts[0]!, id }; return g; };

describe('base bodies', () => {
  it('has a valid base body for every plan, for each starting mouth', () => {
    for (const p of PLANS) {
      expect(BASES[p.id], p.id).toBeDefined();
      for (const mouth of ['mouth_nibbler', 'mouth_snapper']) {
        const r = baseBody(withMouth(mouth), p, { unlocked: [] }, 50);
        if (!r.ok) throw new Error(`${p.id} ${mouth}: ${r.reasons.join('; ')}`);
        expect(problems(r.genome, p, { unlocked: [] }).filter(x => x.code !== 'dna'), p.id).toEqual([]);
        expect(r.genome.parts.find(x => part(x.id)!.kind === 'mouth')!.id, `${p.id} keeps the mouth`).toBe(mouth);
      }
    }
  });
  it('takes every other part off: a crawler at size 4 has no legs, and no old part survives', () => {
    const g = starterGenome();   // legs, a tail and stalk eyes
    for (const p of PLANS.filter(q => q.size > 0)) {
      const r = baseBody(g, p, { unlocked: [] }, STARTER_NEXT_SERIAL); if (!r.ok) throw new Error(p.id);
      const kept = r.genome.parts.filter(x => g.parts.some(q => q.uid === x.uid)).map(x => part(x.id)!.kind);
      expect(kept, p.id).toEqual(['mouth']);
      if (p.size === 4) expect(r.genome.parts.some(x => part(x.id)!.kind === 'leg'), p.id).toBe(false);
    }
    expect(plan('star_crawler')!.bans).toContain('leg'); expect(plan('star_walker')!.bans).toContain('leg');
  });
  it('gives the plans of a size different shapes', () => {
    for (let size = 1; size <= 4; size++) {
      const shapes = PLANS.filter(p => p.size === size).map(p => JSON.stringify(BASES[p.id]!.spine));
      expect(new Set(shapes).size, `size ${size}`).toBe(shapes.length);
    }
  });
  it('a minimal base keeps only the mouth and the required parts, and costs less', () => {
    for (const p of PLANS.filter(q => q.size > 0)) {
      const full = baseBody(starterGenome(), p, { unlocked: [] }, 50), min = baseBody(starterGenome(), p, { unlocked: [] }, 50, true);
      if (!full.ok || !min.ok) throw new Error(p.id);
      expect(genomeCost(min.genome), p.id).toBeLessThanOrEqual(genomeCost(full.genome));
    }
  });
  it('fits somewhere at growth 1 and 1.38 for every plan (start anchors, coast plans on land)', () => {
    for (const p of PLANS) {
      const r = baseBody(starterGenome(), p, { unlocked: [] }, 50); if (!r.ok) throw new Error(p.id);
      for (const growth of [1, 1.38]) {
        const a = startAnchor(playerActor(p, r.genome, p.size, growth), p.size, { queries: stageWorldQueries(p.size, 1), bounds: stageBounds(p.size) });
        expect(a.ok, `${p.id} growth ${growth} (L ${bodyLengthOf(r.genome).toFixed(2)})`).toBe(true);
      }
    }
  });
});

describe('a flyer over the coast', () => {
  it('crosses the continent slope toward the sea with Dive held (land hover), as without it', async () => {
    const { stepPlayer } = await import('../../src/tiny-tide/player-motion');
    const { newRuntime } = await import('../../src/tiny-tide/combat-types');
    const { RELEASED } = await import('../../src/tiny-tide/input');
    const { movement, movementCapabilities } = await import('../../src/tiny-tide/profiles');
    const { derive, effectiveStats } = await import('../../src/tiny-tide/genome');
    const { STAGES } = await import('../../src/tiny-tide/state');
    const p = plan('sky_drifter')!, r = baseBody(starterGenome(), p, { unlocked: [] }, 50); if (!r.ok) throw new Error('base');
    const a = playerActor(p, r.genome, 3, 1.07), q = stageWorldQueries(3, 1), target = { x: -170, z: -220 };
    for (const dive of [true, false]) {
      let pos = { x: 799, y: 288, z: 375 }; const rt = newRuntime({ yaw: Math.atan2(target.x - pos.x, target.z - pos.z), pitch: 0 });
      for (let i = 0; i < 300; i++) {
        const dx = target.x - pos.x, dz = target.z - pos.z, d = Math.hypot(dx, dz);
        const s = stepPlayer(pos, rt, { ...RELEASED, traversal: dive ? 'dive' : 'none' }, { plan: p, profile: movement(p.movement), caps: movementCapabilities(p), actor: a, queries: q, bounds: stageBounds(3),
          size: 64, topSpeedLocal: STAGES[3]!.speed * derive(effectiveStats(r.genome, p)).speedFactor, now: i / 60, dt: 1 / 60, wish: { x: dx / d, y: 0, z: dz / d }, aim: null, actionLock: false });
        if (!s.needsRecovery) pos = s.position;
      }
      expect(pos.x, `dive ${dive}: crossed to the sea`).toBeLessThan(400);
    }
  });
});

describe('the evolution destination (owner bug 2026-10-08: "This body can\'t fit anywhere here" for a Shore-walker)', () => {
  it('finds a place for every base body from the world centre at any heading', async () => {
    const { evolutionDestination } = await import('../../src/tiny-tide/lifecycle');
    for (const p of PLANS.filter(q => q.size > 0 && q.size < 4)) {
      const r = baseBody(starterGenome(), p, { unlocked: [] }, 50); if (!r.ok) throw new Error(p.id);
      const legal = { queries: stageWorldQueries(p.size, 1), bounds: stageBounds(p.size) }, a = playerActor(p, r.genome, p.size, 1), anchor = startAnchor(a, p.size, legal);
      if (!anchor.ok) throw new Error(`${p.id}: no anchor`);
      for (const yaw of [0, 1, 2, 3, -1.5]) {
        const here = { x: 5 * (p.size + 1), y: 3, z: -4 * (p.size + 1) };
        expect(evolutionDestination(a, here, { ...legal, orientation: { yaw, pitch: 0 }, time: 0 }, anchor.position).ok, `${p.id} yaw ${yaw}`).toBe(true);
      }
    }
  });
});

describe('land-only evolutions go to the continent (owner bug 2026-10-08: "stranded on a tiny island")', () => {
  it('a Shore-walker on the island that becomes a Strider lands on the continent, and a Mudskipper may stay', async () => {
    const { evolutionDestination } = await import('../../src/tiny-tide/lifecycle');
    const { landmassAt, landStart } = await import('../../src/tiny-tide/coast');
    const beach = landStart('island'), here = { x: beach.x, y: 92, z: beach.z };
    for (const [id, where] of [['strider', 'continent'], ['mudskipper', null]] as const) {
      const p = plan(id)!, r = baseBody(starterGenome(), p, { unlocked: [] }, 50); if (!r.ok) throw new Error(id);
      const legal = { queries: stageWorldQueries(2, 1), bounds: stageBounds(2) }, a = playerActor(p, r.genome, 2, 1), anchor = startAnchor(a, 2, legal);
      if (!anchor.ok) throw new Error(`${id}: no anchor`);
      const d = evolutionDestination(a, here, { ...legal, orientation: { yaw: 1, pitch: 0 }, time: 0 }, anchor.position);
      expect(d.ok, id).toBe(true); if (!d.ok) continue;
      if (where) expect(landmassAt(d.position.x, d.position.z), id).toBe(where);
    }
  });
});
