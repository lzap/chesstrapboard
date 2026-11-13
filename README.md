# CHESS TRAP BOARD

A static opening trainer for beginners. The site is built with GitHub Actions and published with GitHub Pages at <https://lzap.github.io/chesstrapboard/>.

The board supports **Memorize lines**: choose one of 3,865 Lichess opening lines, play either side, receive immediate correction, and copy the PGN. **Explore traps** plays a full game against a self-hosted Stockfish.js WebAssembly engine. Difficulty presets change the normal thinking budget. A separate Off/Rare/Sometimes/Often control sets the chance of attempting a deliberate, plausible mistake on eligible CPU turns; a size control selects the intended advantage range. If no suitable move is found, the CPU plays normally. A lower thinking budget can still lead to ordinary engine errors. Postgame review will be added in the next commit before publication.

## Development

Use Node.js 22.12 or newer.

```sh
npm ci
npm run check
npm test
npm run verify:data
npm run verify:engine
npm run build
npm run dev
```

The Vite base path is `/chesstrapboard/` for project Pages. The deploy workflow builds `dist/` and publishes it using the GitHub Pages artifact actions.

The opening snapshot in `data/upstream/` is pinned to [Lichess chess-openings commit `3ba6b20`](https://github.com/lichess-org/chess-openings/commit/3ba6b20d31b2e6125cb0e6a2e792f400717d9d39). The browser-ready `public/data/openings.json` is committed. Refresh it deliberately with `npm run prepare:data`; CI checks it with `npm run verify:data`. The served file is about 736 KB raw and 93 KB with gzip. The browser never fetches from Lichess.

The engine's matching Worker and WASM files are committed under `public/engine/`. The browser loads them from this site when Explore traps starts. Their exact release, checksums, GPL-3.0 license, and corresponding source are recorded in [public/engine/SOURCE.md](public/engine/SOURCE.md). This repository's MIT license covers our own application code; the engine remains GPL-3.0.

## Licenses and credits

This project's own code is MIT licensed; see [LICENSE](LICENSE). Third-party packages and data retain their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the pinned versions, sources, and notices. Runtime engine and opening data will be hosted by this repository, without a third-party service.

## Design

The [design](https://gist.github.com/lzap/649b7eec7f13ccdc16247c0419f5da1e) specifies two modes: **Memorize lines** gives immediate correction; **Explore traps** plays a full game and reveals engine analysis afterward. The opening data, engine, and optional sound are self-hosted and credited.
