import { type StabilityResult } from "./stability.js";
import { sub, norm, type Vec3 } from "./math.js";

/**
 * "Explain this change": structured facts derived from two model results, plus concise
 * sentences assembled only from those facts. Nothing here is a canned rule; every sentence
 * reports a quantity that actually changed in the model.
 */
export interface ChangeExplanation {
  cgMoved: { combined: Vec3; machine: Vec3; payload: Vec3 | undefined; combinedDistance: number };
  criticalAxis: { before: string; after: string };
  marginChange_m: number;
  stageChange: { before: string; after: string } | undefined;
  reactionChanges: { id: string; label: string; before: number; after: number }[];
  momentChanges: { id: string; before: number; after: number }[];
  statusChange: { before: string; after: string } | undefined;
  sentences: string[];
}

const mmStr = (m: number) => `${Math.round(m * 1000)} mm`;
const kN = (n: number) => `${(n / 1000).toFixed(1)} kN`;

export const explainChange = (before: StabilityResult, after: StabilityResult): ChangeExplanation => {
  const combined = sub(after.cgUnrolled.combined.cg, before.cgUnrolled.combined.cg);
  const machine = sub(after.cgUnrolled.machine.cg, before.cgUnrolled.machine.cg);
  const payload = before.cgUnrolled.payload.mass > 0 && after.cgUnrolled.payload.mass > 0
    ? sub(after.cgUnrolled.payload.cg, before.cgUnrolled.payload.cg) : undefined;
  const cb = before.resultantEval.critical, ca = after.resultantEval.critical;
  const sentences: string[] = [];

  const d = norm(combined);
  if (d < 1e-4) sentences.push("The combined centre of gravity did not move.");
  else {
    const parts: string[] = [];
    if (Math.abs(combined.x) > 1e-4) parts.push(`${mmStr(Math.abs(combined.x))} ${combined.x > 0 ? "forward" : "rearward"}`);
    if (Math.abs(combined.y) > 1e-4) parts.push(`${mmStr(Math.abs(combined.y))} to the ${combined.y > 0 ? "left" : "right"}`);
    if (Math.abs(combined.z) > 1e-4) parts.push(`${mmStr(Math.abs(combined.z))} ${combined.z > 0 ? "up" : "down"}`);
    sentences.push(`The combined centre of gravity moved ${parts.join(", ")}.`);
  }

  // Did the force line move without the CG moving (slope, inertia, or roll onto a stop)?
  const pb = before.resultantEval.intersection, pa = after.resultantEval.intersection;
  if (pb && pa) {
    const dp = sub(pa, pb);
    const planar = Math.hypot(dp.x, dp.y);
    if (d < 1e-4 && planar > 1e-4) {
      const why = after.quasiStatic !== before.quasiStatic || (after.quasiStatic && before.quasiStatic)
        ? "the inertial force changed the resultant's direction, not the mass centre"
        : "the gravity line of action meets the ground at a different point because the machine's orientation changed";
      sentences.push(`The resultant's ground intersection moved ${mmStr(planar)} although the mass centre did not: ${why}.`);
    }
  }

  const marginChange = ca.margin - cb.margin;
  if (cb.id === ca.id) sentences.push(`Margin to the ${ca.id} axis changed from ${mmStr(cb.margin)} to ${mmStr(ca.margin)}.`);
  else sentences.push(`The critical axis changed from ${cb.id} (${mmStr(cb.margin)}) to ${ca.id} (${mmStr(ca.margin)}).`);

  const stageChange = before.stage !== after.stage ? { before: before.stage, after: after.stage } : undefined;
  if (stageChange) sentences.push(...after.notes);

  const reactionChanges: ChangeExplanation["reactionChanges"] = [];
  for (const ra of after.reactions ?? []) {
    const rb = (before.reactions ?? []).find((x) => x.id === ra.id);
    if (rb && Math.abs(ra.normal - rb.normal) > 1) reactionChanges.push({ id: ra.id, label: ra.label, before: rb.normal, after: ra.normal });
  }
  const unloaded = reactionChanges.filter((r) => r.after < r.before).sort((a, b) => (a.after - a.before) - (b.after - b.before))[0];
  if (unloaded) sentences.push(unloaded.after <= 0
    ? `${unloaded.label} reaction fell from ${kN(Math.max(0, unloaded.before))} to zero: that wheel lifts.`
    : `${unloaded.label} reaction fell from ${kN(unloaded.before)} to ${kN(unloaded.after)}.`);

  const momentChanges: ChangeExplanation["momentChanges"] = [];
  if (cb.id === ca.id) {
    for (const c of ca.contributions) {
      const b = cb.contributions.find((x) => x.id === c.id);
      if (b && Math.abs(c.moment - b.moment) > 1) momentChanges.push({ id: c.id, before: b.moment, after: c.moment });
    }
    const biggest = [...momentChanges].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))[0];
    if (biggest) {
      const delta = biggest.after - biggest.before;
      sentences.push(`The ${biggest.id} moment about ${ca.id} changed by ${(delta / 1000).toFixed(1)} kN·m (${delta > 0 ? "more stabilising" : "more overturning"}).`);
    }
  }
  const statusChange = before.status !== after.status ? { before: before.status, after: after.status } : undefined;
  if (statusChange) sentences.push(`Status changed from "${statusChange.before}" to "${statusChange.after}".`);

  return { cgMoved: { combined, machine, payload, combinedDistance: d }, criticalAxis: { before: cb.id, after: ca.id }, marginChange_m: marginChange, stageChange, reactionChanges, momentChanges, statusChange, sentences };
};
