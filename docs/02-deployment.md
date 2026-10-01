# 2. Deployment approach: native Unreal Engine vs. browser real-time 3D

The brief requires this decision before implementation and warns not to assume a browser build has
native Unreal capability.

| Criterion | Native Unreal Engine 5 (Windows) | Browser engine (Three.js / WebGL2) |
|---|---|---|
| Visual ceiling | Highest: Lumen GI, Nanite, virtual shadow maps | Good PBR with image-based lighting, real-time soft shadows, ambient occlusion, bloom, tone mapping. No dynamic global illumination at Unreal level |
| Hardware needed | Discrete GPU for Lumen at 1080p; 8–16 GB RAM; large install | Integrated graphics works; a discrete GPU allows full shadow and post-processing quality |
| Install / IT approval | Installer, admin rights, per-machine updates | Opens in Chrome/Edge from a URL or a local folder; can be wrapped as a desktop app |
| Physics core reuse | Port to C++ and re-verify against the benchmark suite | TypeScript core runs directly; one codebase for tests, app and reports |
| Transparency / testability | Engine physics is a black box; our own model is still needed | Our own model is the physics; the renderer only draws it |
| Development cost and speed | Higher | Lower; faster iteration with trainers |

## Decision

The client's training laptops have dedicated graphics cards, so either approach would run.
**Release 1 uses the browser engine (Three.js, WebGL2) at its highest quality settings**, because:

1. The physics must come from our own tested model, not a game-engine solver, so Unreal's main
   advantage over a browser engine is lighting fidelity, not correctness.
2. One TypeScript codebase keeps the app, tests and reports in exact agreement.
3. Trainers can run it from a link or a folder without IT installs.

It will **not** match Unreal's Lumen/Nanite photorealism, and the product makes no such claim.
The physics core stays engine-agnostic, so an Unreal 5 front end can be added later if photorealism
becomes a hard requirement. That front end would drive a C++ port verified against the same benchmarks.
