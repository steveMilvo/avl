# LoadLab — Forklift and Loader Stability Simulator

Interactive 3D training simulator for counterbalanced forklift and articulated front-end loader
operators (Australian workplace context: winery warehouses, loading yards, bulk-material handling).

> **Status: stage 2 of 8 — headless physics proof.** No rendering yet, by design: the brief requires
> verifiable calculations before visuals. All machine data in this repository is **generic and assumed**.
> Results are illustrative only and are not operating limits for any real machine.

## Repository layout

| Path | Purpose |
|---|---|
| `docs/` | Brief analysis, architecture, deployment decision, data requirements, model scope, validation plan, open questions |
| `packages/physics/` | Physics core (TypeScript, no rendering dependencies). SI units, documented frames |
| `packages/physics/test/` | Analytical benchmarks and regression tests (`pnpm test`) |
| `profiles/` | Versioned machine profiles (JSON). Every number carries unit, source and status |
| `scenarios/` | Reproducible scenario files (lesson presets) |
| `apps/` | Training application (stage 5, not started) |

## Quick start

```bash
pnpm install
pnpm test        # 47 analytical / regression tests
pnpm bench       # prints the priority loader slope matrix and forklift lesson matrix
```

## Development sequence (from the brief)

1. ✅ Architecture, model scope and data requirements — `docs/`
2. ✅ Headless physics proof with analytical benchmarks — `packages/physics`
3. ✅ (draft) One forklift and one articulated loader demonstration profile — `profiles/`
4. ⏳ Priority articulated-loader slope comparison (physics done, UI pending)
5. ⏳ Interactive 3D rendering and engineering overlays
6. ⏳ Training scenarios and comparison mode
7. ⏳ Validation report and documented limitations
8. ⏳ Deployable application, source code and setup instructions

See `docs/07-open-questions.md` for decisions needed from the client.
