import * as THREE from "three";
import { type ForkliftProfile, type ForkliftState, type Frame, innerMastRise, transformPoint, v } from "@loadlab/physics";
import { applyFrame, T, rotationAboutLine, mat3ToThree } from "./coords.js";
import { M, hiVisTexture } from "./materials.js";
import { pboxMinMax, pcyl, wheel, placeWheel, HydCylinder, OperatorFigure } from "./parts.js";
import { buildForkLoad, type ForkLoadKind } from "./loads.js";

/**
 * Procedural counterbalanced forklift whose dimensions come from the profile and whose moving
 * parts are positioned by the physics frames (mast, carriage). The renderer never computes physics.
 *
 * Hierarchy (all in the physics ground frame):
 *   root → tip (dynamic rotation about the hinge) → roll (stop-engagement roll) → chassis, mast, carriage
 *                                                → rearAxle (oscillating axle stays on the ground)
 */
export class ForkliftModel {
  root = new THREE.Group();
  tip = new THREE.Group();
  roll = new THREE.Group();
  mast = new THREE.Group();
  intermediate = new THREE.Group();
  inner = new THREE.Group();
  carriage = new THREE.Group();
  rearAxle = new THREE.Group();
  loadHolder = new THREE.Group();
  load: THREE.Group | null = null;
  loadKind: ForkLoadKind | null = null;
  operator: OperatorFigure;
  private tiltCyl: HydCylinder[] = [];
  private liftCyl: THREE.Mesh;
  private liftRod: THREE.Mesh;
  private bodyMeshes: THREE.Mesh[] = [];

  constructor(public profile: ForkliftProfile) {
    const p = profile, g = p.geometry;
    for (const o of [this.root, this.tip, this.roll]) o.matrixAutoUpdate = false;
    this.root.add(this.tip); this.tip.add(this.roll, this.rearAxle);
    this.roll.add(this.mast, this.carriage);
    this.carriage.add(this.loadHolder);

    // --- chassis ---
    const hw = g.body.width / 2;
    const ch = new THREE.Group();
    ch.add(pboxMinMax(-1.62, 0.18, -hw + 0.05, hw - 0.05, 0.22, 0.92, M.paintYellow, 0.06));
    ch.add(pboxMinMax(g.body.rearX, -1.3, -hw, hw, 0.3, g.body.counterweightTop, M.paintDark, 0.12));
    ch.add(pboxMinMax(g.body.rearX + 0.05, -1.32, -hw + 0.06, hw - 0.06, g.body.counterweightTop - 0.02, g.body.counterweightTop + 0.06, M.paintDark, 0.03));
    ch.add(pboxMinMax(-1.35, -0.55, -hw + 0.08, hw - 0.08, 0.9, g.body.hoodHeight - 0.18, M.paintYellow, 0.08));
    ch.add(pboxMinMax(-0.5, -0.12, -hw + 0.1, hw - 0.1, 0.9, 1.32, M.paintYellow, 0.07));
    // tow pin + rear lamps
    ch.add(pboxMinMax(g.body.rearX - 0.04, g.body.rearX, -0.06, 0.06, 0.55, 0.65, M.steel));
    for (const y of [hw - 0.12, -hw + 0.12]) ch.add(pboxMinMax(g.body.rearX - 0.02, g.body.rearX + 0.02, y - 0.06, y + 0.06, 0.95, 1.05, new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0x330000 })));
    // seat
    const sh = p.operatorSeat.hip;
    ch.add(pboxMinMax(sh.x - 0.22, sh.x + 0.18, -0.24, 0.24, g.body.hoodHeight - 0.2, sh.z - 0.04, M.seat, 0.05));
    ch.add(pboxMinMax(sh.x - 0.3, sh.x - 0.2, -0.23, 0.23, sh.z - 0.05, sh.z + 0.48, M.seat, 0.05));
    // steering column + wheel
    ch.add(pcyl(v(-0.32, 0, 1.18), v(-0.5, 0, 1.42), 0.03, M.black));
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 10, 32), M.black);
    sw.position.copy(T(v(-0.5, 0, 1.43))); sw.rotation.set(0, Math.PI / 2, 0); sw.rotateX(0.6); sw.castShadow = true; ch.add(sw);
    // levers
    for (let i = 0; i < 3; i++) ch.add(pcyl(v(-0.2, -0.28 - i * 0.05, 1.3), v(-0.28, -0.28 - i * 0.05, 1.5), 0.008, M.black));
    // overhead guard
    const og = g.overheadGuard, ow = og.width / 2;
    for (const y of [ow, -ow]) {
      ch.add(pcyl(v(og.frontX + 0.15, y, 1.0), v(og.frontX, y, og.height), 0.035, M.black));
      ch.add(pcyl(v(og.rearX, y, g.body.counterweightTop), v(og.rearX, y, og.height), 0.035, M.black));
      ch.add(pcyl(v(og.frontX, y, og.height), v(og.rearX, y, og.height), 0.03, M.black));
    }
    for (let i = 0; i <= 6; i++) { const y = -ow + (i / 6) * og.width; ch.add(pcyl(v(og.frontX, y, og.height + 0.02), v(og.rearX, y, og.height + 0.02), 0.015, M.black)); }
    ch.add(pcyl(v(og.frontX, -ow, og.height), v(og.frontX, ow, og.height), 0.03, M.black));
    ch.add(pcyl(v(og.rearX, -ow, og.height), v(og.rearX, ow, og.height), 0.03, M.black));
    // work light
    const lamp = pboxMinMax(og.frontX - 0.02, og.frontX + 0.06, ow - 0.12, ow - 0.02, og.height - 0.08, og.height, new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0x666655 })); ch.add(lamp);
    // LPG bottle
    const lpg = pcyl(v(-1.62, 0.36, 1.42), v(-1.62, -0.36, 1.42), 0.17, M.lpg, 24); ch.add(lpg);
    // front wheels + fenders
    for (const s of [1, -1]) {
      ch.add(placeWheel(wheel(g.tyreFront.radius, g.tyreFront.width), v(0, s * g.trackFront / 2, g.tyreFront.radius)));
      ch.add(pboxMinMax(-0.35, 0.3, s > 0 ? hw - 0.1 : -hw - 0.02, s > 0 ? hw + 0.02 : -hw + 0.1, 0.62, 0.7, M.paintDark, 0.02));
    }
    ch.add(pcyl(v(0, -g.trackFront / 2, g.tyreFront.radius), v(0, g.trackFront / 2, g.tyreFront.radius), 0.07, M.steel));
    this.roll.add(ch);
    ch.traverse((o) => { if ((o as THREE.Mesh).isMesh) this.bodyMeshes.push(o as THREE.Mesh); });

    // --- oscillating rear axle (stays on ground) ---
    this.rearAxle.add(pcyl(v(-g.wheelbase, -g.trackRear / 2, g.tyreRear.radius), v(-g.wheelbase, g.trackRear / 2, g.tyreRear.radius), 0.06, M.steel));
    this.rearAxle.add(pboxMinMax(-g.wheelbase - 0.08, -g.wheelbase + 0.08, -0.12, 0.12, g.tyreRear.radius, g.rearAxlePivotHeight + 0.05, M.steel));
    for (const s of [1, -1]) this.rearAxle.add(placeWheel(wheel(g.tyreRear.radius, g.tyreRear.width), v(-g.wheelbase, s * g.trackRear / 2, g.tyreRear.radius)));

    // --- mast (built in the mast frame: origin at tilt pivot) ---
    const mw = g.mastWidth / 2, top = g.mastCollapsedHeight - g.mastPivot.z, bot = -g.mastPivot.z + 0.06;
    const chan = (grp: THREE.Group, y: number, x: number, z0: number, z1: number, w: number) =>
      grp.add(pboxMinMax(x - 0.05, x + 0.05, y - w / 2, y + w / 2, z0, z1, M.paintDark));
    for (const y of [mw, -mw]) chan(this.mast, y, 0.08, bot, top, 0.07);
    this.mast.add(pboxMinMax(0.03, 0.13, -mw, mw, top - 0.1, top, M.paintDark));
    this.mast.add(pboxMinMax(0.03, 0.13, -mw, mw, bot, bot + 0.12, M.paintDark));
    this.mast.add(this.intermediate); this.intermediate.add(this.inner);
    for (const y of [mw - 0.08, -mw + 0.08]) chan(this.intermediate, y, 0.15, bot + 0.05, top - 0.02, 0.06);
    this.intermediate.add(pboxMinMax(0.1, 0.2, -mw + 0.05, mw - 0.05, top - 0.1, top - 0.02, M.paintDark));
    for (const y of [mw - 0.16, -mw + 0.16]) chan(this.inner, y, 0.21, bot + 0.1, top - 0.04, 0.055);
    this.inner.add(pboxMinMax(0.16, 0.26, -mw + 0.12, mw - 0.12, top - 0.12, top - 0.04, M.paintDark));
    this.liftCyl = pcyl(v(0.12, 0, bot + 0.05), v(0.12, 0, top - 0.3), 0.055, M.paintDark); this.mast.add(this.liftCyl);
    this.liftRod = pcyl(v(0.12, 0, 0), v(0.12, 0, 1), 0.035, M.chrome); this.mast.add(this.liftRod);
    for (let i = 0; i < 2; i++) { const c = new HydCylinder(0.045, 0.32); this.tiltCyl.push(c); this.roll.add(c); }

    // --- carriage (frame origin: fork heel on the fork top surface) ---
    const cr = this.carriage;
    cr.add(pboxMinMax(-0.09, -0.04, -0.52, 0.52, -0.15, 0.42, M.paintDark));
    for (let i = 0; i <= 8; i++) { const y = -0.5 + i * 0.125; cr.add(pboxMinMax(-0.08, -0.05, y - 0.012, y + 0.012, 0.42, 1.15, M.paintDark)); }
    cr.add(pboxMinMax(-0.08, -0.05, -0.52, 0.52, 1.12, 1.17, M.paintDark));
    const fs = g.forkSpacing / 2;
    for (const y of [fs, -fs]) {
      cr.add(pboxMinMax(-0.045, 0, y - 0.06, y + 0.06, -0.045, 0.45, M.forkSteel));
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.045); shape.lineTo(g.forkLength - 0.12, -0.045); shape.lineTo(g.forkLength, -0.035); shape.lineTo(g.forkLength, -0.015); shape.lineTo(g.forkLength - 0.12, 0); shape.lineTo(-0.045, 0); shape.closePath();
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }), M.forkSteel);
      blade.position.copy(T(v(0, y + 0.06, 0))); blade.castShadow = true; cr.add(blade);
    }

    this.operator = new OperatorFigure(hiVisTexture());
    this.operator.position.copy(T(v(sh.x, sh.y, sh.z)));
    this.roll.add(this.operator);
  }

  setLoad(kind: ForkLoadKind | null, dims: { length: number; width: number; height: number; gap: number; fill?: number }) {
    if (this.load) { this.load.removeFromParent(); this.load = null; }
    this.loadKind = kind;
    if (!kind) return;
    this.load = buildForkLoad(kind, dims);
    this.load.position.copy(T(v(dims.gap + dims.length / 2, 0, 0)));
    this.loadHolder.add(this.load);
  }

  /** Pose from a static evaluation. */
  update(s: ForkliftState) {
    const p = this.profile, g = p.geometry;
    applyFrame(this.mast, s.geometry.mastFrame);
    applyFrame(this.carriage, s.geometry.carriageFrame);
    const rise = innerMastRise(p, s.inputs.liftHeight);
    this.intermediate.position.y = rise / 2; this.inner.position.y = rise;
    const bot = -g.mastPivot.z + 0.06, top = g.mastCollapsedHeight - g.mastPivot.z;
    const rodTop = Math.max(top - 0.25, s.geometry.carriageFrame.t.z - g.mastPivot.z + 0.2);
    this.liftRod.scale.set(1, rodTop - (top - 0.3), 1);
    this.liftRod.position.copy(T(v(0.12, 0, (top - 0.3 + rodTop) / 2)));
    void bot;
    for (const [i, y] of [[0, 0.42], [1, -0.42]] as const)
      this.tiltCyl[i]!.set(v(-0.42, y, 0.78), transformPoint(s.geometry.mastFrame, v(0.0, y, 0.55)));
    // stop-engagement roll of the chassis
    const r = s.stability.roll;
    this.roll.matrix.copy(r ? rotationAboutLine(r.point, r.axis, r.angle) : new THREE.Matrix4());
    this.roll.matrixWorldNeedsUpdate = true;
    this.setPose(null);
    if (this.load && !this.load.parent?.isObject3D) this.loadHolder.add(this.load);
  }

  /** Rigid pose of the whole machine from the dynamics (null = as evaluated). */
  setPose(f: Frame | null) {
    this.tip.matrix.copy(f ? mat3ToThree(f.R, f.t) : new THREE.Matrix4());
    this.tip.matrixWorldNeedsUpdate = true;
  }

  setGhost(on: boolean) {
    for (const m of this.bodyMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (on) { m.userData["orig"] ??= mat; const c = mat.clone(); c.transparent = true; c.opacity = 0.22; c.depthWrite = false; m.material = c; m.castShadow = false; }
      else if (m.userData["orig"]) { m.material = m.userData["orig"]; m.castShadow = true; }
    }
  }
}

