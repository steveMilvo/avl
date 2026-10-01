import { type Vec3, sub, add, scale, dot, cross, normalize, norm } from "./math.js";

/** A ground-contact or constraint point that can act as a tipping-axis end. */
export interface SupportPoint { id: string; label: string; p: Vec3 }

/**
 * A support polygon = ordered support points (anticlockwise when viewed from above the
 * ground plane) whose consecutive pairs are candidate tipping axes. Points need not be
 * coplanar with the tyre contacts (e.g. a rear-axle pivot sits above the ground), so the
 * polygon carries its own best-fit plane.
 */
export interface SupportPolygon {
  stage: string;        // e.g. "rear-axle-free", "rear-axle-stop-left"
  description: string;
  points: SupportPoint[];
}

export interface EdgeResult {
  id: string;               // "FL-FR"
  from: SupportPoint;
  to: SupportPoint;
  axisDir: Vec3;            // unit vector from -> to
  /** Perpendicular in-plane distance from the force line's intersection to the axis. +ve = inside. */
  margin: number;
  /** Net moment of all applied forces about this axis; +ve = restoring (holds machine on its support). N·m */
  stabilisingMoment: number;
  /** Per-component contribution to stabilisingMoment (same sign convention). */
  contributions: { id: string; moment: number }[];
}

export interface AppliedForce { id: string; at: Vec3; force: Vec3 }

export interface PolygonEvaluation {
  polygon: SupportPolygon;
  normal: Vec3;                 // unit plane normal, pointing away from the ground (toward the machine)
  /** Where the resultant force line of action meets the support plane; undefined if it never does (lift-off). */
  intersection: Vec3 | undefined;
  /** Where the same line meets the ground plane z = 0 of the ground frame (the marker drawn on the ground). */
  groundIntersection: Vec3 | undefined;
  liftOff: boolean;
  edges: EdgeResult[];
  /** The edge with the smallest margin. */
  critical: EdgeResult;
  /** Total applied force (N), ground frame. */
  totalForce: Vec3;
  /** Component of the total force normal to the GROUND plane (N, positive = pressing into ground). */
  normalLoad: number;
  /** Component of the total force within the ground plane (N). */
  tangentialLoad: number;
  /** |tangential| / |normal| — the friction coefficient needed for no sliding. */
  requiredFriction: number;
}

const planeNormal = (pts: SupportPoint[]): Vec3 => {
  if (pts.length < 3) throw new Error("support polygon needs ≥ 3 points");
  const a = pts[0]!.p, b = pts[1]!.p, c = pts[2]!.p;
  let n = normalize(cross(sub(b, a), sub(c, a)));
  if (n.z < 0) n = scale(n, -1);
  return n;
};

/**
 * Evaluate a set of applied forces against a support polygon.
 * All quantities in the same (ground) frame. Forces include gravity and, if used,
 * quasi-static inertial forces; the caller decides what is included and labels it.
 */
export const evaluatePolygon = (polygon: SupportPolygon, forces: readonly AppliedForce[]): PolygonEvaluation => {
  const n = planeNormal(polygon.points);
  const origin = polygon.points[0]!.p;

  // Resultant force and its line of action (through the "force centre" r such that Σ(rᵢ×Fᵢ) = r×F).
  let F: Vec3 = { x: 0, y: 0, z: 0 };
  let M: Vec3 = { x: 0, y: 0, z: 0 }; // moment about `origin`
  for (const f of forces) {
    F = add(F, f.force);
    M = add(M, cross(sub(f.at, origin), f.force));
  }
  const Fmag = norm(F);
  if (Fmag === 0) throw new Error("zero resultant force");
  const Fn = -F.z;                         // ground-normal component, positive when pressing into ground
  const Ft = Math.hypot(F.x, F.y);
  const dir = scale(F, 1 / Fmag);

  // Point on the line of action: r0 = (F × M)/|F|²  (relative to origin). Line: r0 + s·dir.
  const r0 = add(origin, scale(cross(F, M), 1 / (Fmag * Fmag)));
  const denom = dot(dir, n);
  let intersection: Vec3 | undefined;
  let groundIntersection: Vec3 | undefined;
  let liftOff = false;
  if (denom >= 0) {
    liftOff = true; // resultant does not push the machine onto its support
  } else {
    const s = dot(sub(origin, r0), n) / denom;
    intersection = add(r0, scale(dir, s));
    if (dir.z < 0) groundIntersection = add(r0, scale(dir, -r0.z / dir.z));
  }

  const edges: EdgeResult[] = [];
  const pts = polygon.points;
  for (let i = 0; i < pts.length; i++) {
    const from = pts[i]!, to = pts[(i + 1) % pts.length]!;
    const axisDir = normalize(sub(to.p, from.p));
    const inward = cross(n, axisDir);
    const margin = intersection ? dot(sub(intersection, from.p), inward) : Number.NEGATIVE_INFINITY;
    const contributions = forces.map((f) => ({
      id: f.id,
      moment: -dot(cross(sub(f.at, from.p), f.force), axisDir),
    }));
    const stabilisingMoment = contributions.reduce((s, c) => s + c.moment, 0);
    edges.push({ id: `${from.id}-${to.id}`, from, to, axisDir, margin, stabilisingMoment, contributions });
  }
  const critical = edges.reduce((a, b) => (b.margin < a.margin ? b : a));

  return {
    polygon, normal: n, intersection, groundIntersection, liftOff, edges, critical, totalForce: F,
    normalLoad: Fn, tangentialLoad: Ft, requiredFriction: Fn > 0 ? Ft / Fn : Number.POSITIVE_INFINITY,
  };
};
