# Third-party notices

The application source is MIT licensed. Its current development dependencies and runtime library are:

| Component | Version | License | Source |
|---|---:|---|---|
| chess.js | 1.4.0 | BSD-2-Clause | <https://github.com/jhlywa/chess.js> |
| Vite | 8.3.8 | MIT | <https://github.com/vitejs/vite> |
| TypeScript | 7.0.2 | Apache-2.0 | <https://github.com/microsoft/TypeScript> |
| Vitest | 5.1.0 | MIT | <https://github.com/vitest-dev/vitest> |
| Lichess chess-openings dataset | `3ba6b20d31b2e6125cb0e6a2e792f400717d9d39` | CC0 1.0 | <https://github.com/lichess-org/chess-openings> |
| Stockfish.js lite single-threaded WASM | 19.0.1 | GPL-3.0 | <https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1> |

These packages, opening data, and engine are used under their upstream licenses. Package license files are available in `node_modules` after `npm ci`; the lockfile pins the exact package graph. The opening snapshot and its processed browser asset are committed here. The engine's full GPL text and exact-source information are in [public/engine/](public/engine/). The full chess.js BSD-2-Clause notice is distributed in [public/licenses/chess.js-LICENSE.txt](public/licenses/chess.js-LICENSE.txt). The move sound is original Web Audio synthesis under this project's MIT license, with no external recording.
