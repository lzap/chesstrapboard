import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Chess } from 'chess.js'

const sourceCommit = '3ba6b20d31b2e6125cb0e6a2e792f400717d9d39'
const output = resolve('public/data/openings.json')
const bookOutput = resolve('public/data/book.json')
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
const bookPayload = `${JSON.stringify({ version: 1, source: 'lichess-org/chess-openings', commit: sourceCommit, positions: [...book].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([position, entry]) => [position, [...entry.choices].sort(), entry.maxPly]) })}\n`
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== payload) throw new Error('Processed opening file is stale; run npm run prepare:data')
  if (readFileSync(bookOutput, 'utf8') !== bookPayload) throw new Error('Processed book file is stale; run npm run prepare:data')
  console.log(`Verified ${openings.length} committed openings and ${book.size} book positions`)
} else {
  mkdirSync(resolve('public/data'), { recursive: true })
  writeFileSync(output, payload)
  writeFileSync(bookOutput, bookPayload)
  console.log(`Wrote ${openings.length} openings to ${output} and ${book.size} positions to ${bookOutput}`)
}
