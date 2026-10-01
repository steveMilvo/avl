import { describe, it, expect } from "vitest";
import { evaluateForklift, evaluateLoader, forkliftCompliance, loaderCompliance, forkliftLoadRetention, bucketRetention, rad, v, G } from "../src/index.js";
import { forklift, loader, fkInputs, ldInputs, pallet, bucketLoad, slope } from "./fixtures.js";

/**
 * Reproducible benchmark print-out for docs/validation. Values are computed, not asserted
 * against targets, except where an analytic answer exists (those live in the other test files).
 */
describe("benchmark report", () => {
  it("prints the priority loader slope comparison", () => {
    const P = loader();
    const rows: string[] = [];
    for (const art of [0, 20, 40]) for (const headingDeg of [0, 180, 90]) for (const arm of [-35, 0, 40]) {
      const s = evaluateLoader(P, ldInputs({ articulation: rad(art), armAngle: rad(arm), terrain: slope(10, headingDeg) }));
      const e = s.stability.resultantEval.critical;
      rows.push(`art ${art}° heading ${headingDeg}° arm ${arm}°: stage ${s.stability.stage}, critical ${e.id} margin ${(e.margin * 1000).toFixed(0)} mm, status ${s.stability.status}, cg z ${s.stability.cg.combined.cg.z.toFixed(2)} m`);
    }
    console.log(rows.join("\n"));
    expect(rows.length).toBe(27);
  });

  it("prints the forklift lesson matrix", () => {
    const P = forklift();
    const cases: [string, ReturnType<typeof fkInputs>][] = [
      ["1 short load centre", fkInputs({ payload: pallet(2000, { loadCentre: 0.5 }) })],
      ["1 long load centre", fkInputs({ payload: pallet(2000, { loadCentre: 0.9 }) })],
      ["2 low load CG", fkInputs({ payload: pallet(2000, { height: 0.8 }) })],
      ["2 high load CG", fkInputs({ payload: pallet(2000, { height: 2.4 }) })],
      ["3 tilt back at 4 m", fkInputs({ liftHeight: 4, tiltBack: rad(8) })],
      ["3 tilt fwd at 4 m", fkInputs({ liftHeight: 4, tiltBack: rad(-5) })],
      ["5 facing uphill 8°", fkInputs({ terrain: slope(8, 0), allowOutsideLimits: true })],
      ["5 facing downhill 8°", fkInputs({ terrain: slope(8, 180), allowOutsideLimits: true })],
      ["7 cross slope 8° raised", fkInputs({ liftHeight: 3, terrain: slope(8, 90), allowOutsideLimits: true })],
      ["8 braking 3 m/s² raised", fkInputs({ liftHeight: 3, acceleration: v(-3, 0, 0) })],
      ["9 empty", fkInputs({ payload: null })],
      ["17 ice, 6° downhill", fkInputs({ terrain: slope(6, 180, 0.08), allowOutsideLimits: true })],
    ];
    const rows = cases.map(([name, inp]) => {
      const s = evaluateForklift(P, inp);
      const e = s.stability.resultantEval.critical;
      return `${name.padEnd(26)} stage ${s.stability.stage.padEnd(15)} ${e.id.padEnd(6)} margin ${(e.margin * 1000).toFixed(0).padStart(5)} mm  ${s.stability.status.padEnd(20)} plate: ${forkliftCompliance(s).status}  load: ${forkliftLoadRetention(s).status}`;
    });
    console.log(rows.join("\n"));
    expect(rows.length).toBe(cases.length);
  });
});

describe("Cat 950F draft: predicted vs listed static tipping load (reported, not tuned)", () => {
  it("prints predicted straight and full-turn tipping loads", async () => {
    const { cat950f } = await import("./fixtures.js");
    const C = cat950f();
    const tip = (art: number) => {
      let lo = 0, hi = 40000;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        const s = evaluateLoader(C, ldInputs({ armAngle: 0, bucketAngle: C.geometry.bucketAngleMax, articulation: art, payload: bucketLoad({ mass: mid }) }));
        if (s.stability.status === "incipient-tipping") hi = mid; else lo = mid;
      }
      return lo;
    };
    const straight = tip(0), full = tip(C.geometry.articulationLimit);
    const listed = C.capacity.staticTippingLoadStraight_kg!;
    console.log(`Cat 950F draft — predicted static tipping load: straight ${straight.toFixed(0)} kg, full turn ${full.toFixed(0)} kg; listed (unverified, configuration unknown) ${listed} kg; straight discrepancy ${(((straight - listed) / listed) * 100).toFixed(0)} %`);
    expect(full).toBeLessThan(straight);
  });
});
