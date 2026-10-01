import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { T } from "./coords.js";
import { M, treadTexture } from "./materials.js";
import type { Vec3 } from "@loadlab/physics";

/** Box given physics sizes (x fwd, y left, z up) and physics centre. */
export const pbox = (sx: number, sy: number, sz: number, c: Vec3, mat: THREE.Material, round = 0): THREE.Mesh => {
  const g = round > 0 ? new RoundedBoxGeometry(sx, sz, sy, 3, Math.min(round, sx / 2, sy / 2, sz / 2)) : new THREE.BoxGeometry(sx, sz, sy);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(T(c)); m.castShadow = true; m.receiveShadow = true;
  return m;
};
/** Box from physics min/max corners. */
export const pboxMinMax = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: THREE.Material, round = 0) =>
  pbox(x1 - x0, y1 - y0, z1 - z0, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 }, mat, round);

/** Cylinder between two physics points. */
export const pcyl = (a: Vec3, b: Vec3, r: number, mat: THREE.Material, seg = 16): THREE.Mesh => {
  const A = T(a), B = T(b), d = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; m.receiveShadow = true;
  return m;
};

/** Tyre + rim assembly. Axis along physics y. Centre at physics point c. */
export const wheel = (radius: number, width: number, opts: { lugs?: boolean; rimMat?: THREE.Material } = {}): THREE.Group => {
  const g = new THREE.Group();
  const prof: THREE.Vector2[] = [];
  const rr = radius, hw = width / 2, rb = radius * 0.62, sh = Math.min(hw * 0.45, radius * 0.18);
  prof.push(new THREE.Vector2(rb, -hw * 0.92));
  prof.push(new THREE.Vector2(rr - sh, -hw));
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(rr - sh + Math.cos(a) * sh, -hw + sh + Math.sin(a) * sh)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(rr - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh)); }
  prof.push(new THREE.Vector2(rb, hw * 0.92));
  const lathe = new THREE.LatheGeometry(prof, 64);
  lathe.rotateX(Math.PI / 2);
  const tread = treadTexture(opts.lugs ? 22 : 40);
  tread.repeat.set(1, 1);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.92, bumpMap: tread, bumpScale: opts.lugs ? 4 : 1.5 });
  const tyre = new THREE.Mesh(lathe, tyreMat); tyre.castShadow = true; tyre.receiveShadow = true; g.add(tyre);
  if (opts.lugs) {
    const n = 22, lugGeo = new THREE.BoxGeometry(radius * 0.16, radius * 0.07, width * 0.46);
    const inst = new THREE.InstancedMesh(lugGeo, tyreMat, n * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n * 2; i++) {
      const side = i % 2 === 0 ? 1 : -1, a = (Math.floor(i / 2) / n) * Math.PI * 2 + (side > 0 ? 0 : Math.PI / n);
      const p = new THREE.Vector3(Math.cos(a) * (radius + radius * 0.02), Math.sin(a) * (radius + radius * 0.02), side * width * 0.24);
      q.setFromEuler(new THREE.Euler(0, side * 0.45, a + Math.PI / 2));
      m4.compose(p, q, s); inst.setMatrixAt(i, m4);
    }
    inst.castShadow = true; g.add(inst);
  }
  const rimMat = opts.rimMat ?? M.rim;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(rb * 0.98, rb * 0.98, width * 0.86, 32, 1, true), rimMat);
  rim.rotation.x = Math.PI / 2; g.add(rim);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rb * 0.97, rb * 0.97, 0.02, 32), rimMat);
  disc.rotation.x = Math.PI / 2; g.add(disc);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rb * 0.32, rb * 0.36, width * 0.5, 20), M.steel);
  hub.rotation.x = Math.PI / 2; g.add(hub);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(rb * 0.05, rb * 0.05, width * 0.56, 6), M.steel);
    nut.rotation.x = Math.PI / 2; nut.position.set(Math.cos(a) * rb * 0.45, Math.sin(a) * rb * 0.45, 0); g.add(nut);
  }
  return g;
};
export const placeWheel = (w: THREE.Group, c: Vec3) => { w.position.copy(T(c)); return w; };

/** Hydraulic cylinder that can be re-aimed between two physics points each frame. */
export class HydCylinder extends THREE.Group {
  private barrel: THREE.Mesh; private rod: THREE.Mesh; private barrelLen: number;
  constructor(public rBarrel: number, barrelLen: number, mat: THREE.Material = M.paintDark) {
    super();
    this.barrelLen = barrelLen;
    this.barrel = new THREE.Mesh(new THREE.CylinderGeometry(rBarrel, rBarrel, 1, 18), mat);
    this.rod = new THREE.Mesh(new THREE.CylinderGeometry(rBarrel * 0.55, rBarrel * 0.55, 1, 14), M.chrome);
    this.barrel.castShadow = this.rod.castShadow = true;
    this.add(this.barrel, this.rod);
  }
  set(a: Vec3, b: Vec3) {
    const A = T(a), B = T(b), d = B.clone().sub(A), L = d.length();
    this.position.copy(A);
    this.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    const bl = Math.min(this.barrelLen, L * 0.95);
    this.barrel.scale.set(1, bl, 1); this.barrel.position.set(0, bl / 2, 0);
    const rl = Math.max(0.01, L - bl * 0.6);
    this.rod.scale.set(1, rl, 1); this.rod.position.set(0, L - rl / 2, 0);
  }
}

/** Simple articulated operator figure: hi-vis vest, hard hat. Origin at hip point. No injury depiction. */
export class OperatorFigure extends THREE.Group {
  private thighL = new THREE.Group(); private thighR = new THREE.Group();
  private shinL = new THREE.Group(); private shinR = new THREE.Group();
  private armL = new THREE.Group(); private armR = new THREE.Group();
  private torso = new THREE.Group();
  constructor(vestTex: THREE.Texture) {
    super();
    const vest = new THREE.MeshStandardMaterial({ map: vestTex, roughness: 0.75 });
    const cap = (r: number, l: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 12), mat); m.castShadow = true; return m; };
    const pelvis = cap(0.13, 0.12, M.workwear); pelvis.rotation.z = Math.PI / 2; this.add(pelvis);
    this.add(this.torso);
    const chest = cap(0.17, 0.32, vest); chest.position.y = 0.3; this.torso.add(chest);
    const neck = cap(0.05, 0.05, M.skin); neck.position.y = 0.56; this.torso.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), M.skin); head.position.y = 0.68; head.castShadow = true; this.torso.add(head);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.hardhat); hat.position.y = 0.71; this.torso.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 20), M.hardhat); brim.position.set(0.03, 0.71, 0); this.torso.add(brim);
    for (const [arm, z] of [[this.armL, -0.21], [this.armR, 0.21]] as const) {
      arm.position.set(0, 0.48, z); this.torso.add(arm);
      const up = cap(0.05, 0.26, vest); up.position.y = -0.16; arm.add(up);
      const fore = cap(0.045, 0.24, M.workwear); fore.position.set(0.14, -0.33, 0); fore.rotation.z = Math.PI / 2.4; arm.add(fore);
    }
    for (const [th, sh, z] of [[this.thighL, this.shinL, -0.1], [this.thighR, this.shinR, 0.1]] as const) {
      th.position.set(0, 0, z); this.add(th);
      const t = cap(0.075, 0.32, M.workwear); t.position.y = -0.2; th.add(t);
      sh.position.y = -0.42; th.add(sh);
      const s = cap(0.06, 0.3, M.workwear); s.position.y = -0.2; sh.add(s);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.11), M.boots); boot.position.set(0.07, -0.42, 0); boot.castShadow = true; sh.add(boot);
    }
    this.seated();
  }
  seated() {
    this.torso.rotation.set(0, 0, 0.08);
    for (const th of [this.thighL, this.thighR]) th.rotation.set(0, 0, Math.PI / 2);
    for (const sh of [this.shinL, this.shinR]) sh.rotation.set(0, 0, -Math.PI / 2);
    this.armL.rotation.set(0, 0, 0.9); this.armR.rotation.set(0, 0, 0.9);
  }
  airborne(phase: number) {
    this.torso.rotation.set(0.2 * Math.sin(phase * 3), 0, -0.2);
    this.thighL.rotation.set(0.3, 0, 0.6 + 0.3 * Math.sin(phase * 4)); this.thighR.rotation.set(-0.3, 0, 0.3 - 0.3 * Math.sin(phase * 4));
    this.shinL.rotation.set(0, 0, -0.7); this.shinR.rotation.set(0, 0, -0.4);
    this.armL.rotation.set(-1.2, 0, 1.6); this.armR.rotation.set(1.2, 0, 1.4);
  }
  lying() {
    this.torso.rotation.set(0, 0, 0);
    for (const th of [this.thighL, this.thighR]) th.rotation.set(0, 0, Math.PI);
    for (const sh of [this.shinL, this.shinR]) sh.rotation.set(0, 0, 0.15);
    this.armL.rotation.set(-0.5, 0, 0.3); this.armR.rotation.set(0.5, 0, 0.3);
  }
}
