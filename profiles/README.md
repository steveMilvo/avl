# Machine profiles

Versioned machine specification data, kept separate from application code.

- Every numeric parameter is a **datum**: `{ "value": 1700, "unit": "mm", "status": "assumed", "source": "...", "note": "..." }`.
  `status` is one of `manufacturer`, `measured`, `estimated`, `assumed`.
  Units are converted to SI when the profile is loaded (`resolveDatums`). Accepted units: `m`, `mm`, `kg`, `t`, `rad`, `deg`, `m3`, `kg/m3`.
- `meta.releaseStatus` is one of `generic-educational`, `manufacturer-data-entered`, `physics-validated`, `released-for-training`.
  A manufacturer name or a realistic 3D model never implies validated physics.
- `meta.id` is unique and stable; bump `meta.version` when any datum changes.
- Generic demonstration profiles live under `generic.*` ids. Manufacturer-specific records (future catalogue:
  machine type → manufacturer → model → configuration) will live in sibling folders and must not reuse generic ids.

Coordinate conventions are in `docs/03-architecture.md`. Field meanings are documented in
`packages/physics/src/forklift.ts` and `packages/physics/src/loader.ts`.
