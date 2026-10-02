import { type Vec3, type Frame, v, add, sub, scale, dot, cross, norm, normalize, rotateAboutLine, axisAngle, apply, compose, transformPoint, IDENTITY_FRAME, rotZ } from "./math.js";
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
 * Travel (when a MotionSpec and an evaluator are supplied): the machine first drives on its wheels
 * along a path set by speed, braking/acceleration and steering (rear-wheel steer for the forklift,
 * articulation for the loader). Each step the quasi-static evaluator is re-run with the actual
 * body-frame acceleration of the combined CG (longitudinal, centripetal, and the gravity direction for
 * the current heading on the slope). If the resultant leaves the support, rotation about the critical
 * edge begins from that state while the path continues. If friction is exceeded the tyres lose grip and
 * the machine skids; once structure strikes the ground it slides on its body (μ 0.5) to a stop.
 * Yaw-rate (Coriolis) effects on the tipping rotation are neglected. Released loads and operators fly
 * ballistically in the site (ground) frame.
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

/** Everything the tip core needs about the machine in one configuration (rebuilt while travelling). */
export interface TipContext {
  stability: StabilityResult;
  hull: HullPoint[];
  payload?: PayloadReleaseSetup;
  /** Machine state object (ForkliftState / LoaderState) for the renderer. */
  state?: unknown;
}

export type MotionKind = "none" | "brake" | "accelerate" | "turn";

/** Driver input over time. Built by the forklift/loader wrappers from a TravelSpec. */
export interface MotionSpec {
  kind: MotionKind;
  /** +1 forward, −1 reverse. */
  dir: 1 | -1;
  /** m/s: initial speed (brake, turn) or target speed (accelerate). */
  speed: number;
  /** m/s²: braking deceleration or acceleration. */
  accel: number;
  /** s of steady travel (or standing) before the event. */
  approach: number;
  /** s in the turn at full steering. */
  turnTime: number;
  /** s to apply or remove steering. */
  steerRamp: number;
  /** m/s², gentle stop after a turn. */
  stopDecel: number;
  /** Steering input (rear-wheel angle or articulation, rad) over time. */
  steer: (t: number) => number;
  /** Path curvature (1/m, +left) of the reference point for a steering input. */
  kappaOf: (steer: number) => number;
  /** Reference point on the non-steering axle (body frame): its velocity is along the body x axis. */
  ref: Vec3;
  /** Combined CG (body frame), where the inertial acceleration is evaluated. */
  cg: Vec3;
}

export interface MotionSample {
  speed: number;     // m/s, magnitude
  dist: number;      // m along the body x axis (signed), for wheel rotation
  steer: number;     // rad
  along: number;     // m/s², body-frame longitudinal acceleration of the CG
  lateral: number;   // m/s², body-frame lateral acceleration of the CG (+left)
  radius: number;    // m, path radius of the reference point (Infinity when straight)
  mode: "drive" | "skid" | "sliding";
}

export interface DynamicsSetup {
  stability: StabilityResult;
  terrain: Terrain;
  hull: HullPoint[];
  gyration?: Record<string, number>;
  /** Legacy: machine acceleration in the ground frame as a function of time (no travel). */
  accel?: (t: number) => Vec3;
  payload?: PayloadReleaseSetup;
  operator?: OperatorSetup;
  dt?: number;
  tEnd?: number;
  frameDt?: number;
  /** Travel model. Requires `evaluate`. */
  motion?: MotionSpec;
  /** Re-evaluate the machine for a yaw (rad, relative to the start heading), CG acceleration and steering input. */
  evaluate?: (yaw: number, accel: Vec3, steer: number, removed: { payload: boolean; operator: boolean }) => TipContext;
  /** Friction of the machine body sliding on the ground after it has gone over. */
  bodyFriction?: number;
}

export interface BodyState { attached: boolean; p: Vec3; v: Vec3; landed: boolean }

export interface DynFrame {
  t: number;
  /** Machine position on the site: body ground frame → site (stage) frame. */
  travel: Frame;
  /** Tip rotation applied to the rolled body (identity while on the wheels). */
  pose: Frame;
  /** Chassis roll onto the axle stop (rigid-axle chassis only; the oscillating axle stays on the ground). */
  roll: Frame;
  theta: number;
  omega: number;
  hinge: number;
  onWheels: boolean;
  /** Evaluation that applies at this instant (live while on wheels, tip-start state while tipping). */
  stability: StabilityResult;
  /** Body-frame acceleration of the CG (m/s²). */
  accel: Vec3;
  motion: MotionSample;
  state?: unknown;
  /** Attached: body coordinates. Released: site coordinates. */
  payload: BodyState | undefined;
  operator: BodyState | undefined;
}

export type DynEventType =
  | "tip-start" | "payload-released" | "payload-landed" | "operator-released"
  | "operator-jumped" | "operator-landed" | "settled-back" | "ground-strike" | "new-hinge" | "came-to-rest"
  | "motion" | "skid" | "end";

export interface DynEvent { t: number; type: DynEventType; text: string; at?: Vec3; speed?: number }

export type MachineOutcome = "stable" | "slid" | "rocked-back" | "leaning" | "rests-on-attachment" | "overturned" | "still-tipping";
export type OperatorOutcome =
  | "none" | "retained-by-seatbelt" | "thrown-inside-cab" | "remained-in-seat"
  | "thrown-clear" | "entrapment-zone";

export interface Hinge { from: Vec3; to: Vec3; axis: Vec3; id: string; label: string }

export interface DynamicsResult {
  /** First tipping axis (body frame). */
  hinge: Hinge;
  hinges: Hinge[];
  frames: DynFrame[];
  events: DynEvent[];
  machineOutcome: MachineOutcome;
  peakTheta: number;
  finalTilt: number;
  /** Final tip pose (body frame). */
  finalPose: Frame;
  /** Final position on the site. */
  finalTravel: Frame;
  strike: { point: HullPoint; theta: number; t: number; speed: number; energy: number } | undefined;
  restingOn: string[];
  payloadOutcome: { released: boolean; landedAt?: Vec3; impactSpeed?: number; dropHeight?: number };
  operatorOutcome: OperatorOutcome;
  operator: { landedAt?: Vec3; impactSpeed?: number; fallHeight?: number; under?: string };
  /** Peak speed and peak lateral acceleration while on the wheels. */
  travelStats: { peakSpeed: number; peakLateral: number; peakDecel: number; distance: number };
  dt: number;
  summary: string[];
}

const DEFAULT_K = 0.35;
const MAX_STAGES = 8;

interface Mass { id: string; m: number; r: Vec3; k: number }

const rotFrame = (pt: Vec3, u: Vec3, th: number): Frame => { const R = axisAngle(u, th); return { R, t: sub(pt, apply(R, pt)) }; };
const rollFrameOf = (st: StabilityResult): Frame => (st.roll ? rotFrame(st.roll.point, st.roll.axis, st.roll.angle) : IDENTITY_FRAME);
const rot2 = (a: number, x: number, y: number) => ({ x: Math.cos(a) * x - Math.sin(a) * y, y: Math.sin(a) * x + Math.cos(a) * y });

export const simulateTipOver = (setup: DynamicsSetup): DynamicsResult => {
  const dt = setup.dt ?? 1e-3;
  const frameDt = setup.frameDt ?? 1 / 120;
  const gSite = gravityDirInGroundFrame(setup.terrain);
  const M = setup.evaluate ? setup.motion : undefined;
  const travelMode = !!setup.evaluate;
  const muBody = setup.bodyFriction ?? 0.5;
  const fmt = (x: number, d = 1) => x.toFixed(d);
  const degS = (r: number) => `${fmt(r * 180 / Math.PI)}°`;
  const kmh = (ms: number) => `${fmt(Math.abs(ms) * 3.6)} km/h`;

  // ---- event timing ----
  const eventEnd = !M ? 0 : M.approach + (M.kind === "brake" ? M.speed / Math.max(0.1, M.accel)
    : M.kind === "accelerate" ? M.speed / Math.max(0.1, M.accel)
    : M.kind === "turn" ? M.turnTime + 2 * M.steerRamp + M.speed / Math.max(0.1, M.stopDecel) : 0);
  const tEnd = setup.tEnd ?? (travelMode ? Math.min(20, eventEnd + 5) : 6);

  // ---- motion state (site frame = body ground frame at t = 0) ----
  let vel = M && (M.kind === "brake" || M.kind === "turn") ? M.dir * M.speed : 0;
  let yaw = 0, yawRate = 0, dist = 0, steer = M ? M.steer(0) : 0;
  const ref = M?.ref ?? v(0, 0, 0);
  let pref = { x: ref.x, y: ref.y };
  let Vs = { x: 0, y: 0 };
  let mode: MotionSample["mode"] = "drive";
  let aBody = v(0, 0, 0);
  let vdotNow = 0, kappaNow = 0;
  const travelStats = { peakSpeed: Math.abs(vel), peakLateral: 0, peakDecel: 0, distance: 0 };
  let phaseFlags = { braking: false, turning: false, accel: false };

  const travelFrame = (): Frame => {
    const r = rot2(yaw, ref.x, ref.y);
    return { R: rotZ(yaw), t: v(pref.x - r.x, pref.y - r.y, 0) };
  };
  const toSite = (p: Vec3) => transformPoint(travelFrame(), p);
  const dirToSite = (d: Vec3) => apply(rotZ(yaw), d);
  const refVelSite = () => (mode === "drive" ? rot2(yaw, vel, 0) : Vs);

  const computeAccel = (t: number) => {
    if (!M) { aBody = setup.accel ? setup.accel(t) : v(0, 0, 0); return; }
    if (mode === "drive") {
      steer = M.steer(t);
      const kappa = M.kappaOf(steer);
      let vdot = 0;
      const moving = Math.abs(vel) > 1e-6;
      if (M.kind === "brake" && t >= M.approach && moving) vdot = -Math.sign(vel) * M.accel;
      if (M.kind === "accelerate" && t >= M.approach && Math.abs(vel) < M.speed - 1e-9) vdot = M.dir * M.accel;
      if (M.kind === "turn" && t >= M.approach + M.turnTime + 2 * M.steerRamp && moving) vdot = -Math.sign(vel) * M.stopDecel;
      yawRate = vel * kappa;
      const alpha = vdot * kappa;
      const cgNow = onWheels ? st.cgUnrolled.combined.cg : M.cg;
      const d = { x: cgNow.x - ref.x, y: cgNow.y - ref.y };
      aBody = v(vdot - alpha * d.y - yawRate * yawRate * d.x, vel * yawRate + alpha * d.x - yawRate * yawRate * d.y, 0);
      vdotNow = vdot; kappaNow = kappa;
    } else {
      const mu = mode === "skid" ? setup.terrain.friction : muBody;
      const gn = -G * gSite.z, gin = { x: G * gSite.x, y: G * gSite.y };
      const sp = Math.hypot(Vs.x, Vs.y);
      let a = { x: 0, y: 0 };
      if (sp > 1e-3) a = { x: gin.x - (mu * gn * Vs.x) / sp, y: gin.y - (mu * gn * Vs.y) / sp };
      else {
        const gm = Math.hypot(gin.x, gin.y);
        if (gm > mu * gn) a = { x: gin.x * (1 - (mu * gn) / gm), y: gin.y * (1 - (mu * gn) / gm) };
        else Vs = { x: 0, y: 0 };
      }
      const b = rot2(-yaw, a.x, a.y);
      aBody = v(b.x, b.y, 0);
      vdotNow = 0; kappaNow = 0;
    }
  };

  const advanceMotion = (t: number) => {
    if (!M) return;
    if (mode === "drive") {
      const v0 = vel;
      const nv = vel + vdotNow * dt;
      if (M.kind === "brake" || (M.kind === "turn" && vdotNow !== 0)) vel = Math.sign(nv) !== Math.sign(vel) ? 0 : nv;
      else if (M.kind === "accelerate") vel = Math.abs(nv) > M.speed ? M.dir * M.speed : nv;
      else vel = nv;
      const vMid = 0.5 * (v0 + vel);
      const w = rot2(yaw + 0.5 * yawRate * dt, vMid, 0);
      yaw += yawRate * dt;
      pref = { x: pref.x + w.x * dt, y: pref.y + w.y * dt };
      dist += vMid * dt;
    } else {
      const sp0 = Math.hypot(Vs.x, Vs.y);
      const aS = rot2(yaw, aBody.x, aBody.y);
      const nV = { x: Vs.x + aS.x * dt, y: Vs.y + aS.y * dt };
      Vs = sp0 > 1e-3 && nV.x * Vs.x + nV.y * Vs.y < 0 ? { x: 0, y: 0 } : nV;
      yawRate *= Math.exp(-3 * dt);
      yaw += yawRate * dt;
      pref = { x: pref.x + Vs.x * dt, y: pref.y + Vs.y * dt };
      const along = rot2(-yaw, Vs.x, Vs.y);
      dist += along.x * dt;
    }
    const sp = mode === "drive" ? Math.abs(vel) : Math.hypot(Vs.x, Vs.y);
    travelStats.peakSpeed = Math.max(travelStats.peakSpeed, sp);
    travelStats.distance += sp * dt;
    if (onWheels) {
      travelStats.peakLateral = Math.max(travelStats.peakLateral, Math.abs(aBody.y));
      travelStats.peakDecel = Math.max(travelStats.peakDecel, Math.abs(aBody.x));
    }
    // driver-input events
    if (M.kind === "brake" && t >= M.approach && !phaseFlags.braking && mode === "drive") { phaseFlags.braking = true; events.push({ t, type: "motion", text: `Braking from ${kmh(vel)} at ${fmt(M.accel)} m/s².` }); }
    if (M.kind === "accelerate" && t >= M.approach && !phaseFlags.accel) { phaseFlags.accel = true; events.push({ t, type: "motion", text: `Accelerating at ${fmt(M.accel)} m/s² toward ${kmh(M.speed)}.` }); }
    if (M.kind === "turn" && t >= M.approach && !phaseFlags.turning && mode === "drive") {
      phaseFlags.turning = true;
      const k = M.kappaOf(M.steer(M.approach + M.steerRamp));
      events.push({ t, type: "motion", text: `Steering into a ${k >= 0 ? "left" : "right"} turn at ${kmh(vel)} on a ${fmt(Math.abs(1 / k))} m radius.` });
    }
  };

  const motionSample = (): MotionSample => ({
    speed: mode === "drive" ? Math.abs(vel) : Math.hypot(Vs.x, Vs.y), dist, steer,
    along: aBody.x, lateral: aBody.y, radius: Math.abs(kappaNow) > 1e-6 ? 1 / Math.abs(kappaNow) : Infinity, mode,
  });

  // ---- tip core state ----
  let ctx: TipContext = { stability: setup.stability, hull: setup.hull, ...(setup.payload ? { payload: setup.payload } : {}) };
  let st = setup.stability;
  let onWheels = travelMode;
  const gyr = setup.gyration ?? {};
  let payloadGone = false, operatorGone = false;
  let masses: Mass[] = [];
  let H: Hinge = { from: v(0, 0, 0), to: v(1, 0, 0), axis: v(1, 0, 0), id: "", label: "" };
  let firstHinge: Hinge | undefined;
  const hinges: Hinge[] = [];
  let X0: Frame = IDENTITY_FRAME;
  let theta = 0, omega = 0, stage = 0, I = 1;
  let hull: HullPoint[] = [], payloadHull: HullPoint[] = [];
  let tipping = false;

  const X = (th: number): Frame => compose(rotFrame(H.from, H.axis, th), X0);
  const worldP = (p: Vec3, th: number) => transformPoint(X(th), p);
  const worldD = (d: Vec3, th: number) => apply(X(th).R, d);
  const distAxisW = (q: Vec3) => { const d = sub(q, H.from); return norm(sub(d, scale(H.axis, dot(d, H.axis)))); };
  const inertia = () => masses.reduce((s, x) => s + x.m * (distAxisW(transformPoint(X0, x.r)) ** 2 + x.k ** 2), 0);
  const specBody = (t: number): Vec3 => {
    if (!M) return sub(scale(gSite, G), setup.accel ? setup.accel(t) : v(0, 0, 0));
    return sub(apply(rotZ(-yaw), scale(gSite, G)), aBody);
  };
  let specNow = specBody(0);
  const moment = (th: number, t: number) => {
    const f = M ? specNow : specBody(t);
    return masses.reduce((s, x) => s + dot(cross(sub(worldP(x.r, th), H.from), scale(f, x.m)), H.axis), 0);
  };
  const thetaDD = (th: number, t: number) => moment(th, t) / I;
  const removeMass = (id: string) => { masses = masses.filter((x) => x.id !== id); };

  const rollP = (p: Vec3) => applyRoll(st, p);
  const rollD = (d: Vec3) => (st.roll ? apply(axisAngle(st.roll.axis, st.roll.angle), d) : d);

  const startTip = (c: TipContext, t: number) => {
    ctx = c; st = c.stability;
    masses = st.components.filter((x) => !(payloadGone && x.id === "payload") && !(operatorGone && x.id === "operator"))
      .map((x: MassComponent) => ({ id: x.id, m: x.mass, r: x.cg, k: gyr[x.id] ?? DEFAULT_K }));
    const crit = st.resultantEval.critical;
    H = { from: crit.from.p, to: crit.to.p, axis: crit.axisDir, id: crit.id, label: `${crit.from.label} – ${crit.to.label}` };
    if (!firstHinge) firstHinge = H;
    hinges.push(H);
    X0 = IDENTITY_FRAME; theta = 0; omega = 0; stage = 0;
    I = inertia();
    hull = c.hull.map((p) => ({ ...p, p: rollP(p.p) }));
    payloadHull = (c.payload?.hull ?? []).map((p) => ({ ...p, p: rollP(p.p) }));
    tipping = true;
    void t;
  };

  const O = setup.operator;
  const opInModel = () => st.components.some((c) => c.id === "operator");
  const seatB = () => (O ? rollP(O.seat) : v(0, 0, 0));
  let payload: BodyState | undefined = st.components.find((c) => c.id === "payload") ? { attached: true, p: v(0, 0, 0), v: v(0, 0, 0), landed: false } : undefined;
  let operator: BodyState | undefined = O ? { attached: true, p: v(0, 0, 0), v: v(0, 0, 0), landed: false } : undefined;
  let payloadDrop = 0, opMaxZ = 0;

  let t = 0;
  let tipStart: number | undefined;
  let everTipped = false, endedOnWheels = false, skidded = false, tipAnnounced = false, tipPeak = 0;
  let peakTheta = 0;
  const events: DynEvent[] = [];
  const frames: DynFrame[] = [];
  let nextFrame = 0;
  let strike: DynamicsResult["strike"];
  let done = false, settledBack = false;
  let restingOn: string[] = [];
  let blockedAt: number | undefined;
  let landedSpeedPayload = 0, landedSpeedOp = 0;

  const pointAccelW = (q: Vec3, w: number, a: number): Vec3 => {
    const d = sub(q, H.from);
    return add(scale(cross(H.axis, d), a), scale(cross(H.axis, cross(H.axis, d)), w * w));
  };
  const pointVelW = (q: Vec3, w: number): Vec3 => (tipping ? scale(cross(H.axis, sub(q, H.from)), w) : v(0, 0, 0));
  /** Site velocity of a body point q (body coordinates after tip). */
  const siteVel = (q: Vec3): Vec3 => {
    const vr = refVelSite();
    const rel = pointVelW(q, omega);
    const yawV = v(-yawRate * (q.y - ref.y), yawRate * (q.x - ref.x), 0);
    return add(v(vr.x, vr.y, 0), dirToSite(add(rel, yawV)));
  };

  const payloadComp = () => st.components.find((c) => c.id === "payload");
  const curTheta = () => (tipping ? theta : 0);

  const snapshot = () => {
    const pc = payloadComp();
    frames.push({
      t, travel: travelFrame(), pose: tipping ? X(theta) : IDENTITY_FRAME, roll: rollFrameOf(st), theta: curTheta(), omega: tipping ? omega : 0, hinge: stage,
      onWheels: !tipping, stability: st, accel: aBody, motion: motionSample(), state: ctx.state,
      payload: payload ? { ...payload, p: payload.attached ? (pc ? worldPorBody(pc.cg) : payload.p) : payload.p } : undefined,
      operator: operator ? { ...operator, p: operator.attached ? worldPorBody(seatB()) : operator.p } : undefined,
    });
  };
  const worldPorBody = (p: Vec3) => (tipping ? worldP(p, theta) : p);

  const stepFree = (b: BodyState, groundZ: number): boolean => {
    if (b.landed || b.attached) return false;
    b.v = add(b.v, scale(gSite, G * dt));
    b.p = add(b.p, scale(b.v, dt));
    if (b.p.z <= groundZ) { b.p = { ...b.p, z: groundZ }; b.landed = true; return true; }
    return false;
  };

  const forceFoot = (): Vec3 => {
    const m = masses.reduce((s, x) => s + x.m, 0);
    const c = scale(masses.reduce((s, x) => add(s, scale(worldP(x.r, theta), x.m)), v(0, 0, 0)), 1 / m);
    const f = M ? specNow : specBody(t);
    return f.z < 0 ? add(c, scale(f, -c.z / f.z)) : c;
  };
  const side2 = (a: Vec3, b: Vec3, p: Vec3) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

  const onStrike = (hp: HullPoint, q: Vec3) => {
    const sp = norm(pointVelW(q, omega));
    if (!strike) strike = { point: hp, theta, t, speed: sp, energy: 0.5 * I * omega * omega };
    events.push({ t, type: "ground-strike", text: `${hp.label} struck the ground at ${fmt(sp)} m/s.`, at: toSite({ ...q, z: 0 }), speed: sp });
    if (M && mode !== "sliding") { Vs = refVelSite(); mode = "sliding"; }
    const a = H.from, b = H.to, s = { ...q, z: 0 };
    const pf = forceFoot();
    const inside = (x: Vec3, y: Vec3, third: Vec3) => Math.sign(side2(x, y, pf)) === Math.sign(side2(x, y, third)) || Math.abs(side2(x, y, pf)) < 1e-9;
    const inAB = inside(a, b, s), inAS = inside(a, s, b), inBS = inside(b, s, a);
    if (!inAB) {
      omega = 0; blockedAt = theta;
      events.push({ t, type: "ground-strike", text: "The contact stopped the rotation; the resultant is back inside the support, so the machine falls back." });
      return;
    }
    if ((inAS && inBS) || stage >= MAX_STAGES) {
      omega = 0; done = true;
      restingOn = [...new Set([H.label.split(" – ")[0]!, H.label.split(" – ")[1]!, hp.label])];
      events.push({ t, type: "came-to-rest", text: `Came to rest on the ${restingOn.join(", ").toLowerCase()}.` });
      return;
    }
    const [x0, y0, third] = !inAS ? [a, s, b] : [b, s, a];
    let from = x0, to = y0, u = normalize(sub(to, from));
    const trial = rotateAboutLine(third, from, u, 1e-3);
    if (trial.z < third.z) { [from, to] = [to, from]; u = scale(u, -1); }
    const wv = scale(H.axis, omega);
    let L = 0, I2 = 0;
    for (const m of masses) {
      const r = worldP(m.r, theta);
      const vv = cross(wv, sub(r, H.from));
      const d = sub(r, from), dperp = norm(sub(d, scale(u, dot(d, u))));
      L += m.m * (dot(cross(d, vv), u) + m.k * m.k * dot(wv, u));
      I2 += m.m * (dperp * dperp + m.k * m.k);
    }
    X0 = X(theta);
    const keep = !inAS ? H.label.split(" – ")[0]! : H.label.split(" – ")[1]!;
    H = { from, to, axis: u, id: `${H.id}+${hp.id}`, label: keep === hp.label ? `${keep} (two points)` : `${keep} – ${hp.label}` };
    hinges.push(H); stage++;
    theta = 0; omega = Math.max(0, L / I2); I = I2;
    events.push({ t, type: "new-hinge", text: `Now pivoting about the ${H.label.toLowerCase()} line at ${fmt(omega, 2)} rad/s.` });
  };

  if (!travelMode) startTip(ctx, 0);
  let evalCounter = 0;

  while (t <= tEnd + 1e-12) {
    computeAccel(t);
    specNow = specBody(t);

    // --- on the wheels: live quasi-static evaluation ---
    if (onWheels && setup.evaluate) {
      if (evalCounter++ % 2 === 0) { ctx = setup.evaluate(yaw, aBody, steer, { payload: payloadGone, operator: operatorGone }); st = ctx.stability; }
      if (M && mode === "drive" && st.slidingPredicted && st.status !== "incipient-tipping" && st.status !== "lift-off") {
        mode = "skid"; skidded = true; Vs = rot2(yaw, vel, 0);
        events.push({ t, type: "skid", text: Math.abs(vel) > 0.05 ? `Tyres lost grip at ${kmh(vel)} (friction needed ${fmt(st.requiredFriction, 2)}, available ${fmt(st.availableFriction, 2)}): the machine skids.` : `Friction needed ${fmt(st.requiredFriction, 2)} exceeds the ${fmt(st.availableFriction, 2)} available: the machine slides down the slope.` });
        computeAccel(t); specNow = specBody(t);
      }
      if (st.status === "incipient-tipping" || st.status === "lift-off") {
        startTip(ctx, t);
        onWheels = false; everTipped = true;
        if (tipStart === undefined) tipStart = t;
        tipPeak = 0;
        if (!tipAnnounced) { tipAnnounced = true; events.push({ t, type: "tip-start", text: `Machine began to tip about the ${H.label} axis${M && motionSample().speed > 0.05 ? ` at ${kmh(motionSample().speed)}` : ""}.` }); }
      }
    }

    if (t + 1e-12 >= nextFrame) { snapshot(); nextFrame += frameDt; }
    const moving = tipping && !done && !settledBack;
    const aNow = moving ? thetaDD(theta, t) : 0;
    const f = specNow;

    // --- load release ---
    const pc = payloadComp();
    const P = ctx.payload;
    if (P && payload?.attached && !P.secured && pc) {
      const th = curTheta();
      const q = tipping ? worldP(pc.cg, th) : pc.cg;
      const fl = tipping ? sub(f, pointAccelW(q, omega, aNow)) : f;
      const n = tipping ? worldD(rollD(P.normal), th) : rollD(P.normal), o = tipping ? worldD(rollD(P.outward), th) : rollD(P.outward);
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
        payload = { attached: false, p: toSite(q), v: siteVel(q), landed: false };
        payloadGone = true;
        if (tipping) { removeMass("payload"); if (moving) I = inertia(); }
        const tilt = tipping ? Math.acos(Math.max(-1, Math.min(1, worldD(v(0, 0, 1), th).z))) : 0;
        events.push({ t, type: "payload-released", text: P.mode === "rigid" ? `Unsecured load ${why}${tipping ? ` at ${degS(tilt)} of machine tilt` : ""}, from ${fmt(payloadDrop)} m.` : `Bucket load spilled${tipping ? ` at ${degS(tilt)} of machine tilt` : ""}.` });
      }
    }
    // --- operator ---
    if (O && operator?.attached && O.behaviour !== "belted" && tipping && tipStart !== undefined) {
      let leave = false, jump = false;
      const sb = seatB();
      if (O.behaviour === "jump" && t - tipStart >= O.reactionTime && moving) { leave = true; jump = true; }
      else if (O.behaviour === "unbelted" && !O.enclosedCab) {
        const q = worldP(sb, theta);
        const fo = sub(f, pointAccelW(q, omega, aNow));
        const n = worldD(rollD(v(0, 0, 1)), theta), l = worldD(rollD(v(0, 1, 0)), theta);
        const N = -dot(fo, n), Tl = dot(fo, l);
        leave = N <= 0 || Math.abs(Tl) > O.seatFriction * N;
      }
      if (leave) {
        const q = worldP(sb, theta);
        operator = { attached: false, p: toSite(q), v: siteVel(q), landed: false };
        operatorGone = true;
        if (jump) {
          const inward = cross(st.resultantEval.normal, (firstHinge ?? H).axis);
          const sideV = O.jumpSide === "fall" ? scale(inward, -1) : inward;
          const n = st.resultantEval.normal;
          const horiz = normalize(sub(sideV, scale(n, dot(sideV, n))));
          operator.v = add(operator.v, dirToSite(add(scale(horiz, O.jumpSpeed), scale(n, 1.0))));
          events.push({ t, type: "operator-jumped", text: `Operator jumped toward the ${O.jumpSide === "fall" ? "side the machine is falling to" : "high side"} ${fmt(t - tipStart, 2)} s after tipping began.` });
        } else events.push({ t, type: "operator-released", text: "Unbelted operator slid off the seat." });
        if (opInModel()) { removeMass("operator"); if (moving) I = inertia(); }
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

    if (moving) {
      const k1t = omega, k1w = thetaDD(theta, t);
      const k2t = omega + 0.5 * dt * k1w, k2w = thetaDD(theta + 0.5 * dt * k1t, t + dt / 2);
      const k3t = omega + 0.5 * dt * k2w, k3w = thetaDD(theta + 0.5 * dt * k2t, t + dt / 2);
      const k4t = omega + dt * k3w, k4w = thetaDD(theta + dt * k3t, t + dt);
      let nTheta = theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
      let nOmega = omega + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
      if (blockedAt !== undefined && nTheta > blockedAt) { nTheta = blockedAt; nOmega = Math.min(0, nOmega); }
      if (nTheta <= 0) {
        if (stage === 0) {
          if (tipPeak > 2e-3) { events.push({ t, type: "settled-back", text: `Machine dropped back onto its wheels after lifting ${degS(tipPeak)}.` }); tipAnnounced = false; }
          if (travelMode) { tipping = false; onWheels = true; endedOnWheels = true; nTheta = 0; nOmega = 0; blockedAt = undefined; }
          else { settledBack = true; }
        } else { done = true; restingOn = [...H.label.split(" – ")]; events.push({ t, type: "came-to-rest", text: "Machine fell back and came to rest." }); }
        nTheta = 0; nOmega = Math.max(0, nOmega);
      }
      if (tipping) { theta = nTheta; omega = nOmega; }
      if (tipping && stage === 0) { peakTheta = Math.max(peakTheta, theta); tipPeak = Math.max(tipPeak, theta); if (theta > 1e-4) endedOnWheels = false; }
      if (!travelMode && theta > 1e-4 && tipStart === undefined) {
        tipStart = t; everTipped = true;
        events.push({ t, type: "tip-start", text: `Machine began to rotate about the ${H.label} axis.` });
      }
      if (tipping) {
        const all = payload?.attached ? [...hull, ...payloadHull] : hull;
        let worst: { hp: HullPoint; q: Vec3 } | undefined;
        for (const hp of all) {
          const q = worldP(hp.p, theta);
          if (q.z < -1e-4 && distAxisW(q) > 0.05 && (!worst || q.z < worst.q.z)) worst = { hp, q };
        }
        if (worst && omega > 0) onStrike(worst.hp, worst.q);
      }
    }

    advanceMotion(t);
    t += dt;

    // --- end conditions ---
    const freeMoving = (payload && !payload.attached && !payload.landed) || (operator && !operator.attached && !operator.landed);
    if (!travelMode) {
      if ((done || settledBack) && !freeMoving) break;
    } else {
      const still = motionSample().speed < 1e-3;
      const settled = onWheels || done;
      if (settled && still && !freeMoving && t > eventEnd + (onWheels ? 0.4 : 0.8)) break;
    }
  }
  snapshot();

  // --- outcomes ---
  const finalPose = tipping ? X(theta) : IDENTITY_FRAME;
  const finalTravel = travelFrame();
  const finalTilt = tipping ? Math.acos(Math.max(-1, Math.min(1, apply(finalPose.R, v(0, 0, 1)).z))) : 0;
  const fh = firstHinge ?? (() => { const c = st.resultantEval.critical; return { from: c.from.p, to: c.to.p, axis: c.axisDir, id: c.id, label: `${c.from.label} – ${c.to.label}` }; })();
  let machineOutcome: MachineOutcome;
  if (!everTipped && peakTheta < 1e-4) machineOutcome = skidded ? "slid" : "stable";
  else if (settledBack || (travelMode && !tipping)) machineOutcome = peakTheta > 1e-4 ? "rocked-back" : skidded ? "slid" : "stable";
  else if (!done && t >= tEnd) machineOutcome = "still-tipping";
  else if (finalTilt > (60 * Math.PI) / 180) machineOutcome = "overturned";
  else if (strike && ["forks", "bucket", "payload", "mast"].includes(strike.point.tag) && finalTilt < (40 * Math.PI) / 180) machineOutcome = "rests-on-attachment";
  else machineOutcome = "leaning";
  void endedOnWheels;

  let operatorOutcome: OperatorOutcome = "none";
  const opInfo: DynamicsResult["operator"] = {};
  if (O && operator) {
    const overish = machineOutcome === "overturned" || machineOutcome === "leaning";
    if (operator.attached) {
      operatorOutcome = overish ? (O.behaviour === "belted" ? "retained-by-seatbelt" : O.enclosedCab ? "thrown-inside-cab" : "remained-in-seat") : "remained-in-seat";
    } else {
      opInfo.landedAt = operator.p; opInfo.impactSpeed = landedSpeedOp; opInfo.fallHeight = opMaxZ;
      operatorOutcome = "thrown-clear";
      if (machineOutcome !== "stable" && machineOutcome !== "rocked-back" && machineOutcome !== "slid") {
        // operator position in the final body frame
        const rel = sub(operator.p, finalTravel.t);
        const ob = apply(rotZ(-yaw), rel);
        const low = hull.map((hp) => ({ hp, q: transformPoint(finalPose, hp.p) })).filter((x) => x.q.z < 0.8);
        const poly = convexHull2D([...low.map((x) => x.q), ...hinges.flatMap((h) => [h.from, h.to])]);
        if (low.length && pointInPolygon2D(ob, poly)) {
          operatorOutcome = "entrapment-zone";
          opInfo.under = low.reduce((a, b) => (dist2(b.q, ob) < dist2(a.q, ob) ? b : a)).hp.label;
        }
      }
    }
  }

  const summary: string[] = [];
  if (M && M.kind !== "none") summary.push(`Peak speed ${kmh(travelStats.peakSpeed)}, peak lateral acceleration ${fmt(travelStats.peakLateral)} m/s², peak longitudinal ${fmt(travelStats.peakDecel)} m/s², travelled ${fmt(travelStats.distance)} m.`);
  if (machineOutcome === "stable") summary.push("The machine stayed on its wheels throughout.");
  if (machineOutcome === "slid") summary.push("The tyres lost grip and the machine slid, but it stayed on its wheels.");
  if (machineOutcome === "rocked-back") summary.push(`The machine lifted ${degS(peakTheta)} about the ${fh.label} axis, then dropped back onto its wheels.`);
  if (machineOutcome === "rests-on-attachment") summary.push(`The machine tipped about the ${fh.label} axis until the ${strike!.point.label.toLowerCase()} hit the ground.`);
  if (machineOutcome === "leaning") summary.push(`The machine tipped and came to rest ${degS(finalTilt)} from upright, on the ${restingOn.join(", ").toLowerCase()}.`);
  if (machineOutcome === "overturned") summary.push(`The machine overturned (${degS(finalTilt)} from upright). First impact: ${strike!.point.label.toLowerCase()} at ${fmt(strike!.speed)} m/s.`);
  if (machineOutcome === "still-tipping") summary.push("The machine was still moving when the simulation ended.");
  if (payload && !payload.attached) summary.push(`The load left the ${ctx.payload?.mode === "granular" ? "bucket" : "forks"} and fell ${fmt(payloadDrop)} m.`);
  if (operatorOutcome === "retained-by-seatbelt") summary.push("The seatbelt held the operator inside the protective structure.");
  if (operatorOutcome === "thrown-inside-cab") summary.push("The unbelted operator was thrown about inside the closed cab.");
  if (operatorOutcome === "thrown-clear") summary.push(`The operator left the machine and hit the ground at ${fmt(landedSpeedOp)} m/s.`);
  if (operatorOutcome === "entrapment-zone") summary.push(`The operator ended up where the machine came down, near the ${opInfo.under?.toLowerCase()}. This is the crush and entrapment zone.`);

  return {
    hinge: fh, hinges, frames, events, machineOutcome, peakTheta, finalTilt, finalPose, finalTravel, strike, restingOn,
    payloadOutcome: payload && !payload.attached ? { released: true, landedAt: payload.p, impactSpeed: landedSpeedPayload, dropHeight: payloadDrop } : { released: false },
    operatorOutcome, operator: opInfo, travelStats, dt, summary,
  };
};

/** Path curvature of the rear-axle centre of an articulated loader with articulation γ (rad, +left). */
export const loaderKappa = (frontAxleX: number, rearAxleX: number, gamma: number): number => {
  const lf = frontAxleX, lr = -rearAxleX;
  return Math.sin(gamma) / (lf + lr * Math.cos(gamma));
};

/** Driver input for a run. Speeds in m/s, accelerations in m/s². */
export interface TravelSpec {
  kind: MotionKind;
  dir: 1 | -1;
  speed: number;
  accel: number;
  /** Time at full steering (turn only). */
  turnTime: number;
  /** Forklift turn radius at the front-axle centre (m), sign +left. Ignored for the loader (articulation sets the path). */
  radius: number;
  approach?: number;
}

export const buildMotion = (tr: TravelSpec, o: { ref: Vec3; cg: Vec3; steerTurn: number; steerConst: number; kappaOf: (s: number) => number }): MotionSpec => {
  const approach = tr.approach ?? (tr.kind === "brake" || tr.kind === "turn" ? 1.5 : tr.kind === "accelerate" ? 0.5 : 0);
  const ramp = 0.8;
  const steer = (t: number): number => {
    if (tr.kind !== "turn") return o.steerConst;
    const a = t - approach;
    if (a < 0) return o.steerConst;
    const f = a < ramp ? a / ramp : a < ramp + tr.turnTime ? 1 : Math.max(0, 1 - (a - ramp - tr.turnTime) / ramp);
    return o.steerConst + f * (o.steerTurn - o.steerConst);
  };
  return { kind: tr.kind, dir: tr.dir, speed: tr.speed, accel: tr.accel, approach, turnTime: tr.turnTime, steerRamp: ramp, stopDecel: 1.5, steer, kappaOf: o.kappaOf, ref: o.ref, cg: o.cg };
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
