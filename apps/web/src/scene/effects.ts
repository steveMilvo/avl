import * as THREE from "three";
import { T } from "./coords.js";
import type { Vec3 } from "@loadlab/physics";

const dustTex = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(200,185,160,0.9)"); gr.addColorStop(1, "rgba(200,185,160,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (t = new THREE.CanvasTexture(c));
  };
})();

/** Dust burst whose size scales with the computed impact energy. Time-driven so it scrubs with the timeline. */
export class DustBurst extends THREE.Points {
  private seeds: Float32Array;
  constructor(public at: Vec3, public t0: number, energyJ: number) {
    const n = Math.round(Math.min(400, 60 + energyJ / 300));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    super(geo, new THREE.PointsMaterial({ map: dustTex(), size: 0.9, transparent: true, depthWrite: false, opacity: 0.8, sizeAttenuation: true }));
    this.seeds = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.seeds[i * 3] = Math.random() * Math.PI * 2; this.seeds[i * 3 + 1] = 0.5 + Math.random() * 2.5; this.seeds[i * 3 + 2] = Math.random() * 1.2; }
    this.frustumCulled = false;
  }
  setTime(t: number) {
    const dt = t - this.t0;
    this.visible = dt >= 0 && dt < 4;
    if (!this.visible) return;
    const base = T(this.at), pos = this.geometry.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const a = this.seeds[i * 3]!, sp = this.seeds[i * 3 + 1]!, up = this.seeds[i * 3 + 2]!;
      const r = sp * (1 - Math.exp(-dt * 2));
      pos.setXYZ(i, base.x + Math.cos(a) * r, base.y + up * (1 - Math.exp(-dt * 1.5)) + 0.1, base.z + Math.sin(a) * r);
    }
    pos.needsUpdate = true;
    (this.material as THREE.PointsMaterial).opacity = 0.8 * Math.max(0, 1 - dt / 4);
  }
}

/** Spilled bulk material: particles on ballistic paths from the release state, settling on the ground. */
export class SpillParticles extends THREE.InstancedMesh {
  private p0: Vec3[] = []; private v0: Vec3[] = [];
  constructor(public t0: number, origin: Vec3, vel: Vec3, private g: Vec3, color: THREE.ColorRepresentation, count = 260, spread = 0.6) {
    super(new THREE.DodecahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }), count);
    for (let i = 0; i < count; i++) {
      this.p0.push({ x: origin.x + (Math.random() - 0.5) * spread, y: origin.y + (Math.random() - 0.5) * spread * 2.5, z: origin.z + (Math.random() - 0.5) * spread * 0.5 });
      this.v0.push({ x: vel.x + (Math.random() - 0.5) * 0.8, y: vel.y + (Math.random() - 0.5) * 0.8, z: vel.z + Math.random() * 0.3 });
    }
    this.castShadow = true; this.frustumCulled = false;
  }
  setTime(t: number) {
    const dt = t - this.t0; this.visible = dt >= 0;
    if (!this.visible) return;
    const m = new THREE.Matrix4(), s = new THREE.Vector3(1, 1, 1), q = new THREE.Quaternion();
    for (let i = 0; i < this.p0.length; i++) {
      const p = this.p0[i]!, vv = this.v0[i]!, g = this.g;
      // time to reach ground (z = 0.04) for this particle
      const a = 0.5 * g.z, b = vv.z, c = p.z - 0.04;
      const disc = b * b - 4 * a * c;
      const tl = disc >= 0 ? (-b - Math.sqrt(disc)) / (2 * a) : dt;
      const tt = Math.min(dt, Math.max(0, tl));
      const x = p.x + vv.x * tt + 0.5 * g.x * tt * tt, y = p.y + vv.y * tt + 0.5 * g.y * tt * tt, z = Math.max(0.04, p.z + vv.z * tt + 0.5 * g.z * tt * tt);
      q.setFromEuler(new THREE.Euler(i, tt * 5 + i, 0));
      m.compose(T({ x, y, z }), q, s); this.setMatrixAt(i, m);
    }
    this.instanceMatrix.needsUpdate = true;
  }
}
