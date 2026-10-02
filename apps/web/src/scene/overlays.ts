import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { type StabilityResult, type Vec3, type TyreReaction, type Frame, add, scale, sub, dot, transformPoint } from "@loadlab/physics";
import { T } from "./coords.js";

const onTop = <M extends THREE.Material>(m: M): M => { m.depthTest = false; m.depthWrite = false; m.transparent = true; return m; };

const label = (cls: string, cx = -0.08, cy = 1.1) => {
  const d = document.createElement("div"); d.className = `ov-label ${cls}`;
  const o = new CSS2DObject(d); o.center.set(cx, cy);
  return { el: d, obj: o };
};

export interface OverlayToggles { cg: boolean; gravity: boolean; support: boolean; reactions: boolean; trail: boolean; labels: boolean }

/**
 * Educational overlays drawn from model output only. All positions are in the physics ground frame.
 * Colours/shapes (brief §14): blue sphere = machine CG; orange cube = payload CG; magenta octahedron = combined CG.
 */
export class Overlays {
  group = new THREE.Group();
  private machine = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), onTop(new THREE.MeshBasicMaterial({ color: 0x1f6fff })));
  private payload = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), onTop(new THREE.MeshBasicMaterial({ color: 0xff8a00 })));
  private combined = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), onTop(new THREE.MeshBasicMaterial({ color: 0xff2bd6 })));
  private ghost = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), onTop(new THREE.MeshBasicMaterial({ color: 0xff2bd6, opacity: 0.3, wireframe: true })));
  private ghostLine = new THREE.Line(new THREE.BufferGeometry(), onTop(new THREE.LineDashedMaterial({ color: 0xff2bd6, dashSize: 0.06, gapSize: 0.06, opacity: 0.35 })));
  private gravityLine = new THREE.Line(new THREE.BufferGeometry(), onTop(new THREE.LineBasicMaterial({ color: 0xff2bd6, linewidth: 2 })));
  private gravityHit = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 32), onTop(new THREE.MeshBasicMaterial({ color: 0xff2bd6, side: THREE.DoubleSide })));
  private gravityCross = new THREE.LineSegments(new THREE.BufferGeometry(), onTop(new THREE.LineBasicMaterial({ color: 0xff2bd6 })));
  private resultantLine = new THREE.Line(new THREE.BufferGeometry(), onTop(new THREE.LineDashedMaterial({ color: 0x00e5ff, dashSize: 0.1, gapSize: 0.05 })));
  private resultantHit = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 32), onTop(new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide })));
  private poly = new THREE.LineLoop(new THREE.BufferGeometry(), onTop(new THREE.LineBasicMaterial({ color: 0x39d353 })));
  private polyFill = new THREE.Mesh(new THREE.BufferGeometry(), onTop(new THREE.MeshBasicMaterial({ color: 0x39d353, opacity: 0.12, side: THREE.DoubleSide })));
  private axis = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), onTop(new THREE.MeshBasicMaterial({ color: 0xff3b30 })));
  private axisExt = new THREE.Line(new THREE.BufferGeometry(), onTop(new THREE.LineDashedMaterial({ color: 0xff3b30, dashSize: 0.15, gapSize: 0.1 })));
  private trail = new THREE.Line(new THREE.BufferGeometry(), onTop(new THREE.LineBasicMaterial({ color: 0xff2bd6, opacity: 0.6 })));
  private arrows = new THREE.Group();
  private reactionLabels: CSS2DObject[] = [];
  private labels = { machine: label("lb-machine", 1.08, -0.3), payload: label("lb-payload", 1.08, 1.3), combined: label("lb-combined", -0.1, 1.3), axis: label("lb-axis", -0.05, -0.4), hit: label("lb-hit", -0.08, -0.5) };
  private trailPts: Vec3[] = [];
  private ghostCg: Vec3 | null = null;
  private ghostHit: Vec3 | null = null;
  toggles: OverlayToggles = { cg: true, gravity: true, support: true, reactions: true, trail: true, labels: true };

  constructor() {
    const all: THREE.Object3D[] = [this.machine, this.payload, this.combined, this.ghost, this.ghostLine, this.gravityLine, this.gravityHit, this.gravityCross, this.resultantLine, this.resultantHit, this.poly, this.polyFill, this.axis, this.axisExt, this.trail, this.arrows];
    for (const o of all) { o.renderOrder = 1000; this.group.add(o); }
    this.combined.renderOrder = 1002; this.machine.renderOrder = 1001; this.payload.renderOrder = 1001;
    this.gravityHit.rotation.x = -Math.PI / 2; this.resultantHit.rotation.x = -Math.PI / 2;
    this.machine.add(this.labels.machine.obj); this.payload.add(this.labels.payload.obj); this.combined.add(this.labels.combined.obj);
    this.axis.add(this.labels.axis.obj); this.gravityHit.add(this.labels.hit.obj);
    this.labels.machine.el.textContent = "Machine CG"; this.labels.payload.el.textContent = "Payload CG";
  }

  setGhost(cg: Vec3 | null, hit: Vec3 | null) { this.ghostCg = cg; this.ghostHit = hit; }
  clearTrail() { this.trailPts = []; }

  private setLine(l: THREE.Line, pts: Vec3[]) {
    l.geometry.dispose(); l.geometry = new THREE.BufferGeometry().setFromPoints(pts.map(T));
    if ((l.material as THREE.LineDashedMaterial).isLineDashedMaterial) l.computeLineDistances();
  }

  /**
   * Draw a static evaluation, optionally rotated about a hinge (during tip playback).
   * `tip` rotates every machine-fixed point; gravity stays world-vertical.
   */
  /**
   * `pose` maps body points to the site (stage) frame: travel position, plus tip rotation while tipping.
   * `gravitySite` / `resultantSite` are directions in the site frame (gravity stays world-vertical).
   */
  update(st: StabilityResult, opts: { pose?: Frame; moving?: boolean; payloadReleased?: boolean; recordTrail?: boolean; showResultant?: boolean; gravitySite?: Vec3; resultantSite?: Vec3 } = {}) {
    const tf = (p: Vec3) => (opts.pose ? transformPoint(opts.pose, p) : p);
    const tg = this.toggles;
    const cgM = tf(st.cg.machine.cg), cgP = tf(st.cg.payload.cg);
    let cgC = tf(st.cg.combined.cg);
    if (opts.payloadReleased && st.cg.payload.mass > 0) cgC = cgM;
    this.machine.position.copy(T(cgM)); this.machine.visible = tg.cg;
    this.payload.position.copy(T(cgP)); this.payload.visible = tg.cg && st.cg.payload.mass > 0 && !opts.payloadReleased;
    this.combined.position.copy(T(cgC)); this.combined.visible = tg.cg;
    for (const l of Object.values(this.labels)) l.obj.visible = tg.labels;
    this.labels.machine.el.textContent = `Machine CG · ${(st.cg.machine.mass / 1000).toFixed(2)} t`;
    this.labels.payload.el.textContent = `Payload CG · ${st.cg.payload.mass.toFixed(0)} kg · h ${cgP.z.toFixed(2)} m`;
    this.labels.combined.el.textContent = `Combined CG · h ${cgC.z.toFixed(2)} m`;

    // gravity line: world-vertical, from the combined CG to the ground plane (z = 0 of the ground frame)
    const g = opts.gravitySite ?? st.gravityDir;
    const toGround = (p: Vec3, d: Vec3) => (d.z < -1e-9 ? add(p, scale(d, -p.z / d.z)) : p);
    const hit = toGround(cgC, g);
    this.setLine(this.gravityLine, [cgC, hit]);
    this.gravityHit.position.copy(T(hit)).add(new THREE.Vector3(0, 0.005, 0));
    const c = 0.25;
    this.gravityCross.geometry.dispose();
    this.gravityCross.geometry = new THREE.BufferGeometry().setFromPoints([v3(hit, -c, 0), v3(hit, c, 0), v3(hit, 0, -c), v3(hit, 0, c)].map(T));
    for (const o of [this.gravityLine, this.gravityHit, this.gravityCross]) o.visible = tg.gravity;
    this.labels.hit.el.textContent = "Gravity line meets ground";

    // resultant (gravity + inertial) line, kept separate from the mass centre
    const showRes = (opts.showResultant ?? st.quasiStatic) && tg.gravity;
    this.resultantLine.visible = this.resultantHit.visible = showRes;
    if (showRes) {
      const rh = toGround(cgC, opts.resultantSite ?? st.resultantDir);
      this.setLine(this.resultantLine, [cgC, rh]);
      this.resultantHit.position.copy(T(rh)).add(new THREE.Vector3(0, 0.006, 0));
    }

    // support polygon + critical axis
    const ev = st.resultantEval, pts = ev.polygon.points.map((p) => tf(p.p));
    this.setLine(this.poly as unknown as THREE.Line, pts);
    const flat = pts.map((p) => ({ ...p, z: (opts.moving ? p.z : 0) + 0.004 }));
    const idx: number[] = []; for (let i = 1; i < flat.length - 1; i++) idx.push(0, i, i + 1);
    this.polyFill.geometry.dispose();
    this.polyFill.geometry = new THREE.BufferGeometry().setFromPoints(flat.map(T)); this.polyFill.geometry.setIndex(idx);
    const a = tf(ev.critical.from.p), b = tf(ev.critical.to.p), A = T(a), B = T(b), d = B.clone().sub(A);
    this.axis.position.copy(A).add(B).multiplyScalar(0.5); this.axis.scale.set(1, d.length(), 1);
    this.axis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    const ext = sub(b, a);
    this.setLine(this.axisExt, [add(a, scale(ext, -0.8)), add(b, scale(ext, 0.8))]);
    this.labels.axis.el.textContent = `Tipping axis ${ev.critical.id} · margin ${(ev.critical.margin * 1000).toFixed(0)} mm`;
    this.axis.material = this.axis.material as THREE.MeshBasicMaterial;
    (this.axis.material as THREE.MeshBasicMaterial).color.set(ev.critical.margin < 0 ? 0xff3b30 : ev.critical.margin < 0.15 ? 0xffb020 : 0x39d353);
    for (const o of [this.poly, this.polyFill, this.axis, this.axisExt]) o.visible = tg.support;
    if (opts.moving) { for (const o of [this.poly, this.polyFill, this.axis, this.axisExt]) o.visible = false; }

    // reactions
    this.arrows.clear(); for (const l of this.reactionLabels) l.removeFromParent(); this.reactionLabels = [];
    if (tg.reactions && st.reactions && !opts.moving) {
      const supports = new Map<string, Vec3>(); for (const p of ev.polygon.points) supports.set(p.id, p.p);
      for (const r of st.reactions as TyreReaction[]) {
        const p = supports.get(r.id) ?? (st.liftedContact?.id === r.id ? st.liftedContact.p : undefined);
        if (!p) continue;
        const kN = r.normal / 1000, len = Math.max(0.05, Math.min(2.2, kN / 30));
        const col = r.lifted || kN < 0 ? 0xff3b30 : kN < 2 ? 0xffb020 : 0xffffff;
        const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), T(tf(p)), len, col, 0.12, 0.08);
        arrow.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) onTop(m); o.renderOrder = 1001; });
        this.arrows.add(arrow);
        const lb = label("lb-react");
        lb.el.textContent = r.lifted ? `${r.label}: 0 kN (lifted)` : kN < 0 ? `${r.label}: lifting` : `${kN.toFixed(1)} kN`;
        if (r.lifted || kN < 0) lb.el.classList.add("lifted");
        lb.obj.position.copy(T(tf(p))).add(new THREE.Vector3(0, len + 0.05, 0)); lb.obj.visible = tg.labels;
        this.arrows.add(lb.obj); this.reactionLabels.push(lb.obj);
      }
    }

    // trail + ghost
    if (opts.recordTrail) {
      const last = this.trailPts[this.trailPts.length - 1];
      if (!last || Math.hypot(last.x - cgC.x, last.y - cgC.y, last.z - cgC.z) > 0.005) { this.trailPts.push(cgC); if (this.trailPts.length > 80) this.trailPts.shift(); }
    }
    this.trail.visible = tg.trail && this.trailPts.length > 1;
    if (this.trail.visible) this.setLine(this.trail, this.trailPts);
    this.ghost.visible = this.ghostLine.visible = !!this.ghostCg && tg.cg;
    if (this.ghostCg && this.ghostHit) { this.ghost.position.copy(T(this.ghostCg)); this.setLine(this.ghostLine, [this.ghostCg, this.ghostHit]); }
  }
}

const v3 = (p: Vec3, dx: number, dy: number): Vec3 => ({ x: p.x + dx, y: p.y + dy, z: p.z + 0.004 });
export { dot };
