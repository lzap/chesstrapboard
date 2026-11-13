# Third-party notices

The application source is MIT licensed. Its current development dependencies and runtime library are:

| Component | Version | License | Source |
|---|---:|---|---|
| chess.js | 1.4.0 | BSD-2-Clause | <https://github.com/jhlywa/chess.js> |
| Vite | 8.3.8 | MIT | <https://github.com/vitejs/vite> |
| TypeScript | 7.0.2 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| Vitest | 5.1.0 | MIT | <https://github.com/vitest-dev/vitest> |
| Lichess chess-openings dataset | `3ba6b20d31b2e6125cb0e6a2e792f400717d9d39` | CC0 1.0 | <https://github.com/lichess-org/chess-openings> |

These packages and opening data are used under their upstream licenses. Package license files are available in `node_modules` after `npm ci`; the lockfile pins the exact package graph. The opening snapshot and its processed browser asset are committed here. Engine and optional audio notices will be added in the same commits that introduce those assets.
