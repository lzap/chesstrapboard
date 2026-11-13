import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Chess } from 'chess.js'

const sourceCommit = '3ba6b20d31b2e6125cb0e6a2e792f400717d9d39'
const output = resolve('public/data/openings.json')
const bookOutput = resolve('public/data/book.json')
const commonOutput = resolve('public/data/common-book.json')
const openings = []
const book = new Map()
const seen = new Set()

for (const volume of 'abcde') {
  const path = resolve(`data/upstream/${volume}.tsv`)
  const lines = readFileSync(path, 'utf8').trimEnd().split('\n')
  if (lines.shift() !== 'eco\tname\tpgn') throw new Error(`${path}: unexpected header`)
  for (const [index, line] of lines.entries()) {
    const columns = line.replace(/\r$/, '').split('\t')
    if (columns.length !== 3) throw new Error(`${path}:${index + 2}: expected three columns`)
    const [eco, name, pgn] = columns
    if (!new RegExp(`^${volume.toUpperCase()}[0-9]{2}$`).test(eco) || !name || !pgn) throw new Error(`${path}:${index + 2}: invalid row`)
    const chess = new Chess()
    try {
      chess.loadPgn(pgn)
    } catch (error) {
      throw new Error(`${path}:${index + 2}: invalid PGN: ${error}`)
    }
    const history = chess.history({ verbose: true })
    const moves = history.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
    if (!moves.length) throw new Error(`${path}:${index + 2}: empty line`)
    for (const [ply, move] of history.entries()) {
      const position = move.before.split(' ').slice(0, 4).join(' ')
      let entry = book.get(position)
      if (!entry) book.set(position, entry = { choices: new Set(), maxPly: 0 })
      entry.choices.add(moves[ply])
      entry.maxPly = Math.max(entry.maxPly, moves.length)
    }
    const key = `${eco}\u0000${name}\u0000${moves.join(' ')}`
    if (seen.has(key)) throw new Error(`${path}:${index + 2}: duplicate opening`)
    seen.add(key)
    const position = chess.fen().split(' ').slice(0, 4).join(' ')
    openings.push([eco, name, moves, position])
  }
}

const payload = `${JSON.stringify({ version: 1, source: 'lichess-org/chess-openings', commit: sourceCommit, openings })}\n`
const bookPositions = [...book].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([position, entry]) => [position, [...entry.choices].sort(), entry.maxPly])
const bookPayload = `${JSON.stringify({ version: 1, source: 'lichess-org/chess-openings', commit: sourceCommit, positions: bookPositions })}\n`
const sample = JSON.parse(readFileSync(resolve('data/common-move-counts.json'), 'utf8'))
if (sample.version !== 1 || sample.source !== 'lichess_db_standard_rated_2026-10.pgn.zst'
  || sample.sampleBytes !== 16777216 || sample.sampleSha256 !== 'd94605f2c029181cfb44a2f6680de65fa24eb09f90ef3cc124802935432824e9'
  || !Number.isInteger(sample.sampleGames) || sample.sampleGames < 10000 || sample.maxPly !== 12) throw new Error('Invalid common-move sample metadata')
const samples = new Map(sample.positions.map(([position, games, moves]) => {
  if (!book.has(position) || !Number.isInteger(games) || games < 1 || !Array.isArray(moves)
    || moves.some(([move, count]) => !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) || !Number.isInteger(count) || count < 1)) {
    throw new Error(`Invalid common-move sample position: ${position}`)
  }
  return [position, { games, moves: new Map(moves) }]
}))
if (samples.size !== sample.positions.length) throw new Error('Duplicate common-move sample position')
const commonPositions = bookPositions.flatMap(([position, choices, maxPly]) => {
  const entry = samples.get(position)
  if (!entry || entry.games < 40) return []
  const ranked = choices.map((move) => [move, entry.moves.get(move) ?? 0])
    .filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const topHalf = ranked.slice(0, Math.ceil(ranked.length / 2))
  const common = topHalf.filter(([, count]) => count >= 20 && count / entry.games >= 0.025).map(([move]) => move).sort()
  return common.length ? [[position, common, Math.min(maxPly, sample.maxPly)]] : []
})
const commonPayload = `${JSON.stringify({ version: 1, source: 'data/common-move-counts.json', positions: commonPositions })}\n`
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== payload) throw new Error('Processed opening file is stale; run npm run prepare:data')
  if (readFileSync(bookOutput, 'utf8') !== bookPayload) throw new Error('Processed book file is stale; run npm run prepare:data')
  if (readFileSync(commonOutput, 'utf8') !== commonPayload) throw new Error('Common opening book is stale; run npm run prepare:data')
  console.log(`Verified ${openings.length} committed openings, ${book.size} book positions, and ${commonPositions.length} common positions`)
} else {
  mkdirSync(resolve('public/data'), { recursive: true })
  writeFileSync(output, payload)
  writeFileSync(bookOutput, bookPayload)
  writeFileSync(commonOutput, commonPayload)
  console.log(`Wrote ${openings.length} openings, ${book.size} book positions, and ${commonPositions.length} common positions`)
}
