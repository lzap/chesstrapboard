# Common opening book source

The Lichess [chess-openings](https://github.com/lichess-org/chess-openings) catalogue names lines but does not provide game counts. The unselected-opening game uses a smaller book built from those lines and an offline sample of actual play. The sample comes from the [Lichess standard rated-game export](https://database.lichess.org/standard/) for October 2026, released under [CC0](https://database.lichess.org/). No game records are served by the site or committed here.

- Source: `https://database.lichess.org/standard/lichess_db_standard_rated_2026-10.pgn.zst`
- Sample: first 16,777,216 compressed bytes (HTTP range `0-16777215`)
- Sample SHA-256: `d94605f2c029181cfb44a2f6680de65fa24eb09f90ef3cc124802935432824e9`
- Complete games counted: 51,097; first 12 plies per game
- Committed aggregate counts: `data/common-move-counts.json`
- Browser file: `public/data/common-book.json`, currently 481 positions and about 4.7 KB with gzip

For each position in the full Lichess opening book, the common book keeps moves in the most-played half of observed book moves. A retained move must also occur in at least 20 sampled games and account for at least 2.5% of moves from that position; the position must have at least 40 sampled games. This keeps the common first moves (`e4`, `d4`, `Nf3`, `c4`) while excluding rare catalogue branches. At each CPU turn the app randomly selects from the remaining legal moves, preferring those with another common-book continuation. The user can play any legal move; when the common book runs out, the CPU uses Stockfish. Explicitly selected openings still use the full Lichess book.

To reproduce the committed counts and browser file from the pinned source:

```sh
curl -L --range 0-16777215 -o /tmp/chesstrap-lichess-2026-10-first16m.zst https://database.lichess.org/standard/lichess_db_standard_rated_2026-10.pgn.zst
sha256sum /tmp/chesstrap-lichess-2026-10-first16m.zst
node scripts/sample-common-moves.mjs /tmp/chesstrap-lichess-2026-10-first16m.zst > data/common-move-counts.json
npm run prepare:data
npm run verify:data
```

The compressed range ends inside a zstd frame. The sampling script accepts the complete PGN records available before that point, so the decompressor may report an expected incomplete-frame error after producing the sample.
