import * as THREE from "three";
import { M, cartonTexture, materialFor } from "./materials.js";

export type ForkLoadKind = "cartons" | "tall-stack" | "long-load" | "machinery" | "ibc" | "grape-bin";

const shadow = (o: THREE.Object3D) => { o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

/** Pallet base: three-way entry timber pallet. Group origin at the base centre (three axes: x fwd, y up, z right). */
const pallet = (L: number, W: number): THREE.Group => {
  const g = new THREE.Group();
  const deck = (y: number) => { for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(L, 0.022, W / 9), M.timber); b.position.set(0, y, -W / 2 + W / 14 + (i * (W - W / 7)) / 6); g.add(b); } };
  deck(0.011); deck(0.133);
  for (const z of [-W / 2 + 0.05, 0, W / 2 - 0.05]) for (const x of [-L / 2 + 0.05, 0, L / 2 - 0.05]) {
    const blk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), M.timber); blk.position.set(x, 0.072, z); g.add(blk);
  }
  return g;
};

/**
 * Visual load on the forks. Group origin: centre of the load footprint on the fork top surface.
 * Dimensions in metres: length along the forks, width across, height. `fill` 0–1 for IBCs and bins.
 */
export const buildForkLoad = (kind: ForkLoadKind, d: { length: number; width: number; height: number; fill?: number }): THREE.Group => {
  const g = new THREE.Group();
  const L = d.length, W = d.width, H = d.height, fill = d.fill ?? 1;
  if (kind === "cartons" || kind === "tall-stack") {
    g.add(pallet(L, W));
    const ct = cartonTexture(); const mat = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.85 });
    const h = H - 0.145, layers = Math.max(1, Math.round(h / 0.3)), lh = h / layers;
    for (let k = 0; k < layers; k++) for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(L / 2 - 0.01, lh - 0.01, W / 3 - 0.01), mat);
      c.position.set(-L / 4 + i * (L / 2), 0.145 + lh / 2 + k * lh, -W / 3 + j * (W / 3)); g.add(c);
    }
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(L + 0.01, h, W + 0.01), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.1 }));
    wrap.position.y = 0.145 + h / 2; g.add(wrap);
  } else if (kind === "long-load") {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f94, metalness: 0.8, roughness: 0.4 });
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(H / 4.2, H / 4.2, W, 16), mat);
      pipe.rotation.x = Math.PI / 2; pipe.position.set(-L / 2 + L / 8 + i * (L / 4), H / 4 + k * (H / 2), 0); g.add(pipe);
    }
    for (const z of [-W * 0.3, W * 0.3]) { const s = new THREE.Mesh(new THREE.BoxGeometry(L + 0.02, H + 0.02, 0.03), new THREE.MeshStandardMaterial({ color: 0xd62020 })); s.position.set(0, H / 2, z); s.scale.set(1, 1, 1); g.add(s); s.visible = false; }
  } else if (kind === "machinery") {
    g.add(pallet(L, W));
    const base = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, H * 0.25, W * 0.85), M.machineryGrey); base.position.y = 0.145 + H * 0.125; g.add(base);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.22, H * 0.22, W * 0.5, 24), M.machineryGrey); motor.rotation.x = Math.PI / 2; motor.position.set(L * 0.2, 0.145 + H * 0.5, -W * 0.15); g.add(motor);
    const box = new THREE.Mesh(new THREE.BoxGeometry(L * 0.35, H * 0.55, W * 0.35), new THREE.MeshStandardMaterial({ color: 0xe8b62c, roughness: 0.5 })); box.position.set(L * 0.25, 0.145 + H * 0.55, W * 0.2); g.add(box);
  } else if (kind === "ibc") {
    g.add(pallet(L, W));
    const bottle = new THREE.Mesh(new THREE.BoxGeometry(L - 0.06, H - 0.2, W - 0.06), M.ibcBottle); bottle.position.y = 0.16 + (H - 0.2) / 2; g.add(bottle);
    if (fill > 0.01) { const lq = new THREE.Mesh(new THREE.BoxGeometry(L - 0.09, (H - 0.22) * fill, W - 0.09), M.liquid); lq.position.y = 0.17 + ((H - 0.22) * fill) / 2; lq.name = "liquid"; g.add(lq); }
    const bar = 0.018;
    for (let i = 0; i <= 5; i++) {
      const y = 0.15 + (i / 5) * (H - 0.15);
      for (const [sx, sz, px, pz] of [[L, bar, 0, W / 2], [L, bar, 0, -W / 2], [bar, W, L / 2, 0], [bar, W, -L / 2, 0]] as const) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, bar, sz), M.ibcCage); b.position.set(px, y, pz); g.add(b); }
    }
    for (let i = 0; i <= 6; i++) for (const z of [W / 2, -W / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(bar, H - 0.15, bar), M.ibcCage); b.position.set(-L / 2 + (i / 6) * L, 0.15 + (H - 0.15) / 2, z); g.add(b); }
  } else if (kind === "grape-bin") {
    const t = 0.04;
    const parts: [number, number, number, number, number, number][] = [[L, t, W, 0, t / 2, 0], [t, H, W, L / 2 - t / 2, H / 2, 0], [t, H, W, -L / 2 + t / 2, H / 2, 0], [L, H, t, 0, H / 2, W / 2 - t / 2], [L, H, t, 0, H / 2, -W / 2 + t / 2]];
    for (const [a, b, c, x, y, z] of parts) { const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), M.grapeBin); m.position.set(x, y, z); g.add(m); }
    if (fill > 0.01) {
      const hh = (H - t) * fill;
      const grapes = new THREE.Mesh(new THREE.BoxGeometry(L - 2 * t, hh, W - 2 * t, 12, 1, 12), M.grapes); grapes.position.y = t + hh / 2;
      const pos = grapes.geometry.attributes["position"] as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) + Math.random() * 0.05);
      grapes.geometry.computeVertexNormals(); g.add(grapes);
    }
  }
  return shadow(g) as THREE.Group;
};

export type BulkMaterial = "gravel" | "soil" | "grapes" | "pomace" | "sand";

/**
 * Bucket heap for a given fill volume. Built in the bucket frame converted to three axes
 * (x along the floor, y up from the floor, z across). `lateralShift` (m, +left) skews the heap.
 */
export const buildBucketHeap = (material: BulkMaterial, volume: number, b: { floor: number; back: number; width: number; struck: number }, lateralShift: number): THREE.Mesh => {
  const frac = Math.min(1.3, volume / b.struck);
  const shape = new THREE.Shape();
  const lvl = Math.min(b.back * 0.95, b.back * 0.75 * Math.min(frac, 1));
  shape.moveTo(-0.08, 0.04); shape.lineTo(b.floor * 0.92, 0.04);
  shape.lineTo(Math.min(b.floor * 0.92, b.floor * 0.4 + lvl), lvl);
  const heap = Math.max(0, frac - 0.85) * b.back * 0.9;
  shape.quadraticCurveTo(b.floor * 0.35, lvl + heap * 2, -0.1, lvl);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: b.width * 0.94, bevelEnabled: false, curveSegments: 10, steps: 12 });
  geo.translate(0, 0, -b.width * 0.47);
  const pos = geo.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i);
    if (y > 0.06) {
      const skew = lateralShift * 2 * (-z / (b.width / 2));
      pos.setY(i, Math.max(0.05, y * (1 + skew) + (Math.random() - 0.5) * 0.04));
    }
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, materialFor(material));
  m.castShadow = true; m.receiveShadow = true;
  return m;
};
