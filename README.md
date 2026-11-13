# Chess Trap Board

A static opening trainer for beginners. GitHub Actions builds the site for GitHub Pages at <https://lukas.zapletalovi.com/chesstrapboard/>. This is the HTTPS custom domain used by `lzap`'s Pages site.

- Select a Lichess opening or leave it unset for a random line. Make your first move or press **New game** to begin from the usual board; **New ECO game** starts from the selected opening's final position.
- Play as White or Black against the self-hosted Stockfish engine. If you leave the selected line, the computer uses moves from any matching database position, preferring moves that keep the book going. It uses the engine when no book move remains and may seek deliberate opportunities from its third move.
- Adjust CPU difficulty, mistake frequency, and opportunity size. New visitors start at Intermediate difficulty. Normal engine play may choose randomly between two moves evaluated within 0.2 pawns of each other. Turn on live evaluation for scores during play; the last score stays visible while the next one is calculated.
- Use **Hint** to highlight a move on the board. In a book position, repeated presses cycle through every legal book move in a shuffled order; elsewhere Hint uses the engine. Optional local sounds and an opportunity cue can alert you during play, including when a CPU move gives you a confirmed forced mate. Checkmate and stalemate play the opportunity chime instead of the move tap.
- Finish with **End game**, or play to a natural ending. While you think, a separate engine Worker quietly analyzes reached positions with a fixed budget and stops when they are covered. The game record appears immediately at the end; any positions missed during fast play fill in quietly afterward. Review the evaluation and suggested line; move across the line to preview it on the board. Sparse `!`, `!!`, `?`, and `??` marks highlight clear engine findings. An underlined CPU move marks an opportunity; its reply always gets `!` or `?` instead of a general mark.
- Use **Take back** to redo your last move and any CPU reply. Click moves or use the wheel and arrow keys to replay the game, then use **Copy PGN** to export it.

## Share a training link

Links can set `opening` (an ECO code), optional exact `name`, `side=white` or `side=black`, `difficulty=beginner|intermediate|strong`, `frequency=off|rare|sometimes|often|almostAlways`, `size=mild|medium|large`, and `evaluation=on|off`. A valid link starts the game as soon as the opening data loads, using the app defaults for any omitted training setting. Without `name`, the app chooses a representative line for that ECO code. Changing settings updates the address bar, so you can copy its URL to share the current setup.

These ten tactical openings are in the committed Lichess snapshot. They are practice starting points; a trap or forced mate still depends on the moves played and the engine's search.

### Play as White

- [C57 Italian Game: Two Knights Defense, Fried Liver Attack](https://lukas.zapletalovi.com/chesstrapboard/?opening=C57&name=Italian+Game%3A+Two+Knights+Defense%2C+Fried+Liver+Attack&side=white)
- [C21 Danish Gambit Accepted](https://lukas.zapletalovi.com/chesstrapboard/?opening=C21&name=Danish+Gambit+Accepted&side=white)
- [B21 Sicilian Defense: Smith-Morra Gambit Accepted](https://lukas.zapletalovi.com/chesstrapboard/?opening=B21&name=Sicilian+Defense%3A+Smith-Morra+Gambit+Accepted&side=white)
- [C47 Four Knights Game: Halloween Gambit](https://lukas.zapletalovi.com/chesstrapboard/?opening=C47&name=Four+Knights+Game%3A+Halloween+Gambit&side=white)
- [D00 Blackmar-Diemer Gambit Accepted: Ryder Gambit](https://lukas.zapletalovi.com/chesstrapboard/?opening=D00&name=Blackmar-Diemer+Gambit+Accepted%3A+Ryder+Gambit&side=white)

### Play as Black

- [C42 Petrov's Defense: Stafford Gambit](https://lukas.zapletalovi.com/chesstrapboard/?opening=C42&name=Petrov%27s+Defense%3A+Stafford+Gambit&side=black)
- [C57 Italian Game: Two Knights Defense, Traxler Counterattack](https://lukas.zapletalovi.com/chesstrapboard/?opening=C57&name=Italian+Game%3A+Two+Knights+Defense%2C+Traxler+Counterattack&side=black)
- [A40 Englund Gambit](https://lukas.zapletalovi.com/chesstrapboard/?opening=A40&name=Englund+Gambit&side=black)
- [D08 Queen's Gambit Declined: Albin Countergambit, Lasker Trap](https://lukas.zapletalovi.com/chesstrapboard/?opening=D08&name=Queen%27s+Gambit+Declined%3A+Albin+Countergambit%2C+Lasker+Trap&side=black)
- [C40 Latvian Gambit](https://lukas.zapletalovi.com/chesstrapboard/?opening=C40&name=Latvian+Gambit&side=black)

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

The opening snapshot in `data/upstream/` is pinned to [Lichess chess-openings commit `3ba6b20`](https://github.com/lichess-org/chess-openings/commit/3ba6b20d31b2e6125cb0e6a2e792f400717d9d39). The browser-ready `public/data/openings.json` and position-indexed `public/data/book.json` are committed. Refresh both deliberately with `npm run prepare:data`; CI checks them with `npm run verify:data`. The served files total about 150 KB with gzip. The position book can continue through a matching line after the selected name ends or the move order changes. The browser never fetches from Lichess.

The engine's matching Worker and WASM files are committed under `public/engine/`. The browser loads them from this site for CPU moves, silent background analysis, postgame review, or optional live evaluation. Background review uses 500 ms per position, or 1,200 ms near a generated opportunity, then idles. If fast play leaves gaps, it completes them with 260 ms and 850 ms budgets after the game. It pauses for CPU turns, engine hints, live evaluation searches, and hidden tabs. Scores and grades from background analysis remain hidden until review. Their exact release, checksums, GPL-3.0 license, and corresponding source are recorded in [public/engine/SOURCE.md](public/engine/SOURCE.md). This repository's MIT license covers our own application code; the engine remains GPL-3.0.

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
