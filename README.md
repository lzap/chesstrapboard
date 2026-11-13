# Chess Trap Board

A static opening trainer for beginners. GitHub Actions builds the site for GitHub Pages at <https://lukas.zapletalovi.com/chesstrapboard/>. This is the HTTPS custom domain used by `lzap`'s Pages site.

- Select a Lichess opening or leave it unset for a random line. Make your first move or press **New game** to begin.
- Play as White or Black against the self-hosted Stockfish engine. It follows the opening when possible and may deliberately offer an advantage from its third move.
- Adjust CPU difficulty, mistake frequency, and opportunity size. Turn on live evaluation if you want scores during play.
- Use **Hint** for a suggested move. Optional local sounds and an opportunity cue can alert you during play.
- Finish with **End game & Analyze**, or play to a natural ending. Review the evaluation and suggested line; an underlined CPU move marks an opportunity, followed by `!` or `?` on your reply.
- Click moves or use the wheel and arrow keys to replay the game, then use **Copy PGN** to export it.

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

The engine's matching Worker and WASM files are committed under `public/engine/`. The browser loads them from this site for CPU moves, postgame review, or optional live evaluation. Their exact release, checksums, GPL-3.0 license, and corresponding source are recorded in [public/engine/SOURCE.md](public/engine/SOURCE.md). This repository's MIT license covers our own application code; the engine remains GPL-3.0.

## Licenses and credits

This project's own code and synthesized sound are MIT licensed; see [LICENSE](LICENSE). Every third-party component retains its upstream license:

The GitHub sponsor configuration in [.github/FUNDING.yml](.github/FUNDING.yml) lists `lzap` as its only funding option.

| Component | Purpose | License | Source |
|---|---|---|---|
| [chess.js 1.4.0](https://github.com/jhlywa/chess.js) | Rules and PGN | BSD-2-Clause | [License text](public/licenses/chess.js-LICENSE.txt) |
| [Lichess chess-openings](https://github.com/lichess-org/chess-openings) at `3ba6b20` | Opening names and lines | CC0 1.0 | [Snapshot](data/upstream/README.md) |
| [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1) | Browser WASM engine | GPL-3.0 | [License, checksums, and source](public/engine/SOURCE.md) |
| [Vite 8.3.8](https://github.com/vitejs/vite) | Site build | MIT | [Upstream license](https://github.com/vitejs/vite/blob/main/packages/vite/LICENSE.md) |
| [TypeScript 7.0.2](https://github.com/microsoft/TypeScript) | Type checking | Apache-2.0 | [Upstream license](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) |
| [Vitest 5.1.0](https://github.com/vitest-dev/vitest) | Unit tests | MIT | [Upstream license](https://github.com/vitest-dev/vitest/blob/main/LICENSE) |

The lockfile pins all transitive npm packages; their license files are available in `node_modules` after `npm ci`. `npm run verify:licenses` checks each package license and compares the distributed chess.js notice with the installed package. The committed opening source and processed browser asset, the GPL engine files, and the optional sounds are described above. Runtime engine and opening data are hosted by this repository without a third-party service.
