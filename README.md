# Chess Trap Board

A static opening trainer for beginners. GitHub Actions builds the site for GitHub Pages at <https://lukas.zapletalovi.com/chesstrapboard/>. This is the HTTPS custom domain used by `lzap`'s Pages site.

Choose one of 3,865 Lichess opening lines and play a full game against a self-hosted Stockfish.js WebAssembly engine. The CPU follows the selected line while it remains applicable, then continues with the engine. You may play either side and deviate at any time. From its third move, the CPU may search for an engine-validated mistake even during the selected line. Difficulty presets change the normal thinking budget. A separate control sets the chance of attempting a deliberate, plausible mistake on eligible CPU turns: Off, 25%, 50%, 85%, or 95%. New visitors start at 85%. A size control selects the intended advantage range: Mild targets about 0.3–1.0 pawns, Medium 0.6–2.5, and Large 1.5–8.0. Candidates receive a second engine check from the player's resulting position before play. These are overlapping engine estimates, not guaranteed gains. If no suitable move is found, the CPU keeps following the line or plays normally. A lower thinking budget can still lead to ordinary engine errors.

The evaluation card sits above the move list and stays visible. Its score and bar stay blank during play by default; **Show evaluation during play** starts a separate, self-hosted engine Worker and displays an estimate for the viewed position. The app shows how many opportunity checks ran and how many produced a candidate. A validated candidate gets a brief visual cue beside the board and in the settings panel on the player's turn; the optional opportunity chime is muted by default. The app waits until the game ends to grade moves and explain opportunities. Review progress, summary, navigation, and selected-move details appear below **Copy PGN**, so changing labels do not shift the move list. The cancellable postgame review shows checks and generated candidates, marks generated CPU moves with `◇` and a gold underline, and underlines the player's reply green when found, red when missed, or amber when partial. If the postgame search no longer confirms an advantage, the result remains unconfirmed. The same clickable list also has `?!`, `?`, `??`, `!`, and `!!` grades. Select a move for the engine's suggested line and opportunity outcome.

Click a move to replay it. The mouse wheel over the board, move list, evaluation card, or review controls steps through positions; Left/Right arrow keys step one played move, and Up/Down keys step two. Return to the latest position to resume play. **Copy PGN** copies the complete game without showing a notation box.

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

The engine's matching Worker and WASM files are committed under `public/engine/`. The browser loads them from this site for CPU moves, postgame review, or optional live evaluation. Their exact release, checksums, GPL-3.0 license, and corresponding source are recorded in [public/engine/SOURCE.md](public/engine/SOURCE.md). This repository's MIT license covers our own application code; the engine remains GPL-3.0.

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

The lockfile pins all transitive npm packages; their license files are available in `node_modules` after `npm ci`. `npm run verify:licenses` checks each package license and compares the distributed chess.js notice with the installed package. The committed opening source and processed browser asset, the GPL engine files, and the optional sounds are described above. Runtime engine and opening data are hosted by this repository without a third-party service.
