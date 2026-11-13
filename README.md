# CHESS TRAP BOARD

A static opening trainer for beginners. The site is built with GitHub Actions and published with GitHub Pages at <https://lzap.github.io/chesstrapboard/>.

The board supports **Memorize lines**: choose one of 3,865 Lichess opening lines, play either side, receive immediate correction, and copy the PGN. **Explore traps**, the engine opponent, and postgame review will follow in the next commits before publication.

## Development

Use Node.js 22.12 or newer.

```sh
npm ci
npm run check
npm test
npm run verify:data
npm run build
npm run dev
```

The Vite base path is `/chesstrapboard/` for project Pages. The deploy workflow builds `dist/` and publishes it using the GitHub Pages artifact actions.

The opening snapshot in `data/upstream/` is pinned to [Lichess chess-openings commit `3ba6b20`](https://github.com/lichess-org/chess-openings/commit/3ba6b20d31b2e6125cb0e6a2e792f400717d9d39). The browser-ready `public/data/openings.json` is committed. Refresh it deliberately with `npm run prepare:data`; CI checks it with `npm run verify:data`. The served file is about 736 KB raw and 93 KB with gzip. The browser never fetches from Lichess.

## Licenses and credits

This project's own code is MIT licensed; see [LICENSE](LICENSE). Third-party packages and data retain their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the pinned versions, sources, and notices. Runtime engine and opening data will be hosted by this repository, without a third-party service.

## Design

The [design](https://gist.github.com/lzap/649b7eec7f13ccdc16247c0419f5da1e) specifies two modes: **Memorize lines** gives immediate correction; **Explore traps** plays a full game and reveals engine analysis afterward. The opening data, engine, and optional sound are self-hosted and credited.
