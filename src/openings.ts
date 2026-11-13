import { Chess } from 'chess.js'
import type { MoveInput } from './chess'

export interface Opening {
  id: number
  eco: string
  name: string
  moves: string[]
  position: string
}

interface OpeningFile {
  version: number
  source: string
  commit: string
  openings: [string, string, string[], string][]
}

interface BookFile {
  version: number
  source: string
  commit: string
  positions: [string, string[], number][]
}

const featuredNames = ['Italian Game', 'Ruy Lopez', 'Sicilian Defense', "Queen's Gambit", 'French Defense', 'Caro-Kann Defense']

export async function loadOpenings(): Promise<Opening[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/openings.json`)
  if (!response.ok) throw new Error(`Opening file could not be loaded (${response.status})`)
  const file = await response.json() as OpeningFile
  if (file.version !== 1 || !Array.isArray(file.openings)) throw new Error('Opening file has an unsupported format')
  return file.openings.map(([eco, name, moves, position], id) => ({ id, eco, name, moves, position }))
}

export async function loadOpeningBook(): Promise<OpeningBook> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/book.json`)
  if (!response.ok) throw new Error(`Opening book could not be loaded (${response.status})`)
  const file = await response.json() as BookFile
  if (file.version !== 1 || !Array.isArray(file.positions)) throw new Error('Opening book has an unsupported format')
  return new OpeningBook(file.positions)
}

export class OpeningBook {
  private readonly positions: Map<string, { choices: string[]; maxPly: number }>

  constructor(positions: [string, string[], number][]) {
    this.positions = new Map(positions.map(([position, choices, maxPly]) => [position, { choices, maxPly }]))
  }

  hasContinuation(chess: Chess): boolean {
    return this.positions.has(positionKey(chess))
  }

  longestLinePly(chess: Chess): number {
    return this.positions.get(positionKey(chess))?.maxPly ?? 0
  }

  moves(chess: Chess): string[] {
    const entry = this.positions.get(positionKey(chess))
    if (!entry) return []
    const legal = new Set(chess.moves({ verbose: true }).map(toUci))
    return [...new Set(entry.choices)].filter((move) => legal.has(move))
  }

  pickMove(chess: Chess, random = Math.random): string | null {
    const candidates = this.moves(chess)
    const continuing = candidates.filter((move) => {
      const after = new Chess(chess.fen())
      after.move(fromUci(move))
      return after.isGameOver() || this.hasContinuation(after)
    })
    const choices = continuing.length ? continuing : candidates
    return choices[Math.floor(random() * choices.length)] ?? null
  }
}

export function searchOpenings(openings: Opening[], query: string, limit = 12): Opening[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) {
    return featuredNames.map((name) => openings.find((opening) => opening.name === name)).filter((opening): opening is Opening => Boolean(opening)).slice(0, limit)
  }
  const words = needle.split(/\s+/)
  return openings.filter((opening) => {
    const haystack = `${opening.eco} ${opening.name}`.toLocaleLowerCase()
    return words.every((word) => haystack.includes(word))
  }).slice(0, limit)
}

export function fromUci(uci: string): MoveInput {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error(`Invalid UCI move: ${uci}`)
  return { from: uci.slice(0, 2) as MoveInput['from'], to: uci.slice(2, 4) as MoveInput['to'], promotion: uci[4] as MoveInput['promotion'] }
}

export function toUci(move: { from: string; to: string; promotion?: string }): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

export function pickOpening(openings: Opening[], firstMove?: MoveInput, random = Math.random): Opening | null {
  const matching = firstMove ? openings.filter((opening) => opening.moves[0] === toUci(firstMove)) : openings
  const pool = matching.length ? matching : openings
  return pool[Math.floor(random() * pool.length)] ?? null
}

export function openingSan(opening: Opening): string[] {
  const chess = new Chess()
  return opening.moves.map((uci) => chess.move(fromUci(uci)).san)
}

export function positionKey(chess: Chess): string {
  return chess.fen().split(' ').slice(0, 4).join(' ')
}

export function classifyGame(chess: Chess, openings: Opening[]): Opening | null {
  const byPosition = new Map(openings.map((opening) => [opening.position, opening]))
  for (const move of chess.history({ verbose: true }).reverse()) {
    const opening = byPosition.get(move.after.split(' ').slice(0, 4).join(' '))
    if (opening) return opening
  }
  return null
}
