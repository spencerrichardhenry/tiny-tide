// Base bodies (owner, 2026-10-07): every evolution starts the creature again from its new plan's base body. All parts come off
// (their DNA comes back through the ledger), the mouth stays, and the body takes the plan's own shape and a few starter parts, so
// each path feels like a different animal. The player then builds on that base in the evolve editor.
import { quoteDesign, type Economy } from './economy';
import { cloneGenome, nextUid, problems, type DesignContext, type Genome, type PlacedPart, type SpinePoint } from './genome';
import { part, PARTS, type PartSpec } from './parts';
import type { BodyPlan } from './plans';

const HALF = Math.PI / 2;
type Seg = readonly [radius: number, height: number, lift: number];
type Starter = readonly [id: string, t: number, angle: number, scale: number, mirror: boolean];
export interface BaseBody { spine: readonly Seg[]; parts: readonly Starter[] }
const EYES = (t = .16, angle = .55, scale = .8): Starter => ['eye_bead', t, angle, scale, true];
const LEGS = (t: number, scale = 1): Starter => ['leg_little', t, HALF + .9, scale, true];

/** The base body of each plan: its spine (head to tail) and its starter parts (besides the mouth). */
export const BASES: Readonly<Record<string, BaseBody>> = {
  speck: { spine: [[.5, .48, .05], [.62, .58, .02], [.52, .48, 0], [.32, .3, .04]], parts: [['eye_stalk', .16, .5, .75, true], ['tail_paddle', 1, 0, .8, false], LEGS(.45, .7)] },
  // Size 1
  swimmer: { spine: [[.42, .4, .04], [.58, .55, .02], [.55, .5, 0], [.38, .34, .02], [.25, .25, .04]], parts: [EYES(), ['tail_paddle', 1, 0, 1, false], ['fin_side', .42, HALF + .2, .8, true]] },
  crawler: { spine: [[.55, .3, 0], [.78, .38, 0], [.82, .4, 0], [.66, .34, 0], [.4, .25, 0]], parts: [['eye_stalk', .14, .5, .8, true], LEGS(.38), LEGS(.62)] },
  shore_walker: { spine: [[.42, .55, .18], [.5, .66, .08], [.46, .6, 0], [.3, .36, -.04]], parts: [EYES(.13, .45), LEGS(.55, 1.2)] },
  // Size 2
  darter: { spine: [[.3, .32, .02], [.45, .42, 0], [.48, .44, 0], [.36, .32, 0], [.25, .25, .03]], parts: [EYES(.14, .6, .7), ['tail_paddle', 1, 0, 1.1, false], ['fin_dorsal', .45, 0, .9, false]] },
  bulk: { spine: [[.7, .68, .05], [1, .95, .02], [1.15, 1.1, 0], [1.05, 1, 0], [.75, .7, 0], [.38, .34, .04]], parts: [EYES(.12, .6), ['tail_paddle', 1, 0, 1.2, false], ['fin_side', .45, HALF + .2, 1, true]] },
  shellback: { spine: [[.5, .4, 0], [.9, .7, 0], [.9, .7, 0], [.9, .7, 0], [.4, .28, 0]], parts: [['eye_stalk', .12, .5, .8, true], LEGS(.4), LEGS(.65), ['shell_plate', .5, 0, 1, false]] },
  burrower: { spine: [[.38, .34, 0], [.42, .36, 0], [.42, .36, 0], [.4, .34, 0], [.38, .32, 0], [.32, .28, 0], [.25, .25, 0]], parts: [EYES(.12, .6, .55), ['antenna', .06, .35, .9, true], LEGS(.45, .8)] },
  strider: { spine: [[.36, .5, .25], [.45, .62, .12], [.42, .6, .05], [.26, .34, 0]], parts: [EYES(.12, .45), LEGS(.4, 1.4), LEGS(.7, 1.4)] },
  mudskipper: { spine: [[.72, .6, .1], [.62, .5, .05], [.46, .38, 0], [.3, .26, 0], [.25, .25, .05]], parts: [['eye_stalk', .1, .35, .9, true], LEGS(.35), ['tail_paddle', 1, 0, .9, false]] },
  // Size 3
  sky_drifter: { spine: [[.5, .3, 0], [1, .32, 0], [1.2, .34, 0], [1, .3, 0], [.55, .25, 0], [.25, .25, 0]], parts: [EYES(.1, .6), ['fin_side', .45, HALF + .1, 1.4, true], ['tail_paddle', 1, 0, 1, false]] },
  colossus: { spine: [[.8, .85, .15], [1.1, 1.1, .05], [1.2, 1.2, 0], [1.15, 1.1, 0], [.9, .85, 0], [.5, .45, 0]], parts: [EYES(.1, .6), LEGS(.35, 1.3), LEGS(.65, 1.3)] },
  dune_giant: { spine: [[.55, .7, .3], [.7, .9, .15], [.8, 1, .05], [.8, 1, 0], [.7, .85, 0], [.5, .6, 0], [.3, .35, 0]], parts: [EYES(.1, .5), LEGS(.35, 1.4), LEGS(.65, 1.4)] },
  shore_giant: { spine: [[.75, .65, .1], [.95, .8, .05], [1, .85, 0], [.9, .75, 0], [.65, .5, 0], [.35, .28, .05]], parts: [EYES(.1, .5), LEGS(.45, 1.2), ['tail_paddle', 1, 0, 1.2, false]] },
  // Size 4
  star_swimmer: { spine: [[.45, .42, 0], [.6, .55, .05], [.65, .6, .1], [.6, .55, .05], [.55, .5, -.05], [.48, .42, -.1], [.38, .32, -.05], [.25, .25, 0]], parts: [EYES(.1, .6), ['tail_paddle', 1, 0, 1.2, false]] },
  star_crawler: { spine: [[.9, .8, 0], [1.15, 1, 0], [1.2, 1.05, 0], [1.1, .95, 0], [.85, .7, 0], [.45, .38, 0]], parts: [EYES(.1, .6), ['tentacle', .5, HALF + .8, 1.2, true]] },
  star_walker: { spine: [[.6, .75, .2], [.8, .95, .1], [.85, 1, 0], [.8, .9, 0], [.6, .6, 0], [.3, .3, 0]], parts: [EYES(.1, .5), ['tentacle', .45, HALF + .8, 1.2, true]] },
};

export type BaseResult = { ok: true; genome: Genome; changes: string[]; nextSerial: number } | { ok: false; reasons: string[] };
/** The creature as plan `p`'s base body: the base spine and starter parts, the current mouth (moved to the front) when the plan
 *  allows it, and the same paint. `minimal`: only the mouth and the parts the plan requires (used when the starter parts cost more
 *  DNA than the creature has). Parts that are not valid on the plan (locked, or failing a rule) are left out. */
export function baseBody(g: Genome, p: BodyPlan, ctx: DesignContext, nextSerial: number, minimal = false): BaseResult {
  const base = BASES[p.id]; if (!base) return { ok: false, reasons: [`No base body for ${p.name}.`] };
  let serial = nextSerial;
  const spine: SpinePoint[] = base.spine.map(([radius, height, lift]) => ({ radius, height, lift }));
  const oldMouth = g.parts.find(x => part(x.id)?.kind === 'mouth'), mouthSpec = oldMouth && part(oldMouth.id);
  const keepMouth = !!oldMouth && !!mouthSpec && !p.bans.includes('mouth') && (!ctx.diet || mouthSpec.diet === ctx.diet);
  const parts: PlacedPart[] = [];
  if (keepMouth) parts.push({ ...oldMouth!, t: 0, angle: 0, mirror: false, roll: 0 });
  else {
    const diet = ctx.diet ?? mouthSpec?.diet ?? 'herbivore', spec = PARTS.filter(s => s.kind === 'mouth' && s.diet === diet && !s.rare && s.stage <= p.size).sort((a, b) => a.cost - b.cost)[0];
    if (spec) parts.push({ uid: nextUid(serial++), id: spec.id, t: 0, angle: 0, scale: 1, mirror: false, roll: 0 });
  }
  const required = (spec: PartSpec) => p.requiresKinds.includes(spec.kind) || p.requiresCapabilities.some(c => (spec.stats[c.stat] ?? 0) > 0);
  for (const [id, t, angle, scale, mirror] of base.parts) {
    const spec = part(id); if (!spec || (minimal && !required(spec))) continue;
    parts.push({ uid: nextUid(serial++), id, t, angle, scale, mirror, roll: 0 });
  }
  const out: Genome = { spine, parts, paint: { ...g.paint } };
  // Leave out any starter part the plan refuses (for example one not yet unlocked); keep the rest.
  for (const x of [...out.parts]) if (x !== out.parts[0] && problems(out, p, { unlocked: ctx.unlocked }).some(q => q.uid === x.uid && q.code !== 'dna')) out.parts = out.parts.filter(q => q !== x);
  const found = problems(out, p, { unlocked: ctx.unlocked, diet: ctx.diet, anchorCheck: ctx.anchorCheck }).filter(q => q.code !== 'dna');
  if (found.length) return { ok: false, reasons: found.map(q => q.message) };
  const removed = g.parts.filter(x => x.uid !== oldMouth?.uid || !keepMouth).length;
  const changes = [`A fresh ${p.name} body: ${removed ? `${removed} part${removed === 1 ? '' : 's'} came off, and ${removed === 1 ? 'its' : 'their'} DNA is back.` : 'a new shape.'}`];
  if (keepMouth) changes.push(`Kept: your ${mouthSpec!.name.toLowerCase()}.`);
  const added = out.parts.filter(x => x.uid !== oldMouth?.uid).map(x => part(x.id)!.name);
  if (added.length) changes.push(`Starter parts: ${[...new Set(added)].join(', ').toLowerCase()}.`);
  // Fresh ids for the kept starter parts, in order (as adaptToPlan does).
  let next = nextSerial;
  for (const x of out.parts) if (x.uid !== oldMouth?.uid || !keepMouth) x.uid = nextUid(next++);
  return { ok: true, genome: cloneGenome(out), changes, nextSerial: next };
}
/** The evolve proposal for plan `p` (main.ts and the browser fixtures): the base body, or the minimal base when the starter parts
 *  cost more DNA than the creature has. */
export function evolutionProposal(r: { genome: Genome; economy: Economy; unlocked: readonly string[]; nextPartSerial: number }, p: BodyPlan, anchorCheck?: DesignContext['anchorCheck']): BaseResult {
  const ctx = { unlocked: r.unlocked, anchorCheck }, full = baseBody(r.genome, p, ctx, r.nextPartSerial);
  return full.ok && !quoteDesign(r.economy, r.genome, full.genome).affordable ? baseBody(r.genome, p, ctx, r.nextPartSerial, true) : full;
}
