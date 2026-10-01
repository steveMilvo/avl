# 2. Deployment approach: native Unreal Engine vs. browser real-time 3D

The brief requires this decision before implementation and warns not to assume a browser build has
native Unreal capability.

| Criterion | Native Unreal Engine 5 (Windows) | Browser (Three.js / WebGL2, optional WebGPU) |
|---|---|---|
| Visual ceiling | Highest: Lumen GI, Nanite, virtual shadow maps, film-quality PBR | Good PBR with baked/IBL lighting, real-time shadows, SSAO, bloom. No dynamic GI at Unreal level |
| Hardware needed | Discrete GPU (roughly GTX 1660 / RX 5600 class or better) for Lumen at 1080p; 8–16 GB RAM; ~5–15 GB install | Integrated graphics on a recent laptop is enough at projector resolutions; runs on Chromebooks and locked-down school/TAFE PCs |
| Install / IT approval | Installer, admin rights, per-machine updates, AV/whitelisting | URL or offline static folder; no install; updates by redeploy |
| Physics core reuse | Must port to C++ or run TS via an embedded JS runtime; or call a C++ port of the same model | TypeScript core runs directly; same code in tests, app and reports |
| Transparency / testability | Unreal Chaos physics is a black box for teaching; we would still need our own model | Our own model is the physics; renderer only draws it |
| Classroom projector use | Excellent | Excellent |
| Offline sites (yards, wineries with poor connectivity) | Native, offline | Packaged as a PWA or Electron/Tauri desktop wrapper: offline |
| Development cost and speed | Higher (C++/Blueprints, asset pipeline, build infrastructure) | Lower; faster iteration with trainers |
| Future VR | Strong | WebXR possible, weaker |

## Recommendation (pending confirmation — see `07-open-questions.md`)

**Browser-based real-time 3D first, packaged as an offline desktop app (Tauri/Electron) for sites
without reliable internet,** with the physics core kept engine-agnostic.

Rationale: the brief's priority is correct, explainable physics on typical training computers, and the
physics must not be delegated to a game engine's solver anyway. The browser build will look like a
high-quality real-time product (PBR materials, HDRI lighting, soft shadows, detailed tyres/mast/
cylinders), but it will **not** match Unreal's Lumen/Nanite fidelity, and we will not claim it does.

If the client's training PCs have discrete GPUs and photorealism is a hard requirement, an Unreal 5
front end can be added later, driving the same physics core (C++ port verified against the same
benchmark suite).
