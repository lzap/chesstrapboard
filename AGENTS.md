# Project instructions

- Keep `README.md`, this file, and `THIRD_PARTY_NOTICES.md` aligned with every feature or dependency change.
- Keep the application fully static. GitHub Pages hosts the built site at `/chesstrapboard/`; runtime assets come from this repository.
- Maintain two clearly separate modes: Memorize lines corrects deviations immediately and ends with the selected line; Explore traps allows a full game and shows evaluations only afterward.
- Keep Lichess opening source TSV and deterministic, browser-ready processed data in Git. Data updates are explicit; CI verifies the processed files match their source.
- Keep the browser engine files in Git. Record the exact upstream release, checksums, GPL license, and corresponding source location.
- Attribute every external package, dataset, sound, and artwork with verified license terms before adding it.
- Use `chess.js` as the authoritative rules and PGN implementation. Validate all book and engine moves through it.
- Run `npm run check`, focused tests, and `npm run build` for code changes. Include a real-browser check when engine or Pages asset paths change.
- Follow the user's global Git instructions: pull `main` before commits, inspect recent commit style, make small reviewable commits, and ask before any push while showing changed files and destination.
