import * as THREE from "three";
import { type LoaderProfile, type LoaderState, type Frame, transformPoint, v } from "@loadlab/physics";
import { applyFrame, T, rotationAboutLine, mat3ToThree } from "./coords.js";
import { M, hiVisTexture } from "./materials.js";
import { pboxMinMax, pcyl, wheel, placeWheel, HydCylinder, OperatorFigure } from "./parts.js";
import { buildBucketHeap, type BulkMaterial } from "./loads.js";

/**
 * Procedural articulated front end loader. Ground-frame origin at the articulation joint.
 *   root → tip → roll → rearFrame, frontFrame (articulation), arms (arm frame), bucket (bucket frame)
 *              → rearAxle (oscillating, stays on the ground)
 * Linkage cylinders are drawn between physics points; they carry no mass of their own beyond the
 * profile's "arms" component.
 */
export class LoaderModel {
  root = new THREE.Group();
  tip = new THREE.Group();
  roll = new THREE.Group();
  rearFrame = new THREE.Group();
  frontFrame = new THREE.Group();
  arms = new THREE.Group();
  bucket = new THREE.Group();
  rearAxle = new THREE.Group();
  heapHolder = new THREE.Group();
  heap: THREE.Mesh | null = null;
  operator: OperatorFigure;
  private liftCyl: HydCylinder[] = [];
  private tiltCyl: HydCylinder;
  private tiltLink: THREE.Mesh;
  private wheels: THREE.Group[] = [];

  constructor(public profile: LoaderProfile) {
    const g = profile.geometry;
    for (const o of [this.root, this.tip, this.roll]) o.matrixAutoUpdate = false;
    this.root.add(this.tip); this.tip.add(this.roll, this.rearAxle);
    this.roll.add(this.rearFrame, this.frontFrame, this.arms, this.bucket);
    this.bucket.add(this.heapHolder);
    const s = g.tyre.radius / 0.675; // scale detail with machine size

    // --- rear frame ---
    const rb = g.rearBody, rw = rb.width / 2, R = this.rearFrame;
    R.add(pboxMinMax(g.rearAxleX - 0.9 * s, -0.25, -0.45 * s, 0.45 * s, 0.5 * s, 1.15 * s, M.paintDark));
    R.add(pboxMinMax(rb.rearX + 0.35 * s, g.cab.rearX + 0.05, -rw + 0.12, rw - 0.12, 1.1 * s, rb.height, M.paintYellow, 0.12 * s));
    R.add(pboxMinMax(rb.rearX, rb.rearX + 0.5 * s, -rw, rw, 0.55 * s, rb.height - 0.15 * s, M.paintYellow, 0.15 * s));
    // radiator grille
    const grille = new THREE.Group();
    for (let i = 0; i < 9; i++) grille.add(pboxMinMax(rb.rearX - 0.01, rb.rearX + 0.02, -rw * 0.7, rw * 0.7, 0.9 * s + i * 0.09 * s, 0.93 * s + i * 0.09 * s, M.black));
    R.add(grille);
    // exhaust + air intake
    R.add(pcyl(v(g.cab.rearX - 0.5 * s, 0.35 * s, rb.height), v(g.cab.rearX - 0.5 * s, 0.35 * s, rb.height + 0.55 * s), 0.07 * s, M.black));
    R.add(pcyl(v(g.cab.rearX - 0.5 * s, -0.35 * s, rb.height), v(g.cab.rearX - 0.5 * s, -0.35 * s, rb.height + 0.3 * s), 0.1 * s, M.paintDark));
    // rear fenders
    for (const sd of [1, -1]) {
      const y0 = sd * (g.trackRear / 2), wy = g.tyre.width / 2 + 0.06;
      R.add(pboxMinMax(g.rearAxleX - g.tyre.radius - 0.1, g.rearAxleX + g.tyre.radius * 0.7, y0 - wy, y0 + wy, 2 * g.tyre.radius + 0.06, 2 * g.tyre.radius + 0.12, M.paintYellow, 0.03));
    }
    // cab
    const c = g.cab, cw = c.width / 2, floor = 1.25 * s;
    R.add(pboxMinMax(c.rearX, c.frontX, -cw, cw, floor - 0.1, floor, M.paintDark));
    for (const x of [c.frontX, c.rearX]) for (const y of [cw, -cw]) R.add(pboxMinMax(x - 0.05, x + 0.05, y - 0.05, y + 0.05, floor, c.ropsHeight, M.paintYellow));
    R.add(pboxMinMax(c.rearX - 0.08, c.frontX + 0.08, -cw - 0.08, cw + 0.08, c.ropsHeight, c.ropsHeight + 0.12 * s, M.paintYellow, 0.05));
    const glass = (x0: number, x1: number, y0: number, y1: number) => { const m = pboxMinMax(x0, x1, y0, y1, floor + 0.05, c.ropsHeight - 0.03, M.glass); m.castShadow = false; R.add(m); };
    glass(c.frontX - 0.02, c.frontX + 0.01, -cw + 0.05, cw - 0.05); glass(c.rearX - 0.01, c.rearX + 0.02, -cw + 0.05, cw - 0.05);
    glass(c.rearX + 0.05, c.frontX - 0.05, cw - 0.02, cw + 0.01); glass(c.rearX + 0.05, c.frontX - 0.05, -cw - 0.01, -cw + 0.02);
    // seat, console, steering
    const hip = profile.operatorSeat.hip;
    R.add(pboxMinMax(hip.x - 0.25, hip.x + 0.2, -0.26, 0.26, floor + 0.15, hip.z - 0.05, M.seat, 0.05));
    R.add(pboxMinMax(hip.x - 0.32, hip.x - 0.22, -0.25, 0.25, hip.z - 0.05, hip.z + 0.6, M.seat, 0.05));
    R.add(pcyl(v(c.frontX - 0.2, 0, floor), v(hip.x + 0.42, 0, hip.z + 0.25), 0.04, M.black));
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 10, 32), M.black);
    sw.position.copy(T(v(hip.x + 0.42, 0, hip.z + 0.27))); sw.rotation.set(0, Math.PI / 2, 0); sw.rotateX(0.7); R.add(sw);
    // steps
    for (let i = 0; i < 3; i++) R.add(pboxMinMax(c.rearX + 0.1, c.rearX + 0.5, cw + 0.05, cw + 0.25, 0.4 * s + i * 0.3 * s, 0.43 * s + i * 0.3 * s, M.steel));
    // hitch (rear half)
    R.add(pboxMinMax(-0.45 * s, 0.05, -0.35 * s, 0.35 * s, 0.6 * s, 1.0 * s, M.paintDark));

    // --- rear axle (oscillating) ---
    this.rearAxle.add(pcyl(v(g.rearAxleX, -g.trackRear / 2, g.tyre.radius), v(g.rearAxleX, g.trackRear / 2, g.tyre.radius), 0.12 * s, M.paintDark));
    this.rearAxle.add(pboxMinMax(g.rearAxleX - 0.25 * s, g.rearAxleX + 0.25 * s, -0.25 * s, 0.25 * s, g.tyre.radius - 0.15 * s, g.rearAxlePivotHeight, M.paintDark));
    for (const sd of [1, -1]) { const w = placeWheel(wheel(g.tyre.radius, g.tyre.width, { lugs: true, rimMat: M.rimLoader }), v(g.rearAxleX, sd * g.trackRear / 2, g.tyre.radius)); this.wheels.push(w); this.rearAxle.add(w); }

    // --- front frame (articulation frame) ---
    const F = this.frontFrame;
    F.add(pboxMinMax(0.05, g.frontAxleX + 0.55 * s, -0.42 * s, 0.42 * s, 0.5 * s, 1.15 * s, M.paintDark));
    F.add(pboxMinMax(0.05, 0.5 * s, -0.3 * s, 0.3 * s, 0.65 * s, 0.95 * s, M.steel));
    for (const sd of [1, -1]) {
      const y = sd * 0.58 * s;
      F.add(pboxMinMax(g.armPivot.x - 0.35 * s, g.armPivot.x + 0.15 * s, y - 0.05 * s, y + 0.05 * s, 0.6 * s, g.armPivot.z + 0.15 * s, M.paintDark, 0.03));
      F.add(pcyl(v(g.armPivot.x, y - 0.08 * s, g.armPivot.z), v(g.armPivot.x, y + 0.08 * s, g.armPivot.z), 0.07 * s, M.steel));
      const y0 = sd * (g.trackFront / 2), wy = g.tyre.width / 2 + 0.06;
      F.add(pboxMinMax(g.frontAxleX - g.tyre.radius * 0.6, g.frontAxleX + g.tyre.radius + 0.1, y0 - wy, y0 + wy, 2 * g.tyre.radius + 0.06, 2 * g.tyre.radius + 0.12, M.paintYellow, 0.03));
      const fw = placeWheel(wheel(g.tyre.radius, g.tyre.width, { lugs: true, rimMat: M.rimLoader }), v(g.frontAxleX, sd * g.trackFront / 2, g.tyre.radius));
      this.wheels.push(fw); F.add(fw);
    }
    F.add(pcyl(v(g.frontAxleX, -g.trackFront / 2, g.tyre.radius), v(g.frontAxleX, g.trackFront / 2, g.tyre.radius), 0.13 * s, M.paintDark));
    // headlights on tower
    for (const sd of [1, -1]) F.add(pboxMinMax(g.armPivot.x - 0.1, g.armPivot.x + 0.02, sd * 0.7 * s - 0.08, sd * 0.7 * s + 0.08, g.armPivot.z - 0.2, g.armPivot.z - 0.08, new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0x555544 })));

    // --- lift arms (arm frame: origin at arm pivot, x along the arm) ---
    const A = this.arms, L = g.armLength;
    for (const sd of [1, -1]) {
      const y = sd * 0.58 * s;
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.12 * s); shape.lineTo(L * 0.45, -0.22 * s); shape.lineTo(L, -0.1 * s); shape.lineTo(L, 0.1 * s); shape.lineTo(L * 0.45, 0.06 * s); shape.lineTo(0, 0.12 * s); shape.closePath();
      const arm = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12 * s, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015 }), M.paintYellow);
      arm.position.copy(T(v(0, y + 0.06 * s, 0))); arm.castShadow = true; A.add(arm);
    }
    A.add(pcyl(v(L * 0.42, -0.58 * s, -0.12 * s), v(L * 0.42, 0.58 * s, -0.12 * s), 0.1 * s, M.paintYellow));
    for (const sd of [1, -1]) { const c2 = new HydCylinder(0.1 * s, 1.1 * s); this.liftCyl.push(c2); this.roll.add(c2); void sd; }
    this.tiltCyl = new HydCylinder(0.11 * s, 1.0 * s); this.roll.add(this.tiltCyl);
    this.tiltLink = pcyl(v(0, 0, 0), v(0, 0, 1), 0.05 * s, M.paintYellow); this.tiltLink.matrixAutoUpdate = true; this.roll.add(this.tiltLink);

    // --- bucket (bucket frame: origin at the hinge pin) ---
    const B = this.bucket, Lf = g.bucketFloorLength, Hb = g.bucketBackHeight, W = g.bucketWidth;
    const side = new THREE.Shape();
    side.moveTo(-0.05, -0.05); side.lineTo(Lf, -0.05); side.lineTo(Lf * 0.92, 0.22 * s); side.lineTo(Lf * 0.45, Hb * 0.88); side.lineTo(-0.12, Hb); side.lineTo(-0.22, Hb * 0.8); side.lineTo(-0.2, Hb * 0.25); side.closePath();
    for (const sd of [1, -1]) {
      const sp = new THREE.Mesh(new THREE.ExtrudeGeometry(side, { depth: 0.035, bevelEnabled: false }), M.paintYellow);
      sp.position.copy(T(v(0, sd * W / 2 + (sd > 0 ? 0 : 0.035), 0))); sp.castShadow = true; B.add(sp);
    }
    // floor + curved back as a thick open curve
    const shell = new THREE.Shape(), pts: [number, number][] = [];
    pts.push([Lf, -0.05]); pts.push([0.1, -0.05]);
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 - (i / 10) * (Math.PI * 0.62); pts.push([0.1 + Math.cos(a) * 0.3 * s, 0.25 * s + Math.sin(a) * 0.3 * s]); }
    pts.push([-0.22, Hb * 0.8]); pts.push([-0.12, Hb]);
    shell.moveTo(pts[0]![0], pts[0]![1]); for (const [x, y] of pts.slice(1)) shell.lineTo(x, y);
    for (const [x, y] of [...pts].reverse()) shell.lineTo(x + 0.03, y + 0.04);
    shell.closePath();
    const sh = new THREE.Mesh(new THREE.ExtrudeGeometry(shell, { depth: W, bevelEnabled: false }), M.paintYellow);
    sh.position.copy(T(v(0, W / 2, 0))); sh.castShadow = true; sh.receiveShadow = true; B.add(sh);
    B.add(pboxMinMax(Lf - 0.08, Lf + 0.04, -W / 2, W / 2, -0.07, -0.02, M.steel));
    B.add(pboxMinMax(-0.2, -0.05, -W / 2, W / 2, Hb - 0.08, Hb + 0.02, M.paintYellow));
    for (const sd of [1, -1]) B.add(pboxMinMax(-0.2, 0.05, sd * 0.58 * s - 0.08, sd * 0.58 * s + 0.08, -0.05, 0.3 * s, M.paintDark));

    this.operator = new OperatorFigure(hiVisTexture());
    this.operator.position.copy(T(v(hip.x, hip.y, hip.z)));
    this.roll.add(this.operator);
  }

  /** Roll the wheels by the distance travelled (m). Articulation is set through update(). */
  setWheels(dist: number, _steer: number) {
    for (const w of this.wheels) w.rotation.z = -dist / this.profile.geometry.tyre.radius;
  }

  setHeap(material: BulkMaterial | null, volume: number, lateralShift: number) {
    if (this.heap) { this.heap.removeFromParent(); this.heap.geometry.dispose(); this.heap = null; }
    if (!material || volume <= 0) return;
    const g = this.profile.geometry;
    this.heap = buildBucketHeap(material, volume, { floor: g.bucketFloorLength, back: g.bucketBackHeight, width: g.bucketWidth, struck: g.bucketStruckVolume }, lateralShift);
    this.heapHolder.add(this.heap);
  }

  update(s: LoaderState) {
    const g = this.profile.geometry, sc = g.tyre.radius / 0.675;
    applyFrame(this.frontFrame, s.geometry.frontFrame);
    applyFrame(this.arms, s.geometry.armFrame);
    applyFrame(this.bucket, s.geometry.bucketFrame);
    for (const [i, sd] of [[0, 1], [1, -1]] as const)
      this.liftCyl[i]!.set(transformPoint(s.geometry.frontFrame, v(g.armPivot.x - 0.2 * sc, sd * 0.45 * sc, 0.75 * sc)), transformPoint(s.geometry.armFrame, v(g.armLength * 0.42, sd * 0.45 * sc, -0.2 * sc)));
    const bell = transformPoint(s.geometry.armFrame, v(g.armLength * 0.42, 0, 0.35 * sc));
    this.tiltCyl.set(transformPoint(s.geometry.frontFrame, v(g.armPivot.x - 0.1, 0, 1.15 * sc)), bell);
    const top = T(transformPoint(s.geometry.bucketFrame, v(-0.15, 0, g.bucketBackHeight * 0.95))), b2 = T(bell);
    const d = top.clone().sub(b2);
    this.tiltLink.position.copy(b2).add(top).multiplyScalar(0.5);
    this.tiltLink.scale.set(1, d.length(), 1);
    this.tiltLink.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const r = s.stability.roll;
    this.roll.matrix.copy(r ? rotationAboutLine(r.point, r.axis, r.angle) : new THREE.Matrix4());
    this.roll.matrixWorldNeedsUpdate = true;
    this.setPose(null);
  }

  /** Rigid pose of the whole machine from the dynamics (null = as evaluated). */
  setPose(f: Frame | null) {
    this.tip.matrix.copy(f ? mat3ToThree(f.R, f.t) : new THREE.Matrix4());
    this.tip.matrixWorldNeedsUpdate = true;
  }
}
