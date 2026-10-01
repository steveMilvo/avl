import { describe, it, expect } from "vitest";
import { evaluateForklift, evaluateLoader, forkliftDynamics, loaderDynamics, simulateTipOver, forkliftHull, rad, v, G, dot, rotateAboutLine, gravityDirInGroundFrame, scale, dataConfidence, loaderCompliance } from "../src/index.js";
import { forklift, loader, cat950f, fkInputs, ldInputs, pallet, bucketLoad, slope } from "./fixtures.js";

const P = forklift();

describe("tip-over dynamics: numerical checks", () => {
  const tipping = () => evaluateForklift(P, fkInputs({ payload: null, liftHeight: 0, terrain: slope(40, 90), allowOutsideLimits: true }));

  it("static limit: no rotation when the static evaluator is inside the boundary", () => {
    const s = evaluateForklift(P, fkInputs({ terrain: slope(5, 90) }));
    expect(s.stability.status).not.toBe("incipient-tipping");
    const d = forkliftDynamics(s, { behaviour: "belted" });
    expect(d.machineOutcome).toBe("stable");
    expect(d.peakTheta).toBe(0);
  });

  it("energy is conserved between tip start and ground strike (no releases, no manoeuvre)", () => {
    const s = tipping();
    expect(s.stability.status).toBe("incipient-tipping");
    const d = forkliftDynamics(s, { behaviour: "belted", dt: 5e-4 });
    expect(d.machineOutcome).toBe("overturned");
    const st = d.strike!;
    // independent PE drop: rotate every component by θ about the hinge
    const f = scale(gravityDirInGroundFrame(s.inputs.terrain), G);
    const pe = (th: number) => s.stability.components.reduce((a, c) => a - c.mass * dot(f, rotateAboutLine(c.cg, d.hinge.from, d.hinge.axis, th)), 0);
    const drop = pe(0) - pe(st.theta);
    expect(Math.abs(st.energy - drop) / drop).toBeLessThan(2e-3);
  });

  it("timestep convergence: strike time and angle change < 1 % when dt is quartered", () => {
    const s = tipping();
    const a = forkliftDynamics(s, { behaviour: "belted", dt: 1e-3 });
    const b = forkliftDynamics(s, { behaviour: "belted", dt: 2.5e-4 });
    expect(Math.abs(a.strike!.t - b.strike!.t) / b.strike!.t).toBeLessThan(0.01);
    expect(Math.abs(a.strike!.theta - b.strike!.theta) / b.strike!.theta).toBeLessThan(0.01);
  });

  it("matches the analytic single-mass inverted-pendulum energy result", () => {
    // One point mass 1 m above a hinge, 0.1 m outside it, on level ground: ω at θ equals sqrt(2 m g Δz / I).
    const s = evaluateForklift(P, fkInputs({ payload: null }));
    const stability = {
      ...s.stability,
      components: [{ id: "m", label: "m", group: "machine" as const, mass: 100, cg: v(0, 0.4, 1) }],
      roll: undefined,
      resultantEval: { ...s.stability.resultantEval, normal: v(0, 0, 1), critical: { ...s.stability.resultantEval.critical, id: "X", from: { id: "a", label: "a", p: v(-1, 0.5, 0) }, to: { id: "b", label: "b", p: v(1, 0.5, 0) }, axisDir: v(1, 0, 0) } },
    };
    const d = simulateTipOver({ stability, terrain: { slopeAngle: 0, heading: 0, friction: 1 }, gyration: { m: 0 }, hull: [{ id: "h", tag: "rops", label: "top", p: v(0, -0.5, 2) }], dt: 2.5e-4 });
    const st = d.strike!;
    const r = Math.hypot(0.1, 1), phi0 = Math.atan2(0.1, 1);
    const dz = r * Math.cos(phi0) - r * Math.cos(phi0 + st.theta);
    const omegaExpected = Math.sqrt(2 * 100 * G * dz / (100 * r * r));
    const omegaGot = Math.sqrt(2 * st.energy / (100 * r * r));
    expect(Math.abs(omegaGot - omegaExpected) / omegaExpected).toBeLessThan(1e-3);
  });
});

describe("tip-over dynamics: outcomes come from the model", () => {
  it("raised load + hard braking: the forklift lifts its rear and either drops back or tips, depending on the braking duration", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 3, payload: pallet(1500, { secured: true }), acceleration: v(-4, 0, 0) }));
    expect(s.stability.status).toBe("incipient-tipping");
    const short = forkliftDynamics(s, { behaviour: "belted", manoeuvre: { acceleration: v(-4, 0, 0), duration: 0.25 } });
    const long = forkliftDynamics(s, { behaviour: "belted", manoeuvre: { acceleration: v(-4, 0, 0), duration: 3 } });
    expect(short.machineOutcome).toBe("rocked-back");
    expect(long.peakTheta).toBeGreaterThan(short.peakTheta);
    expect(["rests-on-attachment", "overturned"]).toContain(long.machineOutcome);
  });

  it("unsecured load on the same braking event slides off the forks", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 3, payload: pallet(1500, { loadFriction: 0.3 }), acceleration: v(-4, 0, 0) }));
    const d = forkliftDynamics(s, { behaviour: "belted", manoeuvre: { acceleration: v(-4, 0, 0), duration: 1 } });
    expect(d.payloadOutcome.released).toBe(true);
    expect(d.events.some((e) => e.type === "payload-released")).toBe(true);
  });

  it("lateral overturn: belted operator retained; unbelted operator leaves the open-sided forklift; jumping toward the fall side lands in the entrapment zone", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 3.5, payload: pallet(1000, { secured: true }), terrain: slope(25, 90), allowOutsideLimits: true }));
    expect(s.stability.status).toBe("incipient-tipping");
    const belted = forkliftDynamics(s, { behaviour: "belted" });
    expect(belted.machineOutcome).toBe("overturned");
    expect(belted.operatorOutcome).toBe("retained-by-seatbelt");
    const unbelted = forkliftDynamics(s, { behaviour: "unbelted" });
    expect(["thrown-clear", "entrapment-zone"]).toContain(unbelted.operatorOutcome);
    expect(unbelted.operator.impactSpeed).toBeGreaterThan(0);
    const jumpFall = forkliftDynamics(s, { behaviour: "jump", jumpSide: "fall" });
    expect(jumpFall.operatorOutcome).toBe("entrapment-zone");
    const jumpHigh = forkliftDynamics(s, { behaviour: "jump", jumpSide: "high" });
    expect(jumpHigh.operatorOutcome).toBe("thrown-clear");
  });

  it("enclosed loader cab: unbelted operator is thrown inside the cab, not ejected", () => {
    const L = loader();
    const s = evaluateLoader(L, ldInputs({ articulation: rad(40), armAngle: rad(40), terrain: slope(40, -90), allowOutsideLimits: true }));
    expect(s.stability.status).toBe("incipient-tipping");
    const d = loaderDynamics(s, { behaviour: "unbelted" });
    expect(d.machineOutcome).toBe("overturned");
    expect(d.operatorOutcome).toBe("thrown-inside-cab");
    expect(d.payloadOutcome.released).toBe(true); // material spills as the bucket rolls over
  });

  it("hull includes guard, counterweight, mast head and fork tips", () => {
    const s = evaluateForklift(P, fkInputs());
    const tags = new Set(forkliftHull(P, s.inputs, s.geometry).map((h) => h.tag));
    for (const t of ["overhead-guard", "counterweight", "mast", "forks", "tyre"]) expect(tags.has(t)).toBe(true);
  });
});

describe("Cat 950F draft profile", () => {
  const C = cat950f();
  it("is labelled draft-unverified and has no rated operating load", () => {
    expect(dataConfidence(C as unknown as { meta: typeof C.meta } & Record<string, unknown>).label).toMatch(/Draft/);
    expect(loaderCompliance(evaluateLoader(C, ldInputs({ armAngle: rad(-20) }))).status).toBe("operating-limit-not-verified");
  });
  it("assumed component masses sum to the listed operating weight", () => {
    const s = evaluateLoader(C, ldInputs({ payload: null, armAngle: rad(-20) }));
    expect(Math.abs(s.stability.cg.machine.mass - 15730)).toBeLessThan(1e-9);
  });
  it("max lift puts the hinge pin at the listed 3953 mm", () => {
    const s = evaluateLoader(C, ldInputs({ armAngle: C.geometry.armAngleMax }));
    expect(Math.abs(s.geometry.bucketPivotHeight - 3.953)).toBeLessThan(0.005);
  });
});
