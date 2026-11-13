# CHESS TRAP BOARD

A static opening trainer for beginners. The site is built with GitHub Actions and published with GitHub Pages at <https://lzap.github.io/chesstrapboard/>.

The first local milestone provides the application shell. Playable chess, opening practice, an engine opponent, and review will be added in small commits before publication.

## Development

Use Node.js 22.12 or newer.

```sh
npm ci
npm run check
npm run build
npm run dev
```

The Vite base path is `/chesstrapboard/` for project Pages. The deploy workflow builds `dist/` and publishes it using the GitHub Pages artifact actions.

## Licenses and credits

This project's own code is MIT licensed; see [LICENSE](LICENSE). Third-party packages and data retain their own licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the pinned versions, sources, and notices. Runtime engine and opening data will be hosted by this repository, without a third-party service.

## Design

The [design](https://gist.github.com/lzap/649b7eec7f13ccdc16247c0419f5da1e) specifies two modes: **Memorize lines** gives immediate correction; **Explore traps** plays a full game and reveals engine analysis afterward. The opening data, engine, and optional sound are self-hosted and credited.
