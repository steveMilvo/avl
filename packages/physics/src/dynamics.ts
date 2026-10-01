import { type Vec3, v, add, sub, scale, dot, cross, norm, normalize, rotateAboutLine, axisAngle, apply } from "./math.js";
import { type MassComponent } from "./mass.js";
import { type StabilityResult, applyRoll } from "./stability.js";
import { type Terrain, gravityDirInGroundFrame } from "./terrain.js";
import { G } from "./units.js";

/**
 * Tip-over dynamics (model scope documented in docs/05-model-scope.md).
 *
 * Once the static/quasi-static evaluator finds the resultant outside a support edge, the machine
 * is modelled as a single rigid body rotating about that edge (the hinge), which stays in contact
 * with the ground and does not slide. Equation of motion about the hinge axis u:
 *
 *     I_u · θ̈ = Σ ((rᵢ(θ) − h) × mᵢ fᵢ(t)) · u ,  fᵢ = g·ĝ − a(t)
 *
 * I_u = Σ mᵢ (dᵢ² + kᵢ²): point-mass distances plus a radius of gyration per component.
 * Fixed timestep, RK4. The body returns to its support if θ falls back to 0 (plastic contact).
 * The run ends when any structural hull point reaches the ground plane.
 *
 * Unsecured payloads and unbelted/jumping operators separate from the body when their contact
 * conditions fail (friction / normal force at their support, including the body's rotational
 * acceleration). A separating mass keeps its velocity (no impulse), so ω is unchanged and only
 * I_u and the moment change. Separated masses follow ballistic paths in the machine's frame.
 *
 * Not modelled: post-impact rolling or bouncing, tyre compliance, hinge sliding, structural
 * deformation, human body dynamics beyond a point mass. Consequence descriptions are mechanical
 * facts (heights, speeds, positions), never injury predictions.
 */
export interface HullPoint { id: string; tag: string; label: string; p: Vec3 }

export type OperatorBehaviour = "belted" | "unbelted" | "jump";

export interface OperatorSetup {
  /** Hip point in the ground frame (unrolled). */
  seat: Vec3;
  mass: number;
  behaviour: OperatorBehaviour;
  /** Enclosed cab with door closed: an unbelted operator is thrown about inside the cab but not ejected. */
  enclosedCab: boolean;
  seatFriction: number;
  /** Seconds between the start of tipping and the jump (reaction time). */
  reactionTime: number;
  jumpSpeed: number;
  /** "fall" = toward the side the machine is falling to; "high" = away from it. */
  jumpSide: "fall" | "high";
}

export interface PayloadReleaseSetup {
  mode: "rigid" | "granular";
  secured: boolean;
  /** Load-support surface normal and outward (load-leaving) direction, ground frame, unrolled. */
  normal: Vec3;
  outward: Vec3;
  friction: number;
  angleOfRepose: number;
  /** Rigid load: hull corners (ground frame, unrolled), used for ground strike while attached. */
  hull: HullPoint[];
  /** Half the load's height, used to place the landed load on the ground. */
  halfHeight: number;
}

export interface DynamicsSetup {
  stability: StabilityResult;
  terrain: Terrain;
  hull: HullPoint[];
  gyration?: Record<string, number>;
  /** Machine acceleration in the ground frame as a function of time (m/s²). */
  accel?: (t: number) => Vec3;
  payload?: PayloadReleaseSetup;
  operator?: OperatorSetup;
  dt?: number;
  tEnd?: number;
  frameDt?: number;
}

export interface BodyState { attached: boolean; p: Vec3; v: Vec3; landed: boolean }

export interface DynFrame {
  t: number;
  /** True for post-impact settling frames, which are a kinematic estimate rather than simulated. */
  kinematic: boolean;
  theta: number;
  omega: number;
  payload: BodyState | undefined;
  operator: BodyState | undefined;
}

export type DynEventType =
  | "tip-start" | "wheel-lift" | "payload-released" | "payload-landed" | "operator-released"
  | "operator-jumped" | "operator-landed" | "settled-back" | "ground-strike" | "end";

export interface DynEvent { t: number; type: DynEventType; text: string }

export type MachineOutcome = "stable" | "rocked-back" | "rests-on-attachment" | "overturned" | "still-tipping";
export type OperatorOutcome =
  | "none" | "retained-by-seatbelt" | "thrown-inside-cab" | "remained-in-seat"
  | "thrown-clear" | "entrapment-zone";

export interface DynamicsResult {
  hinge: { from: Vec3; axis: Vec3; id: string; label: string };
  frames: DynFrame[];
  events: DynEvent[];
  machineOutcome: MachineOutcome;
  peakTheta: number;
  strike: { point: HullPoint; theta: number; t: number; speed: number; energy: number } | undefined;
  /** Estimated resting angle about the hinge after impact (kinematic estimate). */
  restTheta: number;
  payloadOutcome: { released: boolean; landedAt?: Vec3; impactSpeed?: number; dropHeight?: number };
  operatorOutcome: OperatorOutcome;
  operator: { landedAt?: Vec3; impactSpeed?: number; fallHeight?: number; under?: string };
  dt: number;
  summary: string[];
}

const DEFAULT_K = 0.35;

interface Mass { id: string; m: number; r: Vec3; k: number }

export const simulateTipOver = (setup: DynamicsSetup): DynamicsResult => {
  const st = setup.stability;
  const dt = setup.dt ?? 1e-3;
  const tEnd = setup.tEnd ?? 6;
  const frameDt = setup.frameDt ?? 1 / 120;
  const gDir = gravityDirInGroundFrame(setup.terrain);
  const accel = setup.accel ?? (() => v(0, 0, 0));
  const spec = (t: number) => sub(scale(gDir, G), accel(t));

  const crit = st.resultantEval.critical;
  const h = crit.from.p;
  const u = crit.axisDir;
  const inward = cross(st.resultantEval.normal, u);
  const hinge = { from: h, axis: u, id: crit.id, label: `${crit.from.label} – ${crit.to.label}` };

  const roll = (p: Vec3) => applyRoll(st, p);
  const rotP = (p: Vec3, th: number) => rotateAboutLine(p, h, u, th);
  const rotD = (d: Vec3, th: number) => apply(axisAngle(u, th), d);

  // Body masses (already rolled by the static evaluator).
  const gyr = setup.gyration ?? {};
  let masses: Mass[] = st.components.map((c: MassComponent) => ({ id: c.id, m: c.mass, r: c.cg, k: gyr[c.id] ?? DEFAULT_K }));
  const removeMass = (id: string) => { masses = masses.filter((x) => x.id !== id); };

  const distAxis = (r: Vec3) => { const d = sub(r, h); return norm(sub(d, scale(u, dot(d, u)))); };
  const inertia = () => masses.reduce((s, x) => s + x.m * (distAxis(x.r) ** 2 + x.k ** 2), 0);
  const moment = (th: number, t: number) => {
    const f = spec(t);
    return masses.reduce((s, x) => s + dot(cross(sub(rotP(x.r, th), h), scale(f, x.m)), u), 0);
  };
  let I = inertia();
  const thetaDD = (th: number, t: number) => moment(th, t) / I;

  const hull = setup.hull.map((p) => ({ ...p, p: roll(p.p) })).filter((p) => distAxis(p.p) > 0.05);
  const payloadHull = (setup.payload?.hull ?? []).map((p) => ({ ...p, p: roll(p.p) }));

  // Payload state
  const P = setup.payload;
  const payloadComp = st.components.find((c) => c.id === "payload");
  let payload: BodyState | undefined = payloadComp ? { attached: true, p: payloadComp.cg, v: v(0, 0, 0), landed: false } : undefined;
  const pNormalR = P ? (st.roll ? apply(axisAngle(st.roll.axis, st.roll.angle), P.normal) : P.normal) : undefined;
  const pOutR = P ? (st.roll ? apply(axisAngle(st.roll.axis, st.roll.angle), P.outward) : P.outward) : undefined;
  let payloadDrop = 0;

  // Operator state
  const O = setup.operator;
  const opComp = st.components.find((c) => c.id === "operator");
  const seatR = O ? roll(O.seat) : undefined;
  const seatNR = st.roll ? apply(axisAngle(st.roll.axis, st.roll.angle), v(0, 0, 1)) : v(0, 0, 1);
  const seatLR = st.roll ? apply(axisAngle(st.roll.axis, st.roll.angle), v(0, 1, 0)) : v(0, 1, 0);
  let operator: BodyState | undefined = O && seatR ? { attached: true, p: seatR, v: v(0, 0, 0), landed: false } : undefined;
  let opMaxZ = seatR?.z ?? 0;

  let theta = 0, omega = 0, t = 0;
  let tipStart: number | undefined;
  let peakTheta = 0;
  const events: DynEvent[] = [];
  const frames: DynFrame[] = [];
  let nextFrame = 0;
  let strike: DynamicsResult["strike"];
  let settled = false;
  let restTheta = 0;
  let settleRate = 0;
  const REST_TAGS = new Set(["overhead-guard", "rops", "mast", "forks", "bucket", "payload"]);

  const pointAccel = (r: Vec3, th: number, w: number, a: number): Vec3 => {
    const d = sub(rotP(r, th), h);
    return add(scale(cross(u, d), a), scale(cross(u, cross(u, d)), w * w));
  };
  const pointVel = (r: Vec3, th: number, w: number): Vec3 => scale(cross(u, sub(rotP(r, th), h)), w);

  let kinematic = false;
  const snapshot = () => frames.push({
    t, theta, omega, kinematic,
    payload: payload ? { ...payload, p: payload.attached ? rotP(payload.p, theta) : payload.p } : undefined,
    operator: operator ? { ...operator, p: operator.attached ? rotP(operator.p, theta) : operator.p } : undefined,
  });

  const releaseFree = (b: BodyState, r: Vec3): BodyState => ({ attached: false, p: rotP(r, theta), v: pointVel(r, theta, omega), landed: false });

  const stepFree = (b: BodyState, groundZ: number): boolean => {
    if (b.landed || b.attached) return false;
    const f = spec(t);
    b.v = add(b.v, scale(f, dt));
    b.p = add(b.p, scale(b.v, dt));
    if (b.p.z <= groundZ) { b.p = { ...b.p, z: groundZ }; b.landed = true; return true; }
    return false;
  };

  let landedSpeedPayload = 0, landedSpeedOp = 0;
  const fmt = (x: number, d = 1) => x.toFixed(d);

  while (t <= tEnd + 1e-12) {
    if (t + 1e-12 >= nextFrame) { snapshot(); nextFrame += frameDt; }

    // --- separation checks (use current angular acceleration) ---
    const aNow = strike || settled ? 0 : thetaDD(theta, t);
    const f = spec(t);
    if (P && payload?.attached && !P.secured && payloadComp && pNormalR && pOutR) {
      const fl = sub(f, pointAccel(payloadComp.cg, theta, omega, aNow));
      const n = rotD(pNormalR, theta), o = rotD(pOutR, theta);
      let release = false;
      if (P.mode === "rigid") {
        const lat = normalize(cross(n, o));
        const N = -dot(fl, n), To = dot(fl, o), Tl = dot(fl, lat);
        release = N <= 0 || (To > 0 ? Math.hypot(To, Tl) > P.friction * N : Math.abs(Tl) > P.friction * N);
      } else {
        const slope = Math.asin(Math.max(-1, Math.min(1, dot(o, normalize(fl)))));
        release = slope > P.angleOfRepose;
      }
      if (release && (tipStart !== undefined || t === 0)) {
        payloadDrop = rotP(payloadComp.cg, theta).z;
        payload = releaseFree(payload, payloadComp.cg);
        removeMass("payload"); I = inertia();
        events.push({ t, type: "payload-released", text: P.mode === "rigid" ? `Unsecured load slid off at ${fmt(theta * 180 / Math.PI)}° of tip, from ${fmt(payloadDrop)} m.` : `Bucket load spilled at ${fmt(theta * 180 / Math.PI)}° of tip.` });
      }
    }
    if (O && operator?.attached && seatR && O.behaviour !== "belted") {
      let leave = false, jump = false;
      if (O.behaviour === "jump" && tipStart !== undefined && t - tipStart >= O.reactionTime && !strike && !settled) { leave = true; jump = true; }
      else if (O.behaviour === "unbelted" && !O.enclosedCab && tipStart !== undefined) {
        const fo = sub(f, pointAccel(seatR, theta, omega, aNow));
        const n = rotD(seatNR, theta), l = rotD(seatLR, theta);
        const N = -dot(fo, n), Tl = dot(fo, l);
        leave = N <= 0 || Math.abs(Tl) > O.seatFriction * N;
      }
      if (leave) {
        operator = releaseFree(operator, seatR);
        if (jump) {
          const side = O.jumpSide === "fall" ? scale(inward, -1) : inward;
          const horiz = normalize(sub(side, scale(st.resultantEval.normal, dot(side, st.resultantEval.normal))));
          operator.v = add(operator.v, add(scale(horiz, O.jumpSpeed), scale(st.resultantEval.normal, 1.0)));
          events.push({ t, type: "operator-jumped", text: `Operator jumped toward the ${O.jumpSide === "fall" ? "side the machine is falling to" : "high side"} ${fmt(t - (tipStart ?? 0), 2)} s after tipping began.` });
        } else events.push({ t, type: "operator-released", text: `Unbelted operator slid off the seat at ${fmt(theta * 180 / Math.PI)}° of tip.` });
        if (opComp) { removeMass("operator"); I = inertia(); }
      }
    }

    // --- free bodies ---
    if (payload && stepFree(payload, P?.halfHeight ?? 0.2)) {
      landedSpeedPayload = norm(payload.v);
      events.push({ t, type: "payload-landed", text: `Load struck the ground at ${fmt(landedSpeedPayload)} m/s.` });
      payload.v = v(0, 0, 0);
    }
    if (operator && !operator.attached) {
      opMaxZ = Math.max(opMaxZ, operator.p.z);
      if (stepFree(operator, 0.15)) {
        landedSpeedOp = norm(operator.v);
        events.push({ t, type: "operator-landed", text: `Operator struck the ground at ${fmt(landedSpeedOp)} m/s after a fall from ${fmt(opMaxZ)} m.` });
        operator.v = v(0, 0, 0);
      }
    }

    if (strike || settled) {
      if (strike && theta < restTheta - 1e-9) {
        kinematic = true;
        theta = Math.min(restTheta, theta + settleRate * dt);
        omega = settleRate;
      } else omega = 0;
      const freeMoving = (payload && !payload.attached && !payload.landed) || (operator && !operator.attached && !operator.landed);
      if (!freeMoving && !(strike && theta < restTheta - 1e-9)) { t += dt; break; }
      t += dt; continue;
    }

    // --- body: RK4 ---
    const k1t = omega, k1w = thetaDD(theta, t);
    const k2t = omega + 0.5 * dt * k1w, k2w = thetaDD(theta + 0.5 * dt * k1t, t + dt / 2);
    const k3t = omega + 0.5 * dt * k2w, k3w = thetaDD(theta + 0.5 * dt * k2t, t + dt / 2);
    const k4t = omega + dt * k3w, k4w = thetaDD(theta + dt * k3t, t + dt);
    let nTheta = theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    let nOmega = omega + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    if (nTheta <= 0) {
      if (theta > 0 && peakTheta > 1e-3) {
        events.push({ t, type: "settled-back", text: `Machine dropped back onto its wheels after lifting ${fmt(peakTheta * 180 / Math.PI)}°.` });
        settled = true;
      }
      nTheta = 0; nOmega = Math.max(0, nOmega);
    }
    theta = nTheta; omega = nOmega; t += dt;
    if (theta > 1e-4 && tipStart === undefined) {
      tipStart = t;
      events.push({ t, type: "tip-start", text: `Machine began to rotate about the ${hinge.label} axis.` });
    }
    peakTheta = Math.max(peakTheta, theta);

    // --- ground strike ---
    const all = payload?.attached ? [...hull, ...payloadHull] : hull;
    for (const hp of all) {
      const q = rotP(hp.p, theta);
      if (q.z < -1e-4) {
        const sp = norm(pointVel(hp.p, theta, omega));
        strike = { point: hp, theta, t, speed: sp, energy: 0.5 * I * omega * omega };
        events.push({ t, type: "ground-strike", text: `${hp.label} struck the ground at ${fmt(sp)} m/s, ${fmt(theta * 180 / Math.PI)}° from upright.` });
        restTheta = theta;
        if (!REST_TAGS.has(hp.tag)) {
          // Kinematic estimate: keep rotating about the hinge until protective structure or the attachment reaches the ground.
          const cands = all.filter((x) => REST_TAGS.has(x.tag));
          for (let th = theta; th < Math.PI; th += 0.002) {
            if (cands.some((x) => rotP(x.p, th).z <= 0)) { restTheta = th; break; }
          }
          settleRate = Math.max(0.6 * omega, 0.8);
          if (restTheta > theta + 1e-3) events.push({ t, type: "ground-strike", text: `Estimated resting position: ${fmt(restTheta * 180 / Math.PI)}° from upright, on the ${(cands.find((x) => rotP(x.p, restTheta).z <= 1e-3)?.label ?? "structure").toLowerCase()} (post-impact motion estimated, not simulated).` });
        }
        break;
      }
    }
  }
  snapshot();

  // --- outcomes ---
  let machineOutcome: MachineOutcome;
  if (peakTheta < 1e-4) machineOutcome = "stable";
  else if (settled) machineOutcome = "rocked-back";
  else if (strike) machineOutcome = strike.point.tag === "forks" || strike.point.tag === "bucket" || strike.point.tag === "payload" ? "rests-on-attachment" : "overturned";
  else machineOutcome = "still-tipping";

  let operatorOutcome: OperatorOutcome = "none";
  const opInfo: DynamicsResult["operator"] = {};
  if (O && operator) {
    if (operator.attached) {
      operatorOutcome = machineOutcome === "overturned"
        ? (O.behaviour === "belted" ? "retained-by-seatbelt" : "thrown-inside-cab")
        : "remained-in-seat";
    } else {
      opInfo.landedAt = operator.p; opInfo.impactSpeed = landedSpeedOp; opInfo.fallHeight = opMaxZ;
      operatorOutcome = "thrown-clear";
      if (machineOutcome === "overturned") {
        // Footprint of structure lying near the ground at the final pose.
        const low = hull.map((hp) => ({ hp, q: rotP(hp.p, restTheta) })).filter((x) => x.q.z < 0.8);
        const poly = convexHull2D([...low.map((x) => x.q), h, add(h, u)]);
        if (pointInPolygon2D(operator.p, poly)) {
          operatorOutcome = "entrapment-zone";
          const nearest = low.reduce((a, b) => (dist2(b.q, operator!.p) < dist2(a.q, operator!.p) ? b : a), low[0]!);
          opInfo.under = nearest?.hp.label;
        }
      }
    }
  }

  const summary: string[] = [];
  const deg = (r: number) => `${fmt(r * 180 / Math.PI)}°`;
  if (machineOutcome === "stable") summary.push("The machine stayed on its support.");
  if (machineOutcome === "rocked-back") summary.push(`The machine lifted ${deg(peakTheta)} about the ${hinge.label} axis, then dropped back.`);
  if (machineOutcome === "rests-on-attachment") summary.push(`The machine tipped about the ${hinge.label} axis until the ${strike!.point.label.toLowerCase()} hit the ground at ${deg(strike!.theta)}.`);
  if (machineOutcome === "overturned") summary.push(`The machine overturned about the ${hinge.label} axis. The ${strike!.point.label.toLowerCase()} struck the ground at ${fmt(strike!.speed)} m/s.`);
  if (machineOutcome === "still-tipping") summary.push(`The machine was still rotating when the simulation ended.`);
  if (payload && !payload.attached) summary.push(`The load left the ${P?.mode === "granular" ? "bucket" : "forks"} and fell ${fmt(payloadDrop)} m.`);
  if (operatorOutcome === "retained-by-seatbelt") summary.push("The seatbelt held the operator inside the protective structure.");
  if (operatorOutcome === "thrown-inside-cab") summary.push("The unbelted operator was thrown about inside the closed cab.");
  if (operatorOutcome === "thrown-clear") summary.push(`The operator left the machine and hit the ground at ${fmt(landedSpeedOp)} m/s.`);
  if (operatorOutcome === "entrapment-zone") summary.push(`The operator landed in the zone the overturned machine came down on, near the ${opInfo.under?.toLowerCase()}. This is an entrapment and crush zone.`);

  return {
    hinge, frames, events, machineOutcome, peakTheta, strike, restTheta,
    payloadOutcome: payload && !payload.attached ? { released: true, landedAt: payload.p, impactSpeed: landedSpeedPayload, dropHeight: payloadDrop } : { released: false },
    operatorOutcome, operator: opInfo, dt, summary,
  };
};

const dist2 = (a: Vec3, b: Vec3) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const convexHull2D = (pts: Vec3[]): Vec3[] => {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const crossZ = (o: Vec3, a: Vec3, b: Vec3) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec3[] = [], upper: Vec3[] = [];
  for (const q of p) { while (lower.length >= 2 && crossZ(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && crossZ(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

export const pointInPolygon2D = (q: Vec3, poly: Vec3[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a.y > q.y) !== (b.y > q.y) && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/** Potential energy of a set of masses in the specific-force field (for energy checks). */
export const potentialEnergy = (masses: { mass: number; cg: Vec3 }[], f: Vec3): number =>
  masses.reduce((s, m) => s - m.mass * dot(f, m.cg), 0);
