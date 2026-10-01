import { describe, it, expect } from "vitest";
import { evaluateForklift, forkliftLoadRetention, forkliftCompliance, explainChange, G, rad, v, LEVEL } from "../src/index.js";
import { forklift, fkInputs, pallet, slope } from "./fixtures.js";

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const P = forklift();

/** Independent hand calculation of the machine-only moment about the front axle at the given mast state (level, no roll). */
const machineMomentAboutFrontAxle = (lift: number, tilt: number): { m: number; mx: number } => {
  const g = P.geometry, ms = P.masses;
  const c = Math.cos(tilt), s = Math.sin(tilt);
  // rotY(-tilt): x' = x cos t - z sin t ; z' = x sin t + z cos t  (relative to the pivot)
  const mastX = g.mastPivot.x + ms.mast.cg.x * c - ms.mast.cg.z * s;
  const carZ = g.forkTopZ + lift + ms.carriage.cg.z, carX = g.forkFaceX + ms.carriage.cg.x;
  const carriageX = g.mastPivot.x + carX * c - carZ * s;
  const m = ms.chassis.mass + ms.counterweight.mass + ms.operator.mass + ms.mast.mass + ms.carriage.mass;
  const mx = ms.chassis.mass * ms.chassis.cg.x + ms.counterweight.mass * ms.counterweight.cg.x + ms.operator.mass * ms.operator.cg.x + ms.mast.mass * mastX + ms.carriage.mass * carriageX;
  return { m, mx };
};

describe("forklift: mass accounting and geometry", () => {
  it("combined CG matches an independent moment calculation (level ground, rated load)", () => {
    const s = evaluateForklift(P, fkInputs());
    const { m, mx } = machineMomentAboutFrontAxle(0, 0);
    const payloadX = P.geometry.mastPivot.x + P.geometry.forkFaceX + 0.5; // load centre 500 mm
    close(s.stability.cg.combined.mass, m + 2500);
    close(s.stability.cg.combined.cg.x, (mx + 2500 * payloadX) / (m + 2500), 1e-9);
    close(s.geometry.loadCentre!, 0.5);
    close(s.geometry.forkHeight, 0.08, 1e-9);
    expect(s.stability.status).toBe("within-boundary");
    expect(s.stability.stage).toBe("axle-free");
  });

  it("pure vertical lift at zero tilt leaves the gravity-line intersection unchanged and raises the CG", () => {
    const low = evaluateForklift(P, fkInputs({ liftHeight: 0 }));
    const high = evaluateForklift(P, fkInputs({ liftHeight: 4.0 }));
    close(high.stability.gravityEval.intersection!.x, low.stability.gravityEval.intersection!.x, 1e-9);
    close(high.stability.gravityEval.critical.margin, low.stability.gravityEval.critical.margin, 1e-9);
    expect(high.stability.cg.combined.cg.z).toBeGreaterThan(low.stability.cg.combined.cg.z + 1.0);
    const ex = explainChange(low.stability, high.stability);
    expect(ex.sentences.join(" ")).toMatch(/moved .* up/);
  });

  it("back tilt moves the payload CG rearward by z·sin(τ) about the pivot", () => {
    const tilt = rad(8), lift = 3.0;
    const s = evaluateForklift(P, fkInputs({ liftHeight: lift, tiltBack: tilt }));
    const g = P.geometry;
    const zc = g.forkTopZ + lift + 0.5, xc = g.forkFaceX + 0.5;
    close(s.geometry.payloadCg!.x, g.mastPivot.x + xc * Math.cos(tilt) - zc * Math.sin(tilt), 1e-9);
    close(s.geometry.payloadCg!.z, g.mastPivot.z + xc * Math.sin(tilt) + zc * Math.cos(tilt), 1e-9);
    // and the margin to the front axle grows relative to the untilted case
    const u = evaluateForklift(P, fkInputs({ liftHeight: lift }));
    expect(s.stability.gravityEval.edges.find((e) => e.id === "FR-FL")!.margin)
      .toBeGreaterThan(u.stability.gravityEval.edges.find((e) => e.id === "FR-FL")!.margin);
  });

  it("forward tipping load equals the analytic moment balance about the front axle", () => {
    const { mx } = machineMomentAboutFrontAxle(0, 0);
    const payloadX = P.geometry.mastPivot.x + P.geometry.forkFaceX + 0.5;
    const mTip = -mx / payloadX;
    const under = evaluateForklift(P, fkInputs({ payload: pallet(mTip * 0.999) }));
    const over = evaluateForklift(P, fkInputs({ payload: pallet(mTip * 1.001) }));
    expect(under.stability.status).not.toBe("incipient-tipping");
    expect(over.stability.status).toBe("incipient-tipping");
    expect(over.stability.resultantEval.critical.id).toBe("FR-FL");
    // At exactly the tipping load the front-axle margin is zero.
    const at = evaluateForklift(P, fkInputs({ payload: pallet(mTip) }));
    close(at.stability.resultantEval.edges.find((e) => e.id === "FR-FL")!.margin, 0, 1e-9);
    // The payload's overturning moment equals the machine's stabilising moment at that point.
    const e = at.stability.resultantEval.edges.find((x) => x.id === "FR-FL")!;
    const payloadM = e.contributions.find((c) => c.id === "payload")!.moment;
    const machineM = e.contributions.filter((c) => c.id !== "payload").reduce((s, c) => s + c.moment, 0);
    close(payloadM + machineM, 0, 1e-6);
    expect(payloadM).toBeLessThan(0);
  });

  it("long load centre reduces the forward margin; capacity plate compliance follows the plate, not the physics", () => {
    const short = evaluateForklift(P, fkInputs({ payload: pallet(2000, { loadCentre: 0.5 }) }));
    const long = evaluateForklift(P, fkInputs({ payload: pallet(2000, { loadCentre: 0.9 }) }));
    expect(long.stability.resultantEval.edges.find((e) => e.id === "FR-FL")!.margin)
      .toBeLessThan(short.stability.resultantEval.edges.find((e) => e.id === "FR-FL")!.margin);
    expect(forkliftCompliance(short).status).toBe("within-manufacturer-limit");
    const c = forkliftCompliance(long);
    expect(c.status).toBe("manufacturer-limit-exceeded"); // 1800 kg @ 800 mm... actual lookup picks ≥ 0.9 → 1000 mm entry = 1500 kg
    expect(c.applicableCapacity_kg).toBe(1500);
    expect(forkliftCompliance(evaluateForklift(P, fkInputs({ payload: pallet(500, { loadCentre: 1.3 }) }))).status).toBe("operating-limit-not-verified");
    // Within the modelled boundary is not permission:
    expect(long.stability.status).not.toBe("incipient-tipping");
  });
});

describe("forklift: slope, reactions and support transitions", () => {
  it("facing downhill the gravity line shifts forward by h·tan(θ); facing uphill by the same amount rearward", () => {
    const level = evaluateForklift(P, fkInputs({ liftHeight: 2 }));
    const down = evaluateForklift(P, fkInputs({ liftHeight: 2, terrain: slope(8, 180) }));
    const up = evaluateForklift(P, fkInputs({ liftHeight: 2, terrain: slope(8, 0) }));
    const h = level.stability.cg.combined.cg.z, x = level.stability.cg.combined.cg.x;
    close(down.stability.gravityEval.groundIntersection!.x, x + h * Math.tan(rad(8)), 1e-9);
    close(up.stability.gravityEval.groundIntersection!.x, x - h * Math.tan(rad(8)), 1e-9);
    // the mass centre itself did not move
    close(down.stability.cgUnrolled.combined.cg.x, x, 1e-12);
    const ex = explainChange(level.stability, down.stability);
    expect(ex.sentences.join(" ")).toMatch(/orientation changed/);
  });

  it("tyre reactions balance the normal load and the moments about both ground axes", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 1, terrain: slope(6, 180) }));
    const ev = s.stability.gravityEval, R = s.stability.reactions!;
    const W = s.stability.cg.combined.mass * G;
    close(R.reduce((a, r) => a + r.normal, 0), W * Math.cos(rad(6)), 1e-6);
    const pts: Record<string, { x: number; y: number }> = { FL: s.support.rigidLeft.p, FR: s.support.rigidRight.p, RL: s.support.oscLeft.p, RR: s.support.oscRight.p };
    close(R.reduce((a, r) => a + r.normal * pts[r.id]!.x, 0), ev.normalLoad * ev.groundIntersection!.x, 1e-6);
    close(R.reduce((a, r) => a + r.normal * pts[r.id]!.y, 0), ev.normalLoad * ev.groundIntersection!.y, 1e-6);
    // facing downhill, no lateral pull: rear tyres share equally
    close(R.find((r) => r.id === "RL")!.normal, R.find((r) => r.id === "RR")!.normal, 1e-6);
    // rear axle load from the moment about the front axle: N_rear = F_n · (−p.x) / wheelbase
    const rear = R.filter((r) => r.id.startsWith("R")).reduce((a, r) => a + r.normal, 0);
    close(rear, ev.normalLoad * (-ev.groundIntersection!.x) / P.geometry.wheelbase, 1e-6);
    close(ev.requiredFriction, Math.tan(rad(6)), 1e-9);
    expect(s.stability.slidingPredicted).toBe(false);
  });

  it("on a cross slope the downhill rear tyre carries more because rear friction acts below the pivot", () => {
    const s = evaluateForklift(P, fkInputs({ terrain: slope(5, 90) })); // pulls left
    const R = s.stability.reactions!;
    const rl = R.find((r) => r.id === "RL")!.normal, rr = R.find((r) => r.id === "RR")!.normal;
    const rear = rl + rr, F = s.stability.resultantEval.totalForce;
    close(rl - rr, (2 * P.geometry.rearAxlePivotHeight * F.y * rear) / (P.geometry.trackRear * s.stability.resultantEval.normalLoad), 1e-6);
    expect(rl).toBeGreaterThan(rr);
  });

  it("low friction surface: sliding is predicted before tipping", () => {
    const s = evaluateForklift(P, fkInputs({ terrain: slope(6, 180, 0.08) }));
    expect(s.stability.status).toBe("sliding-predicted");
    expect(s.stability.resultantEval.critical.margin).toBeGreaterThan(0);
  });

  it("cross slope, empty machine: the chassis rolls onto the rear-axle stop and rests on three wheels", () => {
    const s = evaluateForklift(P, fkInputs({ payload: null, terrain: slope(28, 90) })); // uphill on the right ⇒ gravity pulls left
    expect(s.stability.stage).toBe("axle-stop-left");
    expect(s.stability.liftedContact!.id).toBe("FR");
    expect(s.stability.liftedContactHeight).toBeGreaterThan(0);
    const fr = s.stability.reactions!.find((r) => r.id === "FR")!;
    close(fr.normal, 0); expect(fr.lifted).toBe(true);
    for (const r of s.stability.reactions!) expect(r.normal).toBeGreaterThanOrEqual(-1e-9);
    // the rolled CG sits lower than the unrolled one in the ground frame on the lifted side? No: it rotates about FL-P toward the left and down.
    expect(s.stability.cg.combined.cg.y).toBeGreaterThan(s.stability.cgUnrolled.combined.cg.y);
    expect(s.stability.notes[0]).toMatch(/stop engaged/);
    expect(s.stability.status).not.toBe("incipient-tipping");
    expect(s.stability.resultantEval.critical.id).toBe("FL-RL");
    // reactions still balance the normal load after the transition
    const W = s.stability.cg.combined.mass * G;
    close(s.stability.reactions!.reduce((a, r) => a + r.normal, 0), W * Math.cos(rad(28)), 1e-6);
  });

  it("rolling onto the stop is a rigid rotation: component spacings are preserved and the roll equals the stop angle", () => {
    const s = evaluateForklift(P, fkInputs({ payload: null, terrain: slope(28, 90) }));
    const a = s.components, b = s.stability.components;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      const da = Math.hypot(a[i]!.cg.x - a[j]!.cg.x, a[i]!.cg.y - a[j]!.cg.y, a[i]!.cg.z - a[j]!.cg.z);
      const db = Math.hypot(b[i]!.cg.x - b[j]!.cg.x, b[i]!.cg.y - b[j]!.cg.y, b[i]!.cg.z - b[j]!.cg.z);
      close(da, db, 1e-9);
    }
    close(s.stability.chassisRoll, P.geometry.rearAxleOscillationLimit);
    close(s.stability.cg.combined.mass, s.stability.cgUnrolled.combined.mass);
  });

  it("steeper cross slope: incipient tipping about the FL-RL axis with the stop engaged", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 4.0, terrain: slope(16, 90), allowOutsideLimits: true }));
    expect(s.stability.stage).toBe("axle-stop-left");
    expect(s.stability.status).toBe("incipient-tipping");
    expect(s.stability.resultantEval.critical.id).toBe("FL-RL");
  });

  it("offset load / side shift moves the combined CG laterally by Σ(mᵢyᵢ)/Σmᵢ", () => {
    const s = evaluateForklift(P, fkInputs({ sideShift: 0.1, payload: pallet(2000, { cgOffset: v(0, -0.2, 0) }) }));
    const m = s.stability.cg.combined.mass;
    // the carriage (and its forks) side-shift with the load; everything else stays on the centreline
    close(s.stability.cg.combined.cg.y, (2000 * (0.1 - 0.2) + P.masses.carriage.mass * 0.1) / m, 1e-9);
  });
});

describe("forklift: quasi-static inertial forces and load retention", () => {
  it("braking shifts the resultant forward by h·a/g without moving the mass centre", () => {
    const st = evaluateForklift(P, fkInputs({ liftHeight: 3 }));
    const br = evaluateForklift(P, fkInputs({ liftHeight: 3, acceleration: v(-3, 0, 0) }));
    const h = st.stability.cg.combined.cg.z;
    close(br.stability.cgUnrolled.combined.cg.x, st.stability.cg.combined.cg.x, 1e-12);
    close(br.stability.resultantEval.groundIntersection!.x, st.stability.gravityEval.groundIntersection!.x + h * 3 / G, 1e-9);
    close(br.stability.gravityEval.groundIntersection!.x, st.stability.gravityEval.groundIntersection!.x, 1e-9);
    expect(br.stability.quasiStatic).toBe(true);
    const ex = explainChange(st.stability, br.stability);
    expect(ex.sentences.join(" ")).toMatch(/inertial force/);
  });

  it("unsecured pallet: hard braking slides it forward on level forks; back tilt retains it", () => {
    const flat = evaluateForklift(P, fkInputs({ payload: pallet(1000, { loadFriction: 0.3 }), acceleration: v(-4, 0, 0) }));
    const r1 = forkliftLoadRetention(flat);
    expect(r1.status).toBe("sliding-predicted");
    close(r1.requiredFriction, 4 / G, 1e-9);
    expect(r1.slideDirection!.x).toBeGreaterThan(0.99);
    expect(flat.stability.status).toBe("within-boundary"); // machine fine, load not
    const tilted = evaluateForklift(P, fkInputs({ payload: pallet(1000, { loadFriction: 0.3 }), tiltBack: rad(10), acceleration: v(-4, 0, 0) }));
    const r2 = forkliftLoadRetention(tilted);
    const t = rad(10);
    close(r2.requiredFriction, (4 * Math.cos(t) - G * Math.sin(t)) / (G * Math.cos(t) + 4 * Math.sin(t)), 1e-9);
    expect(r2.status).toBe("retained");
    expect(forkliftLoadRetention(evaluateForklift(P, fkInputs({ payload: pallet(1000, { secured: true }), acceleration: v(-4, 0, 0) }))).status).toBe("secured");
  });

  it("tall narrow load topples on its base before the machine tips", () => {
    const s = evaluateForklift(P, fkInputs({ payload: pallet(600, { length: 0.6, height: 2.4, loadFriction: 0.6 }), acceleration: v(-4, 0, 0) }));
    const r = forkliftLoadRetention(s);
    expect(r.status).toBe("toppling-predicted");
    expect(r.footprintMargins.front).toBeLessThan(0);
    expect(s.stability.status).toBe("within-boundary");
  });

  it("empty versus loaded: the empty machine's CG sits further back and lower", () => {
    const e = evaluateForklift(P, fkInputs({ payload: null }));
    const l = evaluateForklift(P, fkInputs({ liftHeight: 2 }));
    expect(e.stability.cg.combined.cg.x).toBeLessThan(l.stability.cg.combined.cg.x);
    expect(e.stability.cg.payload.mass).toBe(0);
    expect(forkliftCompliance(e).status).toBe("within-manufacturer-limit");
  });

  it("inputs outside profile limits throw unless a trainer demonstration is declared, and are then reported", () => {
    expect(() => evaluateForklift(P, fkInputs({ liftHeight: 6 }))).toThrow(/outside profile limits/);
    const s = evaluateForklift(P, fkInputs({ liftHeight: 6, allowOutsideLimits: true }));
    expect(forkliftCompliance(s).restriction).toBe("operating-restriction-breached");
  });
});

describe("forklift: load retention on the tines", () => {
  it("a palletised load on a cross slope does not slide sideways (tines in pockets); an unrestrained pipe bundle does", () => {
    const pal = evaluateForklift(P, fkInputs({ payload: pallet(800, { loadFriction: 0.2 }), terrain: slope(15, 90), allowOutsideLimits: true }));
    expect(forkliftLoadRetention(pal).status).toBe("retained");
    const pipes = evaluateForklift(P, fkInputs({ payload: pallet(800, { loadFriction: 0.2, laterallyRestrained: false, height: 0.5 }), terrain: slope(15, 90), allowOutsideLimits: true }));
    const r = forkliftLoadRetention(pipes);
    expect(r.status).toBe("sliding-predicted");
    expect(Math.abs(r.requiredFriction - Math.tan(rad(15)))).toBeLessThan(0.02);
  });
  it("a tall pallet topples sideways over the outside of the tines when the slope exceeds atan(half-span / CG height)", () => {
    const H = 2.4, half = P.geometry.forkSpacing / 2 + 0.06;
    const lim = Math.atan(half / (H / 2)) * 180 / Math.PI;
    const below = evaluateForklift(P, fkInputs({ payload: pallet(600, { height: H, loadFriction: 0.6 }), tiltBack: 0, terrain: slope(lim - 1.5, 90), allowOutsideLimits: true }));
    const above = evaluateForklift(P, fkInputs({ payload: pallet(600, { height: H, loadFriction: 0.6 }), tiltBack: 0, terrain: slope(lim + 1.5, 90), allowOutsideLimits: true }));
    expect(forkliftLoadRetention(below).status).toBe("retained");
    expect(forkliftLoadRetention(above).status).toBe("toppling-predicted");
  });
});
