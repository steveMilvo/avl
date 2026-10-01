import { describe, it, expect } from "vitest";
import { evaluateLoader, bucketRetention, loaderCompliance, armAngleForBucketPivotHeight, dataConfidence, rad, v, LEVEL, G } from "../src/index.js";
import { loader, ldInputs, bucketLoad, slope } from "./fixtures.js";

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const P = loader();

describe("loader: geometry", () => {
  it("bucket pivot follows the arm arc: reach changes with height", () => {
    const g = P.geometry;
    for (const deg of [-40, -20, 0, 20, 40]) {
      const s = evaluateLoader(P, ldInputs({ armAngle: rad(deg) }));
      close(s.geometry.bucketPivot.x, g.armPivot.x + g.armLength * Math.cos(rad(deg)), 1e-9);
      close(s.geometry.bucketPivotHeight, g.armPivot.z + g.armLength * Math.sin(rad(deg)), 1e-9);
    }
    close(armAngleForBucketPivotHeight(P, g.armPivot.z), 0);
    // raising from carry to horizontal increases reach; continuing to full height reduces it again
    const reach = (deg: number) => evaluateLoader(P, ldInputs({ armAngle: rad(deg) })).geometry.horizontalReach!;
    expect(reach(0)).toBeGreaterThan(reach(-35));
    expect(reach(45)).toBeLessThan(reach(0));
  });

  it("payload mass from density × volume, or explicit mass (explicit wins)", () => {
    const d = evaluateLoader(P, ldInputs({ payload: bucketLoad({ mass: undefined, density: 1600, fillVolume: 1.2 }) }));
    close(d.geometry.payloadMass!, 1920); expect(d.geometry.payloadMassBasis).toBe("density×volume");
    const e = evaluateLoader(P, ldInputs({ payload: bucketLoad({ mass: 1000, density: 1600, fillVolume: 1.2 }) }));
    close(e.geometry.payloadMass!, 1000); expect(e.geometry.payloadMassBasis).toBe("explicit");
    expect(() => evaluateLoader(P, ldInputs({ payload: bucketLoad({ mass: undefined, density: 1600, fillVolume: 1.6 }) }))).toThrow(/heaped/);
  });

  it("articulation swings the front frame, front contacts and payload about the joint", () => {
    const a = rad(30);
    const s = evaluateLoader(P, ldInputs({ articulation: a }));
    const st = evaluateLoader(P, ldInputs());
    close(s.support.rigidLeft.p.x, P.geometry.frontAxleX * Math.cos(a) - (P.geometry.trackFront / 2) * Math.sin(a), 1e-9);
    // payload CG rotates by the same angle about the z axis through the joint
    const p0 = st.geometry.payloadCg!, p1 = s.geometry.payloadCg!;
    close(p1.x, p0.x * Math.cos(a) - p0.y * Math.sin(a), 1e-9);
    close(p1.y, p0.x * Math.sin(a) + p0.y * Math.cos(a), 1e-9);
    close(p1.z, p0.z, 1e-12);
    expect(p1.y).toBeGreaterThan(0.5); // a left turn carries the load to the left
  });
});

describe("loader: stability", () => {
  it("straight, symmetric: the resultant lies on the centreline and the front-axle margin matches the analytic moment balance", () => {
    const s = evaluateLoader(P, ldInputs());
    close(s.stability.gravityEval.intersection!.y, 0, 1e-9);
    const ev = s.stability.gravityEval;
    const front = ev.edges.find((e) => e.id === "FR-FL")!;
    const mx = s.components.reduce((a, c) => a + c.mass * (c.cg.x - P.geometry.frontAxleX), 0);
    // Moment of the weight about the front axle equals Σ mᵢ g (xᵢ − x_front); the ground-plane
    // intersection sits at the mass-weighted x. (The in-plane margin differs slightly because the
    // pivot lifts the rear of the support plane.)
    close(front.stabilisingMoment, -mx * G, 1e-6);
    close(ev.groundIntersection!.x, s.stability.cg.combined.cg.x, 1e-9);
    expect(s.stability.status).toBe("within-boundary");
  });

  it("straight tipping load from bisection equals the analytic value", () => {
    const comps = evaluateLoader(P, ldInputs({ payload: bucketLoad({ mass: 1 }) })).components;
    const xf = P.geometry.frontAxleX;
    const machine = comps.filter((c) => c.group === "machine");
    const payloadX = comps.find((c) => c.id === "payload")!.cg.x;
    const mTip = -machine.reduce((a, c) => a + c.mass * (c.cg.x - xf), 0) / (payloadX - xf);
    let lo = 0, hi = 20000;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const st = evaluateLoader(P, ldInputs({ payload: bucketLoad({ mass: mid }) })).stability.status;
      if (st === "incipient-tipping") hi = mid; else lo = mid;
    }
    close(lo, mTip, 1e-6);
    expect(mTip).toBeGreaterThan(3000); // sanity for the generic profile
  });

  it("full articulation reduces the lateral margin on the inside of the turn and the tipping load", () => {
    const tip = (art: number) => {
      let lo = 0, hi = 20000;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        const st = evaluateLoader(P, ldInputs({ articulation: art, payload: bucketLoad({ mass: mid }) })).stability.status;
        if (st === "incipient-tipping") hi = mid; else lo = mid;
      }
      return lo;
    };
    const straight = tip(0), full = tip(rad(40));
    expect(full).toBeLessThan(straight * 0.9);
    const s = evaluateLoader(P, ldInputs({ articulation: rad(40), payload: bucketLoad({ mass: full * 1.01 }) }));
    expect(s.stability.status).toBe("incipient-tipping");
    expect(["FL-P", "FR-FL", "FL-RL"]).toContain(s.stability.resultantEval.critical.id);
  });

  it("raising the bucket does not by itself move the ground intersection on level ground when reach is unchanged", () => {
    // armAngle -20 and +20 give identical reach for the bucket pivot; the payload CG differs by bucket angle only.
    const lo = evaluateLoader(P, ldInputs({ armAngle: rad(-20) })), hi = evaluateLoader(P, ldInputs({ armAngle: rad(20) }));
    close(hi.geometry.bucketPivot.x, lo.geometry.bucketPivot.x, 1e-9);
    expect(hi.stability.cg.combined.cg.z).toBeGreaterThan(lo.stability.cg.combined.cg.z);
    // arms CG moves too (it rotates with the arm), so the combined projection differs slightly — report, don't assume.
    const dx = Math.abs(hi.stability.gravityEval.intersection!.x - lo.stability.gravityEval.intersection!.x);
    expect(dx).toBeLessThan(0.05);
  });

  it("across a slope with full articulation the rear stop engages, then tips, and the explanation names the lifted wheel", () => {
    const mild = evaluateLoader(P, ldInputs({ articulation: rad(40), armAngle: rad(40), terrain: slope(25, -90), allowOutsideLimits: true })); // uphill on the left ⇒ pulls right
    expect(mild.stability.stage).toBe("axle-stop-right");
    expect(mild.stability.liftedContact!.id).toBe("FL");
    const W = mild.stability.cg.combined.mass * G;
    close(mild.stability.reactions!.reduce((a, r) => a + r.normal, 0), W * Math.cos(rad(25)), 1e-6);
    expect(mild.stability.reactions!.find((r) => r.id === "FL")!.lifted).toBe(true);
    const steep = evaluateLoader(P, ldInputs({ articulation: rad(40), armAngle: rad(40), terrain: slope(40, -90), allowOutsideLimits: true }));
    expect(steep.stability.status).toBe("incipient-tipping");
  });
});

describe("loader: retention, compliance, data confidence", () => {
  it("dumping beyond the angle of repose spills; rolled back retains", () => {
    const dump = evaluateLoader(P, ldInputs({ bucketAngle: rad(-40) }));
    expect(bucketRetention(dump).status).toBe("spill-predicted");
    close(bucketRetention(dump).effectiveFloorSlope, rad(40), 1e-9);
    expect(bucketRetention(evaluateLoader(P, ldInputs({ bucketAngle: rad(20) }))).status).toBe("retained");
    // facing downhill reduces the effective roll-back
    const down = evaluateLoader(P, ldInputs({ bucketAngle: rad(10), terrain: slope(15, 180), allowOutsideLimits: true }));
    close(bucketRetention(down).effectiveFloorSlope, rad(5), 1e-9);
  });

  it("generic loader has no rated operating load ⇒ operating limit not verified", () => {
    const c = loaderCompliance(evaluateLoader(P, ldInputs()));
    expect(c.status).toBe("operating-limit-not-verified");
  });

  it("data confidence reports the generic profile as illustrative with zero verified parameters", () => {
    const dc = dataConfidence(P as unknown as { meta: typeof P.meta } & Record<string, unknown>);
    expect(dc.releaseStatus).toBe("generic-educational");
    close(dc.verifiedFraction, 0);
  });
});
