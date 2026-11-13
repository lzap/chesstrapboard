# Lichess chess openings snapshot

Source: <https://github.com/lichess-org/chess-openings>

Pinned upstream commit: `3ba6b20d31b2e6125cb0e6a2e792f400717d9d39`

License: CC0 1.0 Public Domain Dedication, as stated in the upstream README.

The five TSV files are retained for provenance. Run `npm run prepare:data` to regenerate the committed browser files `public/data/openings.json`, `public/data/book.json`, and `public/data/common-book.json`. The common book also uses [offline rated-game counts](../COMMON_BOOK.md). CI runs `npm run verify:data` to ensure the processed files are current. The site serves only its own processed files; it does not request data from Lichess at runtime.
