import * as THREE from "three";
import { type DynamicsResult, type DynFrame, type ForkliftState, type LoaderState, type Vec3, gravityDirInGroundFrame, scale, G, sub, normalize, v, compose, apply, transformPoint } from "@loadlab/physics";
import { Stage } from "./environment.js";
import { ForkliftModel } from "./forkliftModel.js";
import { LoaderModel } from "./loaderModel.js";
import { Overlays } from "./overlays.js";
import { DustBurst, SpillParticles } from "./effects.js";
import { T, mat3ToThree } from "./coords.js";
import { materialFor } from "./materials.js";
import { FORKLIFTS, LOADERS, type Evaluation, type MachineUI } from "../app/state.js";

/** One machine in one stage: model, overlays, and dynamic playback. Used for the main view and for side-by-side comparison. */
export class MachineView {
  stage: Stage;
  overlays = new Overlays();
  model: ForkliftModel | LoaderModel | null = null;
  modelKey = "";
  evaluation: Evaluation | null = null;
  dyn: DynamicsResult | null = null;
  private effects: (DustBurst | SpillParticles)[] = [];
  private loadRelease: { t: number; matrix: THREE.Matrix4; p: Vec3 } | null = null;
  private opReleaseT: number | null = null;
  engineering = false;
  private pathLine: THREE.Line | null = null;
  private lastArt: number | null = null;
  /** Frame shown at the current playback time. */
  current: DynFrame | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    this.stage = new Stage(renderer);
    this.stage.groundFrame.add(this.overlays.group);
  }

  private ensureModel(u: MachineUI) {
    const key = `${u.kind}:${u.profileId}`;
    if (key === this.modelKey && this.model) return;
    if (this.model) this.model.root.removeFromParent();
    this.model = u.kind === "forklift" ? new ForkliftModel(FORKLIFTS[u.profileId]!) : new LoaderModel(LOADERS[u.profileId]!);
    this.stage.groundFrame.add(this.model.root);
    this.modelKey = key;
    this.lastLoadKey = "";
    this.setEngineering(this.engineering);
  }
  private lastLoadKey = "";

  /** Show a static evaluation (clears any dynamic playback). */
  show(e: Evaluation, recordTrail = true) {
    this.clearDynamics();
    this.evaluation = e;
    const u = e.ui;
    this.ensureModel(u);
    this.stage.setTerrain(e.state.inputs.terrain);
    if (u.kind === "forklift" && this.model instanceof ForkliftModel) {
      const L = u.load, key = JSON.stringify([L.preset, L.length, L.width, L.height, L.gap, L.fill]);
      if (key !== this.lastLoadKey) { this.model.setLoad(L.preset === "none" ? null : L.preset, { length: L.length, width: L.width, height: L.height, gap: L.gap, fill: L.fill }); this.lastLoadKey = key; }
      if (this.model.load) this.model.load.position.copy(T(v(L.gap + L.length / 2, 0, 0)));
      this.model.update(e.state as ForkliftState);
    } else if (u.kind === "loader" && this.model instanceof LoaderModel) {
      const L = u.load, ls = e.state as LoaderState;
      const vol = L.material === "none" ? 0 : L.massMode === "density" ? L.volume : (ls.geometry.payloadMass ?? 0) / Math.max(1, L.density);
      const key = JSON.stringify([L.material, vol.toFixed(3), L.lateral]);
      if (key !== this.lastLoadKey) { this.model.setHeap(L.material === "none" ? null : L.material, vol, L.lateral); this.lastLoadKey = key; }
      this.model.update(ls);
    }
    this.model!.operator.visible = true;
    this.model!.operator.seated();
    this.overlays.update(e.state.stability, { recordTrail });
  }

  setEngineering(on: boolean) {
    this.engineering = on;
    if (!this.model) return;
    this.model.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || o.userData["noGhost"]) return;
      if (on) {
        if (!m.userData["orig"]) m.userData["orig"] = m.material;
        const c = (m.userData["orig"] as THREE.Material).clone() as THREE.MeshStandardMaterial;
        c.transparent = true; c.opacity = 0.18; c.depthWrite = false; m.material = c;
      } else if (m.userData["orig"]) m.material = m.userData["orig"] as THREE.Material;
    });
  }

  setDynamics(d: DynamicsResult) {
    this.clearDynamics();
    this.dyn = d;
    const e = this.evaluation!;
    const g = scale(gravityDirInGroundFrame(e.state.inputs.terrain), G);
    for (const ev of d.events) if (ev.type === "ground-strike" && ev.at && (ev.speed ?? 0) > 0.4) {
      const fx = new DustBurst(ev.at, ev.t, 0.5 * 4000 * (ev.speed ?? 1) ** 2); this.effects.push(fx); this.stage.groundFrame.add(fx);
    }
    if (d.payloadOutcome.released && d.payloadOutcome.landedAt) {
      const land = d.events.find((x) => x.type === "payload-landed");
      if (land) { const fx = new DustBurst(d.payloadOutcome.landedAt, land.t, 2000 * (d.payloadOutcome.impactSpeed ?? 1)); this.effects.push(fx); this.stage.groundFrame.add(fx); }
    }
    // travelled path of the machine (reference point under the machine), drawn on the ground
    const pts = d.frames.filter((_, i) => i % 3 === 0).map((f) => T({ x: f.travel.t.x, y: f.travel.t.y, z: 0.03 }));
    if (pts.length > 1 && pts[0]!.distanceTo(pts[pts.length - 1]!) > 0.05) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xffd400, dashSize: 0.4, gapSize: 0.25 }));
      line.computeLineDistances(); this.pathLine = line; this.stage.groundFrame.add(line);
    }
    const rel = d.events.find((x) => x.type === "payload-released");
    if (rel && e.ui.kind === "loader") {
      const f = this.frameAt(rel.t);
      if (f?.payload) {
        const mat = e.ui.load.material === "none" ? "gravel" : e.ui.load.material;
        const fx = new SpillParticles(rel.t, f.payload.p, f.payload.v, g, (materialFor(mat).color as THREE.Color).getHex(), 300, 0.5);
        this.effects.push(fx); this.stage.groundFrame.add(fx);
      }
    }
  }

  clearDynamics() {
    for (const fx of this.effects) fx.removeFromParent();
    this.effects = []; this.dyn = null; this.loadRelease = null; this.opReleaseT = null; this.current = null;
    if (this.pathLine) { this.pathLine.removeFromParent(); this.pathLine.geometry.dispose(); this.pathLine = null; }
    if (this.model) {
      this.model.root.matrix.identity(); this.model.root.matrixWorldNeedsUpdate = true;
      this.model.setWheels(0, 0);
      if (this.evaluation && this.lastArt !== null) {
        if (this.model instanceof LoaderModel) this.model.update(this.evaluation.state as LoaderState);
        this.lastArt = null;
      }
    }
    if (this.model instanceof ForkliftModel && this.model.load && this.model.load.parent !== this.model.loadHolder) {
      this.model.loadHolder.add(this.model.load); this.model.load.matrixAutoUpdate = true;
      const u = this.evaluation?.ui; if (u && u.kind === "forklift") this.model.load.position.copy(T(v(u.load.gap + u.load.length / 2, 0, 0)));
      this.model.load.quaternion.identity();
    }
    if (this.model) {
      const op = this.model.operator;
      if (op.parent !== this.model.roll) { this.model.roll.add(op); op.matrixAutoUpdate = true; }
      const hip = this.model.profile.operatorSeat.hip; op.position.copy(T(hip)); op.quaternion.identity(); op.seated();
    }
    if (this.model instanceof LoaderModel && this.model.heap) this.model.heap.visible = true;
  }

  /** Site position of the machine at the current playback frame (for camera follow). */
  sitePosition(): Vec3 {
    const f = this.current; if (!f) return v(0, 0, 0);
    const c = this.model instanceof ForkliftModel ? v(-0.6, 0, 0) : v(0, 0, 0);
    return transformPoint(f.travel, c);
  }

  frameAt(t: number) {
    const fr = this.dyn?.frames; if (!fr || !fr.length) return undefined;
    let lo = 0, hi = fr.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (fr[mid]!.t <= t) lo = mid; else hi = mid; }
    return fr[lo];
  }

  /** Pose everything for playback time t. */
  setTime(t: number) {
    const d = this.dyn, e = this.evaluation; if (!d || !e || !this.model) return;
    const f = this.frameAt(t); if (!f) return;
    this.current = f;
    const pose = f.pose;
    // live machine configuration while driving (loader articulation changes as it steers)
    if (this.model instanceof LoaderModel && f.state) {
      const ls = f.state as LoaderState;
      if (this.lastArt === null || Math.abs(ls.inputs.articulation - this.lastArt) > 1e-4) { this.model.update(ls); this.lastArt = ls.inputs.articulation; }
    }
    this.model.root.matrix.copy(mat3ToThree(f.travel.R, f.travel.t)); this.model.root.matrixWorldNeedsUpdate = true;
    this.model.roll.matrix.copy(mat3ToThree(f.roll.R, f.roll.t)); this.model.roll.matrixWorldNeedsUpdate = true;
    this.model.setPose(pose);
    this.model.setWheels(f.motion.dist, f.motion.steer);
    for (const fx of this.effects) fx.setTime(t);

    // load
    const relEv = d.events.find((x) => x.type === "payload-released");
    const released = !!relEv && t >= relEv.t;
    if (this.model instanceof ForkliftModel && this.model.load) {
      const load = this.model.load;
      if (released && f.payload) {
        if (!this.loadRelease) {
          load.updateWorldMatrix(true, false);
          const inv = new THREE.Matrix4().copy(this.stage.groundFrame.matrixWorld).invert();
          const fr = this.frameAt(relEv!.t)!;
          this.loadRelease = { t: relEv!.t, matrix: inv.multiply(load.matrixWorld.clone()), p: fr.payload!.p };
          this.stage.groundFrame.add(load); load.matrixAutoUpdate = false;
        }
        const r = this.loadRelease, dp = T(sub(f.payload.p, r.p));
        const landed = d.events.find((x) => x.type === "payload-landed");
        const tt = Math.min(t, landed ? landed.t : t) - r.t;
        const relF = d.frames.find((x) => x.t >= r.t);
        const ax = d.hinges[relF?.hinge ?? 0]?.axis ?? d.hinge.axis;
        const spin = new THREE.Matrix4().makeRotationAxis(T(ax).normalize(), (relF?.omega ?? 0) * tt * 0.8);
        const c = T(r.p);
        load.matrix.copy(new THREE.Matrix4().makeTranslation(dp.x + c.x, dp.y + c.y, dp.z + c.z).multiply(spin).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z)).multiply(r.matrix));
        load.matrixWorldNeedsUpdate = true;
      } else if (this.loadRelease) { this.clearLoadRelease(); }
    }
    if (this.model instanceof LoaderModel && this.model.heap) this.model.heap.visible = !released;

    // operator
    const op = this.model.operator;
    const opEv = d.events.find((x) => x.type === "operator-released" || x.type === "operator-jumped");
    if (opEv && t >= opEv.t && f.operator && !f.operator.attached) {
      if (op.parent !== this.stage.groundFrame) { this.stage.groundFrame.add(op); this.opReleaseT = opEv.t; }
      op.position.copy(T(f.operator.p));
      if (f.operator.landed) {
        op.lying();
        const fall = normalize(sub(f.operator.p, f.travel.t));
        op.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), T({ x: fall.x, y: fall.y, z: 0 }).normalize());
        op.rotateX(Math.PI / 2); op.rotateZ(-Math.PI / 2);
        op.position.copy(T({ ...f.operator.p, z: 0.15 }));
      } else {
        const ph = t - (this.opReleaseT ?? t);
        op.airborne(ph);
        op.quaternion.setFromAxisAngle(T(d.hinge.axis).normalize(), 0.4 + ph * 2.2);
      }
    } else if (op.parent !== this.model.roll) {
      this.model.roll.add(op); const hip = this.model.profile.operatorSeat.hip; op.position.copy(T(hip)); op.quaternion.identity(); op.seated();
    }

    const gSite = e.state.stability.gravityDir;
    const res = sub(scale(gSite, G), apply(f.travel.R, f.accel));
    this.overlays.update(f.stability, {
      pose: compose(f.travel, pose), moving: !f.onWheels, payloadReleased: released, recordTrail: false,
      gravitySite: gSite, resultantSite: normalize(res), showResultant: Math.hypot(f.accel.x, f.accel.y) > 0.05,
    });
  }

  private clearLoadRelease() {
    if (this.model instanceof ForkliftModel && this.model.load) {
      this.model.loadHolder.add(this.model.load); this.model.load.matrixAutoUpdate = true;
      const u = this.evaluation?.ui; if (u && u.kind === "forklift") this.model.load.position.copy(T(v(u.load.gap + u.load.length / 2, 0, 0)));
      this.model.load.quaternion.identity();
    }
    this.loadRelease = null;
  }
}
