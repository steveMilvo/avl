import { type Vec3, type Mat3, v, normalize, cross, sub, scale, dot, fromColumns, transpose, apply } from "./math.js";

/**
 * Terrain and machine orientation.
 *
 * World frame: Z up, X = horizontal uphill direction of the slope, Y = Z × X.
 * The ground is a plane rising in +X at `slopeAngle`. `heading` is the angle of the
 * machine's forward axis measured anticlockwise (viewed from above) from the uphill
 * direction: 0 = facing uphill, π = facing downhill, +π/2 = facing across the slope
 * with uphill on the machine's RIGHT, -π/2 = across with uphill on the LEFT.
 *
 * Orientation and travel direction are independent: a machine facing uphill can travel
 * uphill forwards or downhill in reverse; travel direction only enters via acceleration.
 */
export interface Terrain {
  /** Ground inclination (radians), 0 = level. */
  slopeAngle: number;
  /** Machine heading relative to uphill (radians), see above. */
  heading: number;
  /** Coefficient of friction between tyres and ground (aggregate). */
  friction: number;
}

export const LEVEL: Terrain = { slopeAngle: 0, heading: 0, friction: 0.7 };

/** Convert "longitudinal grade + cross grade" into (slopeAngle, heading).
 *  longGrade: tan of the angle the ground rises in the machine's forward direction.
 *  crossGrade: tan of the angle the ground rises toward the machine's LEFT. */
export const terrainFromGrades = (longGrade: number, crossGrade: number, friction = 0.7): Terrain => {
  const slopeAngle = Math.atan(Math.hypot(longGrade, crossGrade));
  // Uphill direction in the machine's horizontal frame is (longGrade, crossGrade).
  // heading = angle from uphill to forward (anticlockwise) = -atan2(crossGrade, longGrade).
  const heading = -Math.atan2(crossGrade, longGrade);
  return { slopeAngle, heading, friction };
};

/** Decompose a terrain into the grade the ground rises forward and the grade it rises to the left. */
export const gradesFromTerrain = (t: Terrain): { longGrade: number; crossGrade: number } => {
  const g = Math.tan(t.slopeAngle);
  return { longGrade: g * Math.cos(t.heading), crossGrade: -g * Math.sin(t.heading) };
};

/** Unit ground normal in world coordinates. */
export const groundNormalWorld = (t: Terrain): Vec3 =>
  v(-Math.sin(t.slopeAngle), 0, Math.cos(t.slopeAngle));

/**
 * Rotation matrix from the machine's ground frame (x forward along the ground, z = ground normal)
 * to the world frame.
 */
export const groundFrameToWorld = (t: Terrain): Mat3 => {
  const n = groundNormalWorld(t);
  const fh = v(Math.cos(t.heading), Math.sin(t.heading), 0);
  const f = normalize(sub(fh, scale(n, dot(fh, n))));
  const y = cross(n, f);
  return fromColumns(f, y, n);
};

/** Unit vector pointing in the direction gravity acts, expressed in the machine ground frame. */
export const gravityDirInGroundFrame = (t: Terrain): Vec3 =>
  apply(transpose(groundFrameToWorld(t)), v(0, 0, -1));
