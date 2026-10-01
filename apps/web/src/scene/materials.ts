import * as THREE from "three";

/** Procedural canvas textures so the app needs no binary assets. */
const canvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture => {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

export const groundTextures = () => {
  const r = rand(7);
  const color = canvasTex(1024, 1024, (c) => {
    c.fillStyle = "#8a8378"; c.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 60000; i++) {
      const v = 100 + r() * 70 | 0, s = 1 + r() * 3;
      c.fillStyle = `rgba(${v},${v - 6},${v - 14},${0.35 + r() * 0.4})`;
      c.fillRect(r() * 1024, r() * 1024, s, s);
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(60,55,48,${0.05 + r() * 0.08})`;
      c.beginPath(); c.ellipse(r() * 1024, r() * 1024, 30 + r() * 120, 20 + r() * 80, r() * 3, 0, 7); c.fill();
    }
    c.strokeStyle = "rgba(240,200,40,0.55)"; c.lineWidth = 14;
    c.beginPath(); c.moveTo(0, 60); c.lineTo(1024, 60); c.stroke();
  });
  const bump = canvasTex(512, 512, (c) => {
    c.fillStyle = "#808080"; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 30000; i++) { const v = 80 + r() * 120 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
  }, false);
  return { color, bump };
};

export const treadTexture = (lugs = 24) => canvasTex(512, 128, (c) => {
  c.fillStyle = "#1b1b1b"; c.fillRect(0, 0, 512, 128);
  c.fillStyle = "#3a3a3a";
  for (let i = 0; i < lugs; i++) {
    const x = (i / lugs) * 512;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 14, 0); c.lineTo(x + 34, 64); c.lineTo(x + 14, 128); c.lineTo(x, 128); c.lineTo(x + 20, 64); c.fill();
  }
}, false);

export const corrugatedTexture = () => canvasTex(256, 256, (c) => {
  const g = c.createLinearGradient(0, 0, 32, 0);
  g.addColorStop(0, "#9aa3a8"); g.addColorStop(0.5, "#d5dadc"); g.addColorStop(1, "#9aa3a8");
  for (let x = 0; x < 256; x += 32) { c.save(); c.translate(x, 0); c.fillStyle = g; c.fillRect(0, 0, 32, 256); c.restore(); }
});

export const cartonTexture = () => canvasTex(256, 256, (c) => {
  c.fillStyle = "#b88b55"; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = "#7d5a32"; c.lineWidth = 3;
  for (let y = 0; y <= 256; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }
  for (let x = 0; x <= 256; x += 85) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
  c.fillStyle = "rgba(255,255,255,0.15)"; c.fillRect(0, 120, 256, 16);
});

export const hiVisTexture = () => canvasTex(128, 128, (c) => {
  c.fillStyle = "#ff7a00"; c.fillRect(0, 0, 128, 128);
  c.fillStyle = "#d9dde0"; c.fillRect(0, 70, 128, 12); c.fillRect(0, 100, 128, 12);
});

export const M = {
  paintYellow: new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.42, metalness: 0.25 }),
  paintOrange: new THREE.MeshStandardMaterial({ color: 0xe36a12, roughness: 0.45, metalness: 0.2 }),
  paintDark: new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.55, metalness: 0.35 }),
  black: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x6c7176, roughness: 0.45, metalness: 0.85 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.12, metalness: 1.0 }),
  forkSteel: new THREE.MeshStandardMaterial({ color: 0x33363a, roughness: 0.5, metalness: 0.7 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xc9cdd1, roughness: 0.35, metalness: 0.8 }),
  rimLoader: new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.4, metalness: 0.3 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x9fb8c4, roughness: 0.05, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.28 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.8 }),
  lpg: new THREE.MeshStandardMaterial({ color: 0xd8dde0, roughness: 0.3, metalness: 0.7 }),
  timber: new THREE.MeshStandardMaterial({ color: 0xa47c4c, roughness: 0.9 }),
  ibcCage: new THREE.MeshStandardMaterial({ color: 0xa8adb2, roughness: 0.4, metalness: 0.9 }),
  ibcBottle: new THREE.MeshPhysicalMaterial({ color: 0xf2f2ea, roughness: 0.35, transparent: true, opacity: 0.55 }),
  liquid: new THREE.MeshStandardMaterial({ color: 0x6b1f2e, roughness: 0.15 }),
  grapeBin: new THREE.MeshStandardMaterial({ color: 0x1f5fa8, roughness: 0.6 }),
  grapes: new THREE.MeshStandardMaterial({ color: 0x3c1a3f, roughness: 0.45 }),
  machineryGrey: new THREE.MeshStandardMaterial({ color: 0x4c6b7a, roughness: 0.5, metalness: 0.6 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xc89a7a, roughness: 0.7 }),
  workwear: new THREE.MeshStandardMaterial({ color: 0x24324a, roughness: 0.85 }),
  boots: new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.8 }),
  hardhat: new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.35 }),
};

export const materialFor = (key: "gravel" | "soil" | "grapes" | "pomace" | "sand") => new THREE.MeshStandardMaterial({
  color: { gravel: 0x8e8c86, soil: 0x6b4a2f, grapes: 0x3c1a3f, pomace: 0x4a1f22, sand: 0xc9ab7a }[key],
  roughness: key === "grapes" ? 0.45 : 0.95, flatShading: true,
});
