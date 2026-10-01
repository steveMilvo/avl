import { type Vec3, type Frame, v, add, sub, scale, dot, cross, norm, normalize, rotateAboutLine, axisAngle, apply, compose, transformPoint, IDENTITY_FRAME } from "./math.js";
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
 *
 * Multi-stage contact: when a structural hull point reaches the ground, the impact is treated as
 * plastic (no bounce) and the machine continues about the edge of the new contact triangle that the
 * resultant lies outside, with angular velocity from conservation of angular momentum about that edge.
 * If the resultant lies inside the new triangle the machine comes to rest there.
 *
 * Unsecured payloads and unbelted/jumping operators separate from the body when their contact
 * conditions fail (friction / normal force at their support, including the body's rotational
 * acceleration). A separating mass keeps its velocity (no impulse), so ω is unchanged and only
 * I_u and the moment change. Separated masses follow ballistic paths in the machine's frame.
 *
 * Not modelled: bouncing, sliding of contacts, tyre compliance, structural
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
  /** Rigid fork loads: full retention check given the specific force in the carriage frame (x out, y left, z normal). */
  forkCheck?: (fl: Vec3) => { release: boolean; why: string };
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
  /** Rigid transform of the machine body (ground frame, applied to the as-evaluated rolled geometry). */
  pose: Frame;
  /** Rotation angle about the current hinge in this stage, and its rate. */
  theta: number;
  omega: number;
  hinge: number;
  payload: BodyState | undefined;
  operator: BodyState | undefined;
}

export type DynEventType =
  | "tip-start" | "payload-released" | "payload-landed" | "operator-released"
  | "operator-jumped" | "operator-landed" | "settled-back" | "ground-strike" | "new-hinge" | "came-to-rest" | "end";

export interface DynEvent { t: number; type: DynEventType; text: string; at?: Vec3; speed?: number }

export type MachineOutcome = "stable" | "rocked-back" | "leaning" | "rests-on-attachment" | "overturned" | "still-tipping";
export type OperatorOutcome =
  | "none" | "retained-by-seatbelt" | "thrown-inside-cab" | "remained-in-seat"
  | "thrown-clear" | "entrapment-zone";

export interface Hinge { from: Vec3; to: Vec3; axis: Vec3; id: string; label: string }

export interface DynamicsResult {
  /** First tipping axis. */
  hinge: Hinge;
  hinges: Hinge[];
  frames: DynFrame[];
  events: DynEvent[];
  machineOutcome: MachineOutcome;
  peakTheta: number;
  /** Final tilt of the body's up axis from the ground normal (rad). */
  finalTilt: number;
  finalPose: Frame;
  strike: { point: HullPoint; theta: number; t: number; speed: number; energy: number } | undefined;
  restingOn: string[];
  payloadOutcome: { released: boolean; landedAt?: Vec3; impactSpeed?: number; dropHeight?: number };
  operatorOutcome: OperatorOutcome;
  operator: { landedAt?: Vec3; impactSpeed?: number; fallHeight?: number; under?: string };
  dt: number;
  summary: string[];
}

const DEFAULT_K = 0.35;
const MAX_STAGES = 8;

interface Mass { id: string; m: number; r: Vec3; k: number }

const rotFrame = (pt: Vec3, u: Vec3, th: number): Frame => { const R = axisAngle(u, th); return { R, t: sub(pt, apply(R, pt)) }; };

export const simulateTipOver = (setup: DynamicsSetup): DynamicsResult => {
  const st = setup.stability;
  const dt = setup.dt ?? 1e-3;
  const tEnd = setup.tEnd ?? 6;
  const frameDt = setup.frameDt ?? 1 / 120;
  const gDir = gravityDirInGroundFrame(setup.terrain);
  const accel = setup.accel ?? (() => v(0, 0, 0));
  const spec = (t: number) => sub(scale(gDir, G), accel(t));
  const fmt = (x: number, d = 1) => x.toFixed(d);
  const degS = (r: number) => `${fmt(r * 180 / Math.PI)}°`;

  const crit = st.resultantEval.critical;
  const firstHinge: Hinge = { from: crit.from.p, to: crit.to.p, axis: crit.axisDir, id: crit.id, label: `${crit.from.label} – ${crit.to.label}` };
  const hinges: Hinge[] = [firstHinge];
  let H = firstHinge;
  let X0: Frame = IDENTITY_FRAME;                     // body pose at the start of the current stage
  const X = (th: number): Frame => compose(rotFrame(H.from, H.axis, th), X0);
  const worldP = (p: Vec3, th: number) => transformPoint(X(th), p);
  const worldD = (d: Vec3, th: number) => apply(X(th).R, d);

  const roll = (p: Vec3) => applyRoll(st, p);
  const rollD = (d: Vec3) => (st.roll ? apply(axisAngle(st.roll.axis, st.roll.angle), d) : d);
  const gyr = setup.gyration ?? {};
  let masses: Mass[] = st.components.map((c: MassComponent) => ({ id: c.id, m: c.mass, r: c.cg, k: gyr[c.id] ?? DEFAULT_K }));
  const removeMass = (id: string) => { masses = masses.filter((x) => x.id !== id); };

  const distAxisW = (q: Vec3) => { const d = sub(q, H.from); return norm(sub(d, scale(H.axis, dot(d, H.axis)))); };
  const inertia = () => masses.reduce((s, x) => s + x.m * (distAxisW(transformPoint(X0, x.r)) ** 2 + x.k ** 2), 0);
  const moment = (th: number, t: number) => {
    const f = spec(t);
    return masses.reduce((s, x) => s + dot(cross(sub(worldP(x.r, th), H.from), scale(f, x.m)), H.axis), 0);
  };
  let I = inertia();
  const thetaDD = (th: number, t: number) => moment(th, t) / I;

  const hull = setup.hull.map((p) => ({ ...p, p: roll(p.p) }));
  const payloadHull = (setup.payload?.hull ?? []).map((p) => ({ ...p, p: roll(p.p) }));

  const P = setup.payload;
  const payloadComp = st.components.find((c) => c.id === "payload");
  let payload: BodyState | undefined = payloadComp ? { attached: true, p: payloadComp.cg, v: v(0, 0, 0), landed: false } : undefined;
  const pNormalB = P ? rollD(P.normal) : undefined, pOutB = P ? rollD(P.outward) : undefined;
  let payloadDrop = 0;

  const O = setup.operator;
  const opComp = st.components.find((c) => c.id === "operator");
  const seatB = O ? roll(O.seat) : undefined;
  const seatNB = rollD(v(0, 0, 1)), seatLB = rollD(v(0, 1, 0));
  let operator: BodyState | undefined = O && seatB ? { attached: true, p: seatB, v: v(0, 0, 0), landed: false } : undefined;
  let opMaxZ = seatB?.z ?? 0;

  let theta = 0, omega = 0, t = 0, stage = 0;
  let tipStart: number | undefined;
  let peakTheta = 0;
  const events: DynEvent[] = [];
  const frames: DynFrame[] = [];
  let nextFrame = 0;
  let strike: DynamicsResult["strike"];
  let done = false, settledBack = false;
  let restingOn: string[] = [];
  let blockedAt: number | undefined;     // contact preventing further rotation in this stage (falls back)

  const pointAccelW = (q: Vec3, w: number, a: number): Vec3 => {
    const d = sub(q, H.from);
    return add(scale(cross(H.axis, d), a), scale(cross(H.axis, cross(H.axis, d)), w * w));
  };
  const pointVelW = (q: Vec3, w: number): Vec3 => scale(cross(H.axis, sub(q, H.from)), w);

  const snapshot = () => frames.push({
    t, pose: X(theta), theta, omega, hinge: stage,
    payload: payload ? { ...payload, p: payload.attached ? worldP(payload.p, theta) : payload.p } : undefined,
    operator: operator ? { ...operator, p: operator.attached ? worldP(operator.p, theta) : operator.p } : undefined,
  });

  const stepFree = (b: BodyState, groundZ: number): boolean => {
    if (b.landed || b.attached) return false;
    b.v = add(b.v, scale(spec(t), dt));
    b.p = add(b.p, scale(b.v, dt));
    if (b.p.z <= groundZ) { b.p = { ...b.p, z: groundZ }; b.landed = true; return true; }
    return false;
  };
  let landedSpeedPayload = 0, landedSpeedOp = 0;

  /** Ground intersection of the resultant line through the attached combined CG. */
  const forceFoot = (): Vec3 => {
    const m = masses.reduce((s, x) => s + x.m, 0);
    const c = scale(masses.reduce((s, x) => add(s, scale(worldP(x.r, theta), x.m)), v(0, 0, 0)), 1 / m);
    const f = spec(t);
    return f.z < 0 ? add(c, scale(f, -c.z / f.z)) : c;
  };
  const side2 = (a: Vec3, b: Vec3, p: Vec3) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

  const onStrike = (hp: HullPoint, q: Vec3) => {
    const sp = norm(pointVelW(q, omega));
    if (!strike) strike = { point: hp, theta, t, speed: sp, energy: 0.5 * I * omega * omega };
    events.push({ t, type: "ground-strike", text: `${hp.label} struck the ground at ${fmt(sp)} m/s.`, at: { ...q, z: 0 }, speed: sp });
    const a = H.from, b = H.to, s = { ...q, z: 0 };
    const pf = forceFoot();
    // which side of each triangle edge is "inside"
    const inside = (x: Vec3, y: Vec3, third: Vec3) => Math.sign(side2(x, y, pf)) === Math.sign(side2(x, y, third)) || Math.abs(side2(x, y, pf)) < 1e-9;
    const inAB = inside(a, b, s), inAS = inside(a, s, b), inBS = inside(b, s, a);
    if (!inAB) {
      // resultant has moved back over the original edge: the machine falls back
      omega = 0; blockedAt = theta;
      events.push({ t, type: "ground-strike", text: "The contact stopped the rotation; the resultant is back inside the support, so the machine falls back." });
      return;
    }
    if (inAS && inBS || stage >= MAX_STAGES) {
      omega = 0; done = true;
      restingOn = [...new Set([H.label.split(" – ")[0]!, H.label.split(" – ")[1]!, hp.label])];
      events.push({ t, type: "came-to-rest", text: `Came to rest on the ${restingOn.join(", ").toLowerCase()}.` });
      return;
    }
    // pivot about the edge the resultant lies outside
    const [x0, y0, third] = !inAS ? [a, s, b] : [b, s, a];
    let from = x0, to = y0, u = normalize(sub(to, from));
    const trial = rotateAboutLine(third, from, u, 1e-3);
    if (trial.z < third.z) { [from, to] = [to, from]; u = scale(u, -1); }
    // plastic impact: angular momentum about the new axis is conserved
    const wv = scale(H.axis, omega);
    let L = 0, I2 = 0;
    for (const m of masses) {
      const r = worldP(m.r, theta);
      const vel = cross(wv, sub(r, H.from));
      const d = sub(r, from), dperp = norm(sub(d, scale(u, dot(d, u))));
      L += m.m * (dot(cross(d, vel), u) + m.k * m.k * dot(wv, u));
      I2 += m.m * (dperp * dperp + m.k * m.k);
    }
    X0 = X(theta);
    const prevLabel = hp.label;
    const keep = !inAS ? H.label.split(" – ")[0]! : H.label.split(" – ")[1]!;
    H = { from, to, axis: u, id: `${H.id}+${hp.id}`, label: keep === prevLabel ? `${keep} (two points)` : `${keep} – ${prevLabel}` };
    hinges.push(H); stage++;
    theta = 0; omega = Math.max(0, L / I2); I = I2;
    events.push({ t, type: "new-hinge", text: `Now pivoting about the ${H.label.toLowerCase()} line at ${fmt(omega, 2)} rad/s.` });
  };

  while (t <= tEnd + 1e-12) {
    if (t + 1e-12 >= nextFrame) { snapshot(); nextFrame += frameDt; }
    const moving = !done && !settledBack;
    const aNow = moving ? thetaDD(theta, t) : 0;
    const f = spec(t);

    // --- separation checks ---
    if (P && payload?.attached && !P.secured && payloadComp && pNormalB && pOutB) {
      const q = worldP(payloadComp.cg, theta);
      const fl = sub(f, pointAccelW(q, omega, aNow));
      const n = worldD(pNormalB, theta), o = worldD(pOutB, theta);
      let release = false, why = "";
      if (P.mode === "rigid") {
        const lat = normalize(cross(n, o));
        const local = v(dot(fl, o), dot(fl, lat), dot(fl, n));
        if (P.forkCheck) { const r = P.forkCheck(local); release = r.release; why = r.why; }
        else { const N = -local.z; release = N <= 0 || Math.hypot(Math.max(0, local.x), local.y) > P.friction * N; why = "slid off the forks"; }
      } else {
        const slope = Math.asin(Math.max(-1, Math.min(1, dot(o, normalize(fl)))));
        release = slope > P.angleOfRepose;
      }
      if (release) {
        payloadDrop = q.z;
        payload = { attached: false, p: q, v: moving ? pointVelW(q, omega) : v(0, 0, 0), landed: false };
        removeMass("payload"); if (moving) { I = inertia(); }
        const tilt = Math.acos(Math.max(-1, Math.min(1, worldD(v(0, 0, 1), theta).z)));
        events.push({ t, type: "payload-released", text: P.mode === "rigid" ? `Unsecured load ${why} at ${degS(tilt)} of machine tilt, from ${fmt(payloadDrop)} m.` : `Bucket load spilled at ${degS(tilt)} of machine tilt.` });
      }
    }
    if (O && operator?.attached && seatB && O.behaviour !== "belted" && tipStart !== undefined) {
      let leave = false, jump = false;
      if (O.behaviour === "jump" && t - tipStart >= O.reactionTime && moving) { leave = true; jump = true; }
      else if (O.behaviour === "unbelted" && !O.enclosedCab) {
        const q = worldP(seatB, theta);
        const fo = sub(f, pointAccelW(q, omega, aNow));
        const n = worldD(seatNB, theta), l = worldD(seatLB, theta);
        const N = -dot(fo, n), Tl = dot(fo, l);
        leave = N <= 0 || Math.abs(Tl) > O.seatFriction * N;
      }
      if (leave) {
        const q = worldP(seatB, theta);
        operator = { attached: false, p: q, v: moving ? pointVelW(q, omega) : v(0, 0, 0), landed: false };
        if (jump) {
          const inward = cross(st.resultantEval.normal, firstHinge.axis);
          const sideV = O.jumpSide === "fall" ? scale(inward, -1) : inward;
          const n = st.resultantEval.normal;
          const horiz = normalize(sub(sideV, scale(n, dot(sideV, n))));
          operator.v = add(operator.v, add(scale(horiz, O.jumpSpeed), scale(n, 1.0)));
          events.push({ t, type: "operator-jumped", text: `Operator jumped toward the ${O.jumpSide === "fall" ? "side the machine is falling to" : "high side"} ${fmt(t - tipStart, 2)} s after tipping began.` });
        } else events.push({ t, type: "operator-released", text: "Unbelted operator slid off the seat." });
        if (opComp) { removeMass("operator"); if (moving) I = inertia(); }
      }
    }

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

    if (!moving) {
      const freeMoving = (payload && !payload.attached && !payload.landed) || (operator && !operator.attached && !operator.landed);
      t += dt;
      if (!freeMoving) break;
      continue;
    }

    // --- body: RK4 about the current hinge ---
    const k1t = omega, k1w = thetaDD(theta, t);
    const k2t = omega + 0.5 * dt * k1w, k2w = thetaDD(theta + 0.5 * dt * k1t, t + dt / 2);
    const k3t = omega + 0.5 * dt * k2w, k3w = thetaDD(theta + 0.5 * dt * k2t, t + dt / 2);
    const k4t = omega + dt * k3w, k4w = thetaDD(theta + dt * k3t, t + dt);
    let nTheta = theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    let nOmega = omega + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    if (blockedAt !== undefined && nTheta > blockedAt) { nTheta = blockedAt; nOmega = Math.min(0, nOmega); }
    if (nTheta <= 0) {
      if (theta > 0 && (peakTheta > 1e-3 || stage > 0)) {
        if (stage === 0) { events.push({ t, type: "settled-back", text: `Machine dropped back onto its wheels after lifting ${degS(peakTheta)}.` }); settledBack = true; }
        else { done = true; restingOn = [...H.label.split(" – ")]; events.push({ t, type: "came-to-rest", text: "Machine fell back and came to rest." }); }
      }
      nTheta = 0; nOmega = Math.max(0, nOmega);
    }
    theta = nTheta; omega = nOmega; t += dt;
    if (theta > 1e-4 && tipStart === undefined) {
      tipStart = t;
      events.push({ t, type: "tip-start", text: `Machine began to rotate about the ${H.label} axis.` });
    }
    if (stage === 0) peakTheta = Math.max(peakTheta, theta);

    // --- ground strike by structure (or the attached load) ---
    const all = payload?.attached ? [...hull, ...payloadHull] : hull;
    let worst: { hp: HullPoint; q: Vec3 } | undefined;
    for (const hp of all) {
      const q = worldP(hp.p, theta);
      if (q.z < -1e-4 && distAxisW(q) > 0.05 && (!worst || q.z < worst.q.z)) worst = { hp, q };
    }
    if (worst && omega > 0) onStrike(worst.hp, worst.q);
  }
  snapshot();

  // --- outcomes ---
  const finalPose = X(theta);
  const finalTilt = Math.acos(Math.max(-1, Math.min(1, apply(finalPose.R, v(0, 0, 1)).z)));
  let machineOutcome: MachineOutcome;
  if (peakTheta < 1e-4 && stage === 0) machineOutcome = "stable";
  else if (settledBack) machineOutcome = "rocked-back";
  else if (!done && t >= tEnd) machineOutcome = "still-tipping";
  else if (finalTilt > (60 * Math.PI) / 180) machineOutcome = "overturned";
  else if (strike && ["forks", "bucket", "payload", "mast"].includes(strike.point.tag) && finalTilt < (40 * Math.PI) / 180) machineOutcome = "rests-on-attachment";
  else machineOutcome = "leaning";

  let operatorOutcome: OperatorOutcome = "none";
  const opInfo: DynamicsResult["operator"] = {};
  if (O && operator) {
    if (operator.attached) {
      operatorOutcome = machineOutcome === "overturned" || machineOutcome === "leaning"
        ? (O.behaviour === "belted" ? "retained-by-seatbelt" : O.enclosedCab ? "thrown-inside-cab" : "remained-in-seat")
        : "remained-in-seat";
    } else {
      opInfo.landedAt = operator.p; opInfo.impactSpeed = landedSpeedOp; opInfo.fallHeight = opMaxZ;
      operatorOutcome = "thrown-clear";
      if (machineOutcome !== "stable" && machineOutcome !== "rocked-back") {
        const low = hull.map((hp) => ({ hp, q: transformPoint(finalPose, hp.p) })).filter((x) => x.q.z < 0.8);
        const poly = convexHull2D([...low.map((x) => x.q), ...hinges.flatMap((h) => [h.from, h.to])]);
        if (low.length && pointInPolygon2D(operator.p, poly)) {
          operatorOutcome = "entrapment-zone";
          opInfo.under = low.reduce((a, b) => (dist2(b.q, operator!.p) < dist2(a.q, operator!.p) ? b : a)).hp.label;
        }
      }
    }
  }

  const summary: string[] = [];
  if (machineOutcome === "stable") summary.push("The machine stayed on its support.");
  if (machineOutcome === "rocked-back") summary.push(`The machine lifted ${degS(peakTheta)} about the ${firstHinge.label} axis, then dropped back.`);
  if (machineOutcome === "rests-on-attachment") summary.push(`The machine tipped about the ${firstHinge.label} axis until the ${strike!.point.label.toLowerCase()} hit the ground.`);
  if (machineOutcome === "leaning") summary.push(`The machine tipped and came to rest ${degS(finalTilt)} from upright, on the ${restingOn.join(", ").toLowerCase()}.`);
  if (machineOutcome === "overturned") summary.push(`The machine overturned (${degS(finalTilt)} from upright). First impact: ${strike!.point.label.toLowerCase()} at ${fmt(strike!.speed)} m/s.`);
  if (machineOutcome === "still-tipping") summary.push("The machine was still moving when the simulation ended.");
  if (payload && !payload.attached) summary.push(`The load left the ${P?.mode === "granular" ? "bucket" : "forks"} and fell ${fmt(payloadDrop)} m.`);
  if (operatorOutcome === "retained-by-seatbelt") summary.push("The seatbelt held the operator inside the protective structure.");
  if (operatorOutcome === "thrown-inside-cab") summary.push("The unbelted operator was thrown about inside the closed cab.");
  if (operatorOutcome === "thrown-clear") summary.push(`The operator left the machine and hit the ground at ${fmt(landedSpeedOp)} m/s.`);
  if (operatorOutcome === "entrapment-zone") summary.push(`The operator ended up where the machine came down, near the ${opInfo.under?.toLowerCase()}. This is the crush and entrapment zone.`);

  return {
    hinge: firstHinge, hinges, frames, events, machineOutcome, peakTheta, finalTilt, finalPose, strike, restingOn,
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
