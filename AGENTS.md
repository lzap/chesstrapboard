# Project instructions

- Keep `README.md`, this file, and `THIRD_PARTY_NOTICES.md` aligned with every feature or dependency change.
- Keep the application fully static. GitHub Pages hosts the built site at `/chesstrapboard/` on `https://lukas.zapletalovi.com`; runtime assets come from this repository.
- Maintain one full-game opening trainer. The CPU follows the selected opening while applicable, may seek engine-validated trap opportunities from its third move, and grades moves only afterward. Optional live evaluation may show an ungraded score during play and defaults off.
- Keep CPU difficulty separate from the frequency and size of deliberate mistake attempts. Validate generated candidate moves and replies with `chess.js`; fall back to a normal move when no candidate qualifies.
- Keep Lichess opening source TSV and deterministic, browser-ready processed data in Git. Data updates are explicit; CI verifies the processed files match their source.
- Keep the browser engine files in Git. Record the exact upstream release, checksums, GPL license, and corresponding source location.
- Attribute every external package, dataset, sound, and artwork with verified license terms before adding it.
- The move tap and opportunity chime are synthesized in `src/sound.ts`; no external audio assets are included. Keep both muted by default and honor the shared volume control. Only a validated deliberate CPU opportunity may trigger the chime during play; keep move grades and opportunity explanations for postgame review.
- Keep one clickable move list for play and postgame review. Preserve wheel and arrow-key navigation, an always-visible evaluation panel with a blank score by default, and one Copy PGN button without a visible notation box. Cancel stale live searches when the viewed position changes.
- Use `chess.js` as the authoritative rules and PGN implementation. Validate all book and engine moves through it.
- Run `npm run check`, focused tests, `npm run verify:data`, `npm run verify:engine`, `npm run verify:licenses`, and `npm run build` for code changes. Include a real-browser check when engine or Pages asset paths change.
- Follow the user's global Git instructions: pull `main` before commits, inspect recent commit style, make small reviewable commits, and ask before any push while showing changed files and destination.
