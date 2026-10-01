import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { groundTextures, corrugatedTexture, M } from "./materials.js";
import { mat3ToThree } from "./coords.js";
import { groundFrameToWorld, type Terrain } from "@loadlab/physics";

/** A stage = one scene with its own sky, lights, sloped ground and props. Machines are added by the app. */
export class Stage {
  scene = new THREE.Scene();
  /** Physics ground frame: everything machine-related lives here. Its matrix is the slope + heading rotation. */
  groundFrame = new THREE.Group();
  sun: THREE.DirectionalLight;
  private ground: THREE.Mesh;
  private props = new THREE.Group();

  constructor(renderer: THREE.WebGLRenderer) {
    const sky = new Sky(); sky.scale.setScalar(1800);
    const u = sky.material.uniforms;
    u["turbidity"]!.value = 3.5; u["rayleigh"]!.value = 2.2; u["mieCoefficient"]!.value = 0.004; u["mieDirectionalG"]!.value = 0.8;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(140));
    u["sunPosition"]!.value.copy(sunDir);
    this.scene.add(sky);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene(); envScene.add(sky.clone());
    this.scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    this.scene.environmentIntensity = 0.55;

    this.sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
    this.sun.position.copy(sunDir).multiplyScalar(40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 120;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03; this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x6b5a45, 0.6));
    this.scene.fog = new THREE.Fog(0xb9cbd8, 70, 300);

    this.groundFrame.matrixAutoUpdate = false;
    this.scene.add(this.groundFrame);

    const { color, bump } = groundTextures();
    color.repeat.set(24, 24); bump.repeat.set(48, 48);
    const gm = new THREE.MeshStandardMaterial({ map: color, bumpMap: bump, bumpScale: 0.6, roughness: 0.93, metalness: 0 });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), gm);
    this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true;
    this.groundFrame.add(this.ground);
    this.addYardProps();
  }

  /** Winery / loading-yard dressing, placed on the sloped ground. */
  private addYardProps() {
    const props = this.props;
    const shedMat = new THREE.MeshStandardMaterial({ map: corrugatedTexture(), roughness: 0.4, metalness: 0.7 });
    (shedMat.map as THREE.Texture).repeat.set(10, 1);
    const shed = new THREE.Mesh(new THREE.BoxGeometry(30, 7, 0.3), shedMat);
    shed.position.set(-4, 3.5, -16); shed.castShadow = true; shed.receiveShadow = true; props.add(shed);
    const door = new THREE.Mesh(new THREE.BoxGeometry(5, 4.5, 0.32), new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.6 }));
    door.position.set(-6, 2.25, -15.95); props.add(door);
    // stacked grape bins
    const binGeo = new THREE.BoxGeometry(1.2, 0.75, 1.2);
    for (let i = 0; i < 6; i++) for (let k = 0; k < 2; k++) {
      const b = new THREE.Mesh(binGeo, M.grapeBin); b.position.set(6 + i * 1.3, 0.375 + k * 0.76, -13); b.castShadow = true; b.receiveShadow = true; props.add(b);
    }
    // pallet stack
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 1.0), M.timber); p.position.set(-14, 0.07 + i * 0.145, -8); p.castShadow = true; props.add(p);
    }
    // bollards
    const bol = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 12);
    const bolMat = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5 });
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(bol, bolMat); b.position.set(-12 + i * 4, 0.55, -11); b.castShadow = true; props.add(b); }
    this.groundFrame.add(props);
  }

  setTerrain(t: Terrain) {
    this.groundFrame.matrix.copy(mat3ToThree(groundFrameToWorld(t)));
    // Buildings would tilt with a sloped ground plane, which is not realistic: show the yard only on (near-)level ground.
    this.props.visible = t.slopeAngle < 0.035;
    (this.ground.material as THREE.MeshStandardMaterial).color.set(t.slopeAngle < 0.035 ? 0xffffff : 0xd8c6a8);
    this.groundFrame.matrixWorldNeedsUpdate = true;
  }
}
