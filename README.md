# CHESS TRAP BOARD

A static opening trainer for beginners. GitHub Actions builds the site for GitHub Pages at <https://lukas.zapletalovi.com/chesstrapboard/>. This is the HTTPS custom domain used by `lzap`'s Pages site.

The board supports **Memorize lines**: choose one of 3,865 Lichess opening lines, play either side, receive immediate correction, and copy the PGN. **Explore traps** plays a full game against a self-hosted Stockfish.js WebAssembly engine. Difficulty presets change the normal thinking budget. A separate Off/Rare/Sometimes/Often control sets the chance of attempting a deliberate, plausible mistake on eligible CPU turns; a size control selects the intended advantage range. If no suitable move is found, the CPU plays normally. A lower thinking budget can still lead to ordinary engine errors.

The evaluation panel is always visible. Its score and bar stay blank during play by default; **Show evaluation during play** starts a separate, self-hosted engine Worker and displays an estimate for the viewed position. Explore traps still waits until the game ends to grade moves and explain opportunities. Its cancellable postgame review adds `?!`, `?`, `??`, `!`, and `!!` marks to the same clickable move list, with the engine's suggested line shown for the selected move. An optional opportunity chime can cue a validated deliberate CPU mistake during play.

Click a move to replay it. The mouse wheel over the board, move list, or review panel steps through positions; Left/Right arrow keys step one played move, and Up/Down keys step two. Return to the latest position to resume play. **Copy PGN** copies the complete game without showing a notation box.

The gentle move tap and two-note opportunity chime are synthesized locally with Web Audio. Each has its own toggle, both are off by default, and they share a volume control. No sound file is downloaded.

## Development

Use Node.js 22.12 or newer.

```sh
npm ci
npm run check
npm test
npm run verify:data
npm run verify:engine
npm run verify:licenses
npm run build
npm run dev
```

The Vite base path is `/chesstrapboard/` for project Pages. The deploy workflow builds `dist/` and publishes it using the GitHub Pages artifact actions.

The opening snapshot in `data/upstream/` is pinned to [Lichess chess-openings commit `3ba6b20`](https://github.com/lichess-org/chess-openings/commit/3ba6b20d31b2e6125cb0e6a2e792f400717d9d39). The browser-ready `public/data/openings.json` is committed. Refresh it deliberately with `npm run prepare:data`; CI checks it with `npm run verify:data`. The served file is about 736 KB raw and 93 KB with gzip. The browser never fetches from Lichess.

The engine's matching Worker and WASM files are committed under `public/engine/`. The browser loads them from this site when Explore traps or optional live evaluation starts. Their exact release, checksums, GPL-3.0 license, and corresponding source are recorded in [public/engine/SOURCE.md](public/engine/SOURCE.md). This repository's MIT license covers our own application code; the engine remains GPL-3.0.

## Licenses and credits

This project's own code and synthesized sound are MIT licensed; see [LICENSE](LICENSE). Every third-party component retains its upstream license:

| Component | Purpose | License | Source |
|---|---|---|---|
| [chess.js 1.4.0](https://github.com/jhlywa/chess.js) | Rules and PGN | BSD-2-Clause | [License text](public/licenses/chess.js-LICENSE.txt) |
| [Lichess chess-openings](https://github.com/lichess-org/chess-openings) at `3ba6b20` | Opening names and lines | CC0 1.0 | [Snapshot](data/upstream/README.md) |
| [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1) | Browser WASM engine | GPL-3.0 | [License, checksums, and source](public/engine/SOURCE.md) |
| [Vite 8.3.8](https://github.com/vitejs/vite) | Site build | MIT | [Upstream license](https://github.com/vitejs/vite/blob/main/packages/vite/LICENSE.md) |
| [TypeScript 7.0.2](https://github.com/microsoft/TypeScript) | Type checking | Apache-2.0 | [Upstream license](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) |
| [Vitest 5.1.0](https://github.com/vitest-dev/vitest) | Unit tests | MIT | [Upstream license](https://github.com/vitest-dev/vitest/blob/main/LICENSE) |

The lockfile pins transitive npm packages, and `npm run verify:licenses` rejects packages without one of the recorded free-software licenses. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) carries the exact versions and distribution notes. Runtime engine and opening data are hosted by this repository without a third-party service.

## Design

The [design](https://gist.github.com/lzap/649b7eec7f13ccdc16247c0419f5da1e) specifies two modes: **Memorize lines** gives immediate correction; **Explore traps** plays a full game and reveals engine analysis afterward. The opening data, engine, and optional sound are self-hosted and credited.
