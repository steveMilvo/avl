/**
 * Minimal 3D vector / 3x3 matrix helpers.
 *
 * Coordinate convention used throughout the physics core (see docs/03-architecture.md):
 *   x = forward (toward forks / bucket), y = left, z = up. Right-handed. SI units.
 * A "ground frame" has z normal to the local ground plane and tyre contacts at z = 0.
 */
export interface Vec3 { x: number; y: number; z: number }

export const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

export const add = (a: Vec3, b: Vec3): Vec3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => v(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const norm = (a: Vec3): number => Math.sqrt(dot(a, a));
export const normalize = (a: Vec3): Vec3 => {
  const n = norm(a);
  if (n === 0) throw new Error("cannot normalise zero vector");
  return scale(a, 1 / n);
};
export const dist = (a: Vec3, b: Vec3): number => norm(sub(a, b));

/** Row-major 3x3 matrix. m[r][c]. */
export type Mat3 = [[number, number, number], [number, number, number], [number, number, number]];

export const identity = (): Mat3 => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

export const apply = (m: Mat3, p: Vec3): Vec3 =>
  v(
    m[0][0] * p.x + m[0][1] * p.y + m[0][2] * p.z,
    m[1][0] * p.x + m[1][1] * p.y + m[1][2] * p.z,
    m[2][0] * p.x + m[2][1] * p.y + m[2][2] * p.z,
  );

export const transpose = (m: Mat3): Mat3 => [
  [m[0][0], m[1][0], m[2][0]],
  [m[0][1], m[1][1], m[2][1]],
  [m[0][2], m[1][2], m[2][2]],
];

export const mul = (a: Mat3, b: Mat3): Mat3 => {
  const r = identity();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i]![j] = a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!;
  return r;
};

/** Build a rotation matrix whose columns are the given basis vectors (local -> parent). */
export const fromColumns = (cx: Vec3, cy: Vec3, cz: Vec3): Mat3 => [
  [cx.x, cy.x, cz.x],
  [cx.y, cy.y, cz.y],
  [cx.z, cy.z, cz.z],
];

/** Rodrigues rotation about a unit axis by angle (radians), right-hand rule. */
export const axisAngle = (axis: Vec3, angle: number): Mat3 => {
  const u = normalize(axis);
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [
    [t * u.x * u.x + c, t * u.x * u.y - s * u.z, t * u.x * u.z + s * u.y],
    [t * u.x * u.y + s * u.z, t * u.y * u.y + c, t * u.y * u.z - s * u.x],
    [t * u.x * u.z - s * u.y, t * u.y * u.z + s * u.x, t * u.z * u.z + c],
  ];
};

/** Rotation about the y axis. Positive angle moves +z toward +x (i.e. tips a vertical mast forward). */
export const rotY = (angle: number): Mat3 => axisAngle(v(0, 1, 0), angle);
/** Rotation about the z axis. Positive angle turns +x toward +y (i.e. turns the nose to the left). */
export const rotZ = (angle: number): Mat3 => axisAngle(v(0, 0, 1), angle);
/** Rotation about the x axis. Positive angle rolls +y toward +z (left side rises). */
export const rotX = (angle: number): Mat3 => axisAngle(v(1, 0, 0), angle);

/** Rotate point p about an axis line (through `origin`, direction `axis`) by `angle`. */
export const rotateAboutLine = (p: Vec3, origin: Vec3, axis: Vec3, angle: number): Vec3 =>
  add(apply(axisAngle(axis, angle), sub(p, origin)), origin);

/** A rigid transform: p_parent = R * p_local + t. */
export interface Frame { R: Mat3; t: Vec3 }
export const frame = (R: Mat3, t: Vec3): Frame => ({ R, t });
export const transformPoint = (f: Frame, p: Vec3): Vec3 => add(apply(f.R, p), f.t);
export const transformDir = (f: Frame, d: Vec3): Vec3 => apply(f.R, d);
/** Compose: parent <- a <- b (apply b first, then a). */
export const compose = (a: Frame, b: Frame): Frame => frame(mul(a.R, b.R), transformPoint(a, b.t));
export const IDENTITY_FRAME: Frame = { R: identity(), t: ZERO };

export const approxEq = (a: number, b: number, tol = 1e-9): boolean => Math.abs(a - b) <= tol;

/** Solve A x = b for a small dense system by Gaussian elimination with partial pivoting. */
export const solveLinear = (A: number[][], b: number[]): number[] => {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    if (Math.abs(M[piv]![c]!) < 1e-14) throw new Error("singular system");
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / M[c]![c]!;
      for (let k = c; k <= n; k++) M[r]![k] = M[r]![k]! - f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
};
