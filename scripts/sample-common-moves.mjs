import { createInterface } from 'node:readline'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { Chess } from 'chess.js'
import { readFileSync } from 'node:fs'

// Read a 16 MiB range of the official Lichess standard-rated export.
// The range ends inside a zstd frame; decompression still yields complete games.
const inputPath = process.argv[2]
if (!inputPath) throw new Error('Pass the downloaded 16 MiB .pgn.zst sample path')
const compressed = readFileSync(inputPath)
if (compressed.length !== 16777216) throw new Error('Expected exactly 16 MiB of compressed PGN')
const sampleSha256 = createHash('sha256').update(compressed).digest('hex')
const decompressor = spawn('zstd', ['-dc', inputPath], { stdio: ['ignore', 'pipe', 'ignore'] })
// Only positions in our committed opening book are counted.
const book = JSON.parse(readFileSync('public/data/book.json', 'utf8'))
const positions = new Set(book.positions.map(([position]) => position))
const counts = new Map()
let games = 0
let skipped = 0

for await (const line of createInterface({ input: decompressor.stdout, crlfDelay: Infinity })) {
  if (!line.startsWith('1. ') || !/ (?:1-0|0-1|1\/2-1\/2|\*)$/.test(line)) continue
  const chess = new Chess()
  const text = line.replace(/\{[^}]*\}/g, '').replace(/\d+\.(?:\.\.)?/g, ' ')
  const moves = text.trim().split(/\s+/).slice(0, 12)
  try {
    for (const san of moves) {
      if (/^(?:1-0|0-1|1\/2-1\/2|\*)$/.test(san)) break
      const position = chess.fen().split(' ').slice(0, 4).join(' ')
      const move = chess.move(san.replace(/[!?]+$/, ''))
      if (positions.has(position)) {
        let entry = counts.get(position)
        if (!entry) counts.set(position, entry = { games: 0, moves: new Map() })
        const uci = `${move.from}${move.to}${move.promotion ?? ''}`
        entry.games += 1
        entry.moves.set(uci, (entry.moves.get(uci) ?? 0) + 1)
      }
    }
    games += 1
  } catch {
    skipped += 1
  }
}

const records = [...counts].sort(([a], [b]) => a.localeCompare(b))
  .map(([position, entry]) => [position, entry.games, [...entry.moves].sort(([a], [b]) => a.localeCompare(b))])
console.error(`Counted ${games} complete games, skipped ${skipped}; ${records.length} opening positions`)
console.log(JSON.stringify({ version: 1, source: 'lichess_db_standard_rated_2026-10.pgn.zst',
  sampleBytes: compressed.length, sampleSha256,
  sampleGames: games, maxPly: 12, positions: records }))
