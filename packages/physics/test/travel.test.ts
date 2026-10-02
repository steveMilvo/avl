import { describe, it, expect } from "vitest";
import { evaluateForklift, evaluateLoader, forkliftDynamics, loaderDynamics, loaderTurnRadius, loaderKappa, rad, v, type TravelSpec } from "../src/index.js";
import { forklift, loader, fkInputs, ldInputs, pallet, bucketLoad, slope } from "./fixtures.js";

const P = forklift();
const kmh = (x: number) => x / 3.6;
const trip = (o: Partial<TravelSpec>): TravelSpec => ({ kind: "none", dir: 1, speed: 0, accel: 0, turnTime: 3, radius: 5, ...o });
const pos = (f: { travel: { t: { x: number; y: number } } }) => f.travel.t;

describe("travel: kinematics", () => {
  it("stationary on level ground: no movement, stays on its wheels", () => {
    const d = forkliftDynamics(evaluateForklift(P, fkInputs()), { behaviour: "belted", travel: trip({}) });
    expect(d.machineOutcome).toBe("stable");
    expect(Math.hypot(pos(d.frames.at(-1)!).x, pos(d.frames.at(-1)!).y)).toBeLessThan(1e-9);
  });

  it("braking: stopping distance = v·t_approach + v²/2a", () => {
    const sp = kmh(10), a = 2.5;
    const d = forkliftDynamics(evaluateForklift(P, fkInputs({ payload: pallet(800, { secured: true }) })), { behaviour: "belted", travel: trip({ kind: "brake", speed: sp, accel: a }) });
    expect(d.machineOutcome).toBe("stable");
    const x = pos(d.frames.at(-1)!).x;
    expect(Math.abs(x - (sp * 1.5 + (sp * sp) / (2 * a))) / x).toBeLessThan(0.01);
    expect(Math.abs(d.travelStats.peakDecel - a)).toBeLessThan(0.05);
  });

  it("reverse braking travels backwards", () => {
    const d = forkliftDynamics(evaluateForklift(P, fkInputs()), { behaviour: "belted", travel: trip({ kind: "brake", dir: -1, speed: kmh(6), accel: 2 }) });
    expect(pos(d.frames.at(-1)!).x).toBeLessThan(-2);
  });

  it("steady turn: the front-axle centre follows the set radius", () => {
    const R = 6, sp = kmh(6);
    const d = forkliftDynamics(evaluateForklift(P, fkInputs({ payload: null })), { behaviour: "belted", travel: trip({ kind: "turn", speed: sp, radius: R, turnTime: 4 }) });
    const full = d.frames.filter((f) => f.t > 1.5 + 0.8 + 0.2 && f.t < 1.5 + 0.8 + 4);
    // centre of the circle: front-axle centre + R to the left, in site coordinates
    const f0 = full[0]!, c = { x: f0.travel.t.x + R * f0.travel.R[0][1], y: f0.travel.t.y + R * f0.travel.R[1][1] };
    for (const f of full) expect(Math.abs(Math.hypot(f.travel.t.x - c.x, f.travel.t.y - c.y) - R)).toBeLessThan(0.005);
    // yaw rate v/R
    const yaw = (f: typeof f0) => Math.atan2(f.travel.R[1][0], f.travel.R[0][0]);
    const a = full[0]!, b = full[full.length - 1]!;
    let dy = yaw(b) - yaw(a); if (dy < 0) dy += 2 * Math.PI;
    expect(Math.abs(dy / (b.t - a.t) - sp / R)).toBeLessThan(0.01);
  });

  it("loader path curvature from articulation: equal half-wheelbases give R = l·cot(γ/2)", () => {
    const l = 1.5, g = rad(30);
    expect(Math.abs(1 / loaderKappa(l, -l, g) - l / Math.tan(g / 2))).toBeLessThan(1e-9);
    const L = loader();
    expect(loaderTurnRadius(L, rad(40))).toBeGreaterThan(3);
  });
});

describe("travel: outcomes come from speed, radius and load", () => {
  it("turning with a raised load: stays upright slowly, rolls over faster on the same radius", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 2, payload: pallet(1000, { secured: true }) }));
    const slow = forkliftDynamics(s, { behaviour: "belted", travel: trip({ kind: "turn", speed: kmh(7), radius: 4 }) });
    const fast = forkliftDynamics(s, { behaviour: "belted", travel: trip({ kind: "turn", speed: kmh(15), radius: 4 }) });
    expect(slow.machineOutcome).toBe("stable");
    expect(["overturned", "leaning"]).toContain(fast.machineOutcome);
    // it tips toward the outside of a left turn: about a right-side axis
    expect(fast.hinge.id).toMatch(/FR|RR/);
    const tipT = fast.events.find((e) => e.type === "tip-start")!.t;
    expect(tipT).toBeGreaterThan(1.5); // only once the turn has begun
  });

  it("braking with a raised load: hard braking pitches it forward, gentle braking does not", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 3.5, payload: pallet(1500, { secured: true }) }));
    const hard = forkliftDynamics(s, { behaviour: "belted", travel: trip({ kind: "brake", speed: kmh(12), accel: 4 }) });
    const soft = forkliftDynamics(s, { behaviour: "belted", travel: trip({ kind: "brake", speed: kmh(12), accel: 1 }) });
    expect(hard.machineOutcome).not.toBe("stable");
    expect(hard.hinge.id).toBe("FR-FL");
    expect(soft.machineOutcome).toBe("stable");
  });

  it("unsecured load slides off under braking while the machine stays upright", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 0.15, payload: pallet(1000, { loadFriction: 0.3 }) }));
    const d = forkliftDynamics(s, { behaviour: "belted", travel: trip({ kind: "brake", speed: kmh(12), accel: 4 }) });
    expect(d.machineOutcome).toBe("stable");
    expect(d.payloadOutcome.released).toBe(true);
    expect(d.payloadOutcome.landedAt!.x).toBeGreaterThan(2); // carried forward by the machine's speed
  });

  it("low friction: the machine skids instead of tipping", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 2, payload: pallet(1000, { secured: true }), terrain: slope(0, 0, 0.15) }));
    const d = forkliftDynamics(s, { behaviour: "belted", travel: trip({ kind: "turn", speed: kmh(15), radius: 4 }) });
    expect(d.machineOutcome).toBe("slid");
    expect(d.events.some((e) => e.type === "skid")).toBe(true);
  });

  it("parked on an icy slope it slides downhill", () => {
    const d = forkliftDynamics(evaluateForklift(P, fkInputs({ terrain: slope(7, 180, 0.1), allowOutsideLimits: true })), { behaviour: "belted", travel: trip({}) });
    expect(d.machineOutcome).toBe("slid");
    expect(pos(d.frames.at(-1)!).x).toBeGreaterThan(0.5); // facing downhill: slides forward
  });

  it("loader: the articulated turn reaches the radius set by the articulation", () => {
    const L = loader();
    const d = loaderDynamics(evaluateLoader(L, ldInputs({ articulation: rad(30), payload: bucketLoad({ mass: 1000 }) })), { behaviour: "belted", travel: trip({ kind: "turn", speed: kmh(6), turnTime: 3 }) });
    const f = d.frames.find((x) => x.t > 2.6)!;
    expect(Math.abs(f.motion.radius - loaderTurnRadius(L, rad(30)))).toBeLessThan(1e-6);
    expect(Math.abs(f.motion.steer - rad(30))).toBeLessThan(1e-9);
    expect(d.machineOutcome).toBe("stable");
  });
});

describe("travel: unbelted operator", () => {
  it("forklift pitching forward under braking throws an unbelted operator out of the seat; a belted one stays", () => {
    const s = evaluateForklift(P, fkInputs({ liftHeight: 3.5, payload: pallet(1500, { secured: true }) }));
    const tr = trip({ kind: "brake", speed: kmh(12), accel: 4 });
    expect(forkliftDynamics(s, { behaviour: "unbelted", travel: tr }).operatorOutcome).not.toMatch(/seat/);
    expect(forkliftDynamics(s, { behaviour: "belted", travel: tr }).operatorOutcome).toBe("retained-by-seatbelt");
  });
  it("loader rollover: an unbelted operator is thrown about inside the cab and strikes its structure", () => {
    const L = loader();
    const s = evaluateLoader(L, ldInputs({ articulation: rad(-40), armAngle: rad(40), terrain: slope(30, -90), allowOutsideLimits: true }));
    const d = loaderDynamics(s, { behaviour: "unbelted", travel: trip({}) });
    expect(d.operatorOutcome).toBe("thrown-inside-cab");
    expect(d.operator.impactSpeed!).toBeGreaterThan(0.5);
    const g = L.geometry;
    for (const f of d.frames) if (f.operator?.local) {
      expect(f.operator.local.x).toBeGreaterThanOrEqual(g.cab.rearX); expect(f.operator.local.x).toBeLessThanOrEqual(g.cab.frontX);
      expect(Math.abs(f.operator.local.y)).toBeLessThanOrEqual(g.cab.width / 2);
    }
  });
});
