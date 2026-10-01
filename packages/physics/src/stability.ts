import { type Vec3, sub, dot, scale, normalize, rotateAboutLine, cross, add, solveLinear } from "./math.js";
import { type MassComponent, summariseCg, type CgSummary } from "./mass.js";
import { type SupportPoint, type SupportPolygon, evaluatePolygon, type PolygonEvaluation, type AppliedForce } from "./support.js";
import { G } from "./units.js";
import { type Terrain, gravityDirInGroundFrame } from "./terrain.js";

/**
 * Support model for a machine with one rigid axle and one axle that oscillates about a
 * longitudinal pivot with mechanical stops. This describes both a conventional
 * counterbalanced forklift (rigid drive axle at the front, steer axle oscillating at the
 * rear) and the common articulated loader layout (rigid front axle on the front frame,
 * oscillating rear axle). The support polygon is NOT assumed; it is derived from which
 * constraints are active:
 *   stage "axle-free":  rigid-axle contacts + oscillation pivot (3 points, pivot above ground)
 *   stage "axle-stop":  the chassis has rolled onto a stop, so the oscillating axle's
 *                       contacts become supports and the far rigid-axle wheel is lifted.
 */
export interface OscillatingAxleSupport {
  rigidLeft: SupportPoint;
  rigidRight: SupportPoint;
  pivot: SupportPoint;        // 3D pivot position (above ground)
  oscLeft: SupportPoint;
  oscRight: SupportPoint;
  /** Mechanical limit of chassis-to-axle roll, radians (symmetric). */
  stopAngle: number;
  /** Unit direction of the oscillation axis (normally the machine's x axis). */
  pivotAxisDir: Vec3;
}

export type StabilityStatus =
  | "within-boundary"
  | "approaching-boundary"
  | "incipient-tipping"
  | "lift-off"
  | "sliding-predicted";

export type SupportStage = "axle-free" | "axle-stop-left" | "axle-stop-right";

export interface TyreReaction { id: string; label: string; normal: number; lifted: boolean }

/**
 * Ground-normal tyre reactions from force and moment balance in the ground plane.
 * Friction forces act in the ground plane at ground level, so they carry no moment about
 * in-plane axes; the normal reactions are therefore fixed by the resultant's normal component
 * and its ground intersection. The free oscillating axle adds one condition: moment balance of
 * the axle about its pivot. The rear tyres' lateral friction (assumed shared in proportion to
 * normal load) acts below the pivot and shifts load toward the downhill rear tyre.
 * With the stop engaged the lifted rigid-axle tyre carries zero and the system is determinate.
 */
export const tyreReactions = (s: OscillatingAxleSupport, stage: SupportStage, lifted: SupportPoint | undefined, ev: PolygonEvaluation): TyreReaction[] | undefined => {
  const p = ev.groundIntersection;
  if (!p) return undefined;
  const Fn = ev.normalLoad, F = ev.totalForce;
  const all = [s.rigidLeft, s.rigidRight, s.oscLeft, s.oscRight];
  const active = all.filter((c) => c.id !== lifted?.id);
  const rows: number[][] = [active.map(() => 1), active.map((c) => c.p.x), active.map((c) => c.p.y)];
  const rhs = [Fn, Fn * p.x, Fn * p.y];
  if (stage === "axle-free") {
    // (N_RL − N_RR)·(t/2) + h_p·f_y,rear = 0 with f_y,rear = −F.y·(N_RL+N_RR)/Fn
    const t = Math.abs(s.oscLeft.p.y - s.oscRight.p.y);
    const k = (2 * s.pivot.p.z * F.y) / (t * Fn);
    rows.push(active.map((c) => (c.id === s.oscLeft.id ? 1 - k : c.id === s.oscRight.id ? -1 - k : 0)));
    rhs.push(0);
  }
  const N = solveLinear(rows, rhs);
  const out = active.map((c, i) => ({ id: c.id, label: c.label, normal: N[i]!, lifted: false }));
  if (lifted) out.push({ id: lifted.id, label: lifted.label, normal: 0, lifted: true });
  return out;
};

export interface StabilityInputs {
  components: MassComponent[];     // in the ground frame
  support: OscillatingAxleSupport;
  terrain: Terrain;
  /** Machine acceleration in the ground frame (m/s²). Omit or zero for a purely static case. */
  acceleration?: Vec3;
  /** Fraction of the centroid-to-edge distance below which status is "approaching". Documented educational band. */
  approachFraction?: number;
}

export interface StabilityResult {
  stage: SupportStage;
  status: StabilityStatus;
  /** Roll of the chassis relative to the oscillating axle after stop engagement (rad), 0 when free. */
  chassisRoll: number;
  /** Rigid-axle contact lifted clear of the ground once the stop engages. */
  liftedContact: SupportPoint | undefined;
  /** Height the lifted contact has risen (m). */
  liftedContactHeight: number;
  /** Component CGs as evaluated (rolled onto the stop if stage ≠ axle-free). */
  components: MassComponent[];
  cg: CgSummary;
  /** CGs before any chassis roll — the geometric configuration the operator set. */
  cgUnrolled: CgSummary;
  gravityDir: Vec3;
  /** Unit direction of the resultant specific force (gravity − acceleration). Equals gravityDir when static. */
  resultantDir: Vec3;
  /** Evaluation with GRAVITY ONLY (drives the centre-of-gravity line display). */
  gravityEval: PolygonEvaluation;
  /** Evaluation with gravity + quasi-static inertial force (drives the status). Same object as gravityEval when static. */
  resultantEval: PolygonEvaluation;
  quasiStatic: boolean;
  /** Ground-normal tyre reactions under the resultant (N). */
  reactions: TyreReaction[] | undefined;
  /** Ground-normal tyre reactions under gravity alone (N). */
  gravityReactions: TyreReaction[] | undefined;
  requiredFriction: number;
  availableFriction: number;
  slidingPredicted: boolean;
  /** Human-readable account of the support transition, for the explanation panel. */
  notes: string[];
}

const DEFAULT_APPROACH_FRACTION = 0.2;

const forcesFor = (components: readonly MassComponent[], dir: Vec3, g: number): AppliedForce[] =>
  components.map((c) => ({ id: c.id, at: c.cg, force: scale(dir, c.mass * g) }));

const freePolygon = (s: OscillatingAxleSupport): SupportPolygon => ({
  stage: "axle-free",
  description: "Rigid-axle contacts and oscillating-axle pivot (three-point support)",
  points: [s.rigidRight, s.rigidLeft, s.pivot], // anticlockwise viewed from above
});

const stopPolygon = (s: OscillatingAxleSupport, side: "left" | "right"): SupportPolygon =>
  side === "left"
    ? { stage: "axle-stop-left", description: "Left stop engaged: left rigid contact, both oscillating-axle contacts, right rigid contact lifted", points: [s.rigidLeft, s.oscLeft, s.oscRight, s.rigidRight] }
    : { stage: "axle-stop-right", description: "Right stop engaged: right rigid contact, both oscillating-axle contacts, left rigid contact lifted", points: [s.rigidRight, s.rigidLeft, s.oscLeft, s.oscRight] };

const centroid = (poly: SupportPolygon): Vec3 =>
  scale(poly.points.reduce((a, p) => add(a, p.p), { x: 0, y: 0, z: 0 }), 1 / poly.points.length);

const classify = (ev: PolygonEvaluation, approachFraction: number): StabilityStatus => {
  if (ev.liftOff) return "lift-off";
  if (ev.critical.margin < 0) return "incipient-tipping";
  const c = centroid(ev.polygon);
  const e = ev.critical;
  const inward = cross(ev.normal, e.axisDir);
  const centroidDist = dot(sub(c, e.from.p), inward);
  return e.margin < approachFraction * centroidDist ? "approaching-boundary" : "within-boundary";
};

/**
 * Static / quasi-static stability of a machine on an oscillating-axle support.
 * Pure function of the configuration: no thresholds decide tipping, only the force
 * line of action against the active support constraints.
 */
export const evaluateStability = (inp: StabilityInputs): StabilityResult => {
  const { support: s, terrain } = inp;
  const approachFraction = inp.approachFraction ?? DEFAULT_APPROACH_FRACTION;
  const gDir = gravityDirInGroundFrame(terrain);
  const a = inp.acceleration ?? { x: 0, y: 0, z: 0 };
  const quasiStatic = a.x !== 0 || a.y !== 0 || a.z !== 0;
  // Specific force per unit mass = g·ĝ − a. Its direction is the resultant line of action.
  const specific = sub(scale(gDir, G), a);
  const resultantDir = normalize(specific);
  const resultantMag = Math.hypot(specific.x, specific.y, specific.z);

  const notes: string[] = [];
  const cgUnrolled = summariseCg(inp.components);

  // Stage 1: oscillating axle free.
  let components = inp.components;
  let poly = freePolygon(s);
  let resultantEval = evaluatePolygon(poly, forcesFor(components, resultantDir, resultantMag));
  let gravityEval = quasiStatic ? evaluatePolygon(poly, forcesFor(components, gDir, G)) : resultantEval;
  let stage: SupportStage = "axle-free";
  let chassisRoll = 0;
  let liftedContact: SupportPoint | undefined;
  let liftedContactHeight = 0;

  const crit = resultantEval.critical;
  const isLateral = crit.from.id === s.pivot.id || crit.to.id === s.pivot.id;
  if (!resultantEval.liftOff && crit.margin < 0 && isLateral) {
    // The resultant crosses a pivot edge: the chassis rolls about that edge until the stop engages.
    const side: "left" | "right" = crit.from.id === s.rigidLeft.id || crit.to.id === s.rigidLeft.id ? "left" : "right";
    const far = side === "left" ? s.rigidRight : s.rigidLeft;
    const axisDir = normalize(sub(crit.to.p, crit.from.p));
    const alongPivot = Math.abs(dot(axisDir, s.pivotAxisDir));
    // Chassis-to-axle relative roll is the component of the rotation about the oscillation axis.
    const roll = alongPivot > 1e-6 ? s.stopAngle / alongPivot : s.stopAngle;
    // Choose the rotation sense that lifts the far rigid contact.
    const trial = rotateAboutLine(far.p, crit.from.p, axisDir, roll);
    const sign = trial.z > far.p.z ? 1 : -1;
    components = inp.components.map((c) => ({ ...c, cg: rotateAboutLine(c.cg, crit.from.p, axisDir, sign * roll) }));
    liftedContact = far;
    liftedContactHeight = rotateAboutLine(far.p, crit.from.p, axisDir, sign * roll).z - far.p.z;
    chassisRoll = s.stopAngle;
    stage = side === "left" ? "axle-stop-left" : "axle-stop-right";
    notes.push(
      `Resultant crossed the ${crit.id} axis by ${(-crit.margin * 1000).toFixed(0)} mm: chassis rolled ${(roll * 180 / Math.PI).toFixed(1)}° about it until the ${side} axle stop engaged (${far.label} lifted ${(liftedContactHeight * 1000).toFixed(0)} mm).`,
    );
    poly = stopPolygon(s, side);
    resultantEval = evaluatePolygon(poly, forcesFor(components, resultantDir, resultantMag));
    gravityEval = quasiStatic ? evaluatePolygon(poly, forcesFor(components, gDir, G)) : resultantEval;
    if (resultantEval.critical.margin < 0)
      notes.push(`With the stop engaged the resultant still lies outside the ${resultantEval.critical.id} axis: incipient tipping.`);
    else notes.push(`With the stop engaged the resultant lies ${(resultantEval.critical.margin * 1000).toFixed(0)} mm inside the ${resultantEval.critical.id} axis.`);
  }

  const reactions = tyreReactions(s, stage, liftedContact, resultantEval);
  const gravityReactions = quasiStatic ? tyreReactions(s, stage, liftedContact, gravityEval) : reactions;
  const requiredFriction = resultantEval.requiredFriction;
  const slidingPredicted = requiredFriction > terrain.friction;
  let status = classify(resultantEval, approachFraction);
  if (slidingPredicted && status !== "incipient-tipping" && status !== "lift-off") status = "sliding-predicted";

  return {
    stage, status, chassisRoll, liftedContact, liftedContactHeight,
    components, cg: summariseCg(components), cgUnrolled,
    gravityDir: gDir, resultantDir, gravityEval, resultantEval, quasiStatic, reactions, gravityReactions,
    requiredFriction, availableFriction: terrain.friction, slidingPredicted, notes,
  };
};
