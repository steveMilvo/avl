import * as THREE from "three";
import type { Vec3, Frame, Mat3 } from "@loadlab/physics";

/**
 * Physics ground frame: x forward, y left, z up (right-handed).
 * Three.js: y up. Mapping: three = (x, z, −y). This is a proper rotation, so handedness is kept.
 */
export const T = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p.x, p.z, -p.y);
export const fromThree = (p: THREE.Vector3): Vec3 => ({ x: p.x, y: -p.z, z: p.y });

const C = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
const Ci = C.clone().invert();

export const mat3ToThree = (R: Mat3, t: Vec3 = { x: 0, y: 0, z: 0 }): THREE.Matrix4 => {
  const m = new THREE.Matrix4().set(
    R[0][0], R[0][1], R[0][2], t.x,
    R[1][0], R[1][1], R[1][2], t.y,
    R[2][0], R[2][1], R[2][2], t.z,
    0, 0, 0, 1,
  );
  return C.clone().multiply(m).multiply(Ci);
};

/** Set an object's local matrix from a physics frame (local → parent, both in physics axes). */
export const applyFrame = (obj: THREE.Object3D, f: Frame): void => {
  obj.matrixAutoUpdate = false;
  obj.matrix.copy(mat3ToThree(f.R, f.t));
  obj.matrixWorldNeedsUpdate = true;
};

/** Rotation about a physics-space line, as a three.js matrix. */
export const rotationAboutLine = (point: Vec3, axis: Vec3, angle: number): THREE.Matrix4 => {
  const p = T(point), a = T(axis).normalize();
  return new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)
    .multiply(new THREE.Matrix4().makeRotationAxis(a, angle))
    .multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
};
