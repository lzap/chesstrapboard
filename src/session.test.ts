import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { TrainingSession } from './session'
import { exportPgn } from './chess'
import { classifyGame, fromUci, OpeningBook, openingPosition, openingSan, positionKey, type Opening } from './openings'
import { canSeekOpportunity } from './traps'

const italian: Opening = {
  id: 1,
  eco: 'C50',
  name: 'Italian Game',
  moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'],
  position: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -',
}

const emptyBook = new OpeningBook([])

function bookFromLines(lines: string[][]): OpeningBook {
  const positions = new Map<string, { choices: Set<string>; maxPly: number }>()
  for (const line of lines) {
    const chess = new Chess()
    for (const move of line) {
      const key = positionKey(chess)
      if (!positions.has(key)) positions.set(key, { choices: new Set(), maxPly: 0 })
      positions.get(key)!.choices.add(move)
      positions.get(key)!.maxPly = Math.max(positions.get(key)!.maxPly, line.length)
      chess.move(fromUci(move))
    }
  }
  return new OpeningBook([...positions].map(([position, entry]) => [position, [...entry.choices], entry.maxPly]))
}

describe('opening-guided full game', () => {
  it('starts at the selected opening position with a fresh move history and PGN setup', () => {
    const session = new TrainingSession(italian, 'b', emptyBook, true)
    expect(positionKey(openingPosition(italian))).toBe(italian.position)
    expect(session.chess.fen()).toBe(session.initialFen)
    expect(session.chess.history()).toEqual([])
    expect(session.startingPly).toBe(5)
    expect(session.absolutePly).toBe(5)
    expect(session.openingReached).toBe(true)
    expect(session.bookActive).toBe(false)
    expect(session.isPlayerTurn).toBe(true)
    expect(canSeekOpportunity(session.absolutePly, session.availableOpeningLength, 0)).toBe(true)
    expect(session.playPlayer({ from: 'g8', to: 'f6' })?.san).toBe('Nf6')
    const pgn = exportPgn(session.chess, 'CPU', 'Player', { name: italian.name, eco: italian.eco })
    expect(pgn).toContain('[SetUp "1"]')
    expect(pgn).toContain(`[FEN "${session.initialFen}"]`)
    expect(pgn).toContain('3. ... Nf6 *')
    expect(session.takeBack()).toBe(true)
    expect(session.chess.fen()).toBe(session.initialFen)
    expect(session.chess.history()).toEqual([])
    expect(session.openingReached).toBe(true)
    expect(session.bookActive).toBe(false)
  })

  it('lets the CPU move first from an opening position when needed', () => {
    const book = bookFromLines([[...italian.moves, 'g8f6']])
    const session = new TrainingSession(italian, 'w', book, true)
    expect(session.chess.history()).toEqual([])
    expect(session.isCpuTurn).toBe(true)
    expect(session.advanceBook()?.san).toBe('Nf6')
    expect(session.chess.history()).toEqual(['Nf6'])
    expect(session.absolutePly).toBe(6)
    expect(session.isPlayerTurn).toBe(true)
  })

  it('offers every legal database move and the selected line in current or historical positions', () => {
    const book = bookFromLines([italian.moves, ['d2d4', 'd7d5']])
    const session = new TrainingSession(italian, 'w', book)
    expect(session.bookMovesAt(session.chess)).toEqual(['e2e4', 'd2d4'])
    session.playPlayer({ from: 'd2', to: 'd4' })
    expect(session.bookActive).toBe(false)
    expect(session.bookMovesAt(session.chess)).toEqual(['d7d5'])
    expect(session.bookMovesAt(new Chess())).toEqual(['e2e4', 'd2d4'])
    expect(new TrainingSession(italian, 'w', emptyBook).bookMovesAt(new Chess())).toEqual(['e2e4'])
  })

  it('follows the selected line and continues after the named position', () => {
    const session = new TrainingSession(italian, 'w', emptyBook)
    expect(session.playPlayer({ from: 'e2', to: 'e4' })?.san).toBe('e4')
    expect(session.advanceBook()?.san).toBe('e5')
    expect(session.playPlayer({ from: 'g1', to: 'f3' })?.san).toBe('Nf3')
    expect(session.advanceBook()?.san).toBe('Nc6')
    expect(session.playPlayer({ from: 'f1', to: 'c4' })?.san).toBe('Bc4')
    expect(session.openingReached).toBe(true)
    expect(session.completed).toBe(false)
    expect(session.advanceBook()).toBeNull()
    expect(session.playCpu({ from: 'g8', to: 'f6' })?.san).toBe('Nf6')
    expect(session.bookActive).toBe(false)
    expect(openingSan(italian)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
    expect(classifyGame(session.chess, [italian])?.name).toBe('Italian Game')
    expect(session.takeBack()).toBe(true)
    expect(session.openingReached).toBe(false)
    expect(session.bookActive).toBe(true)
  })

  it('opens the book for a Black-side player without ending the game at the line', () => {
    const session = new TrainingSession(italian, 'b', emptyBook)
    expect(session.chess.history()).toEqual(['e4'])
    session.playPlayer({ from: 'e7', to: 'e5' })
    expect(session.advanceBook()?.san).toBe('Nf3')
    session.playPlayer({ from: 'b8', to: 'c6' })
    expect(session.advanceBook()?.san).toBe('Bc4')
    expect(session.openingReached).toBe(true)
    expect(session.completed).toBe(false)
  })

  it('allows deviation and keeps playing legally', () => {
    const session = new TrainingSession(italian, 'w', emptyBook)
    expect(session.playPlayer({ from: 'd2', to: 'd4' })?.san).toBe('d4')
    expect(session.bookActive).toBe(false)
    expect(session.advanceBook()).toBeNull()
    expect(session.playCpu({ from: 'd7', to: 'd5' })?.san).toBe('d5')
    session.finish('stopped')
    expect(session.completed).toBe(true)
    expect(session.playPlayer({ from: 'c2', to: 'c4' })).toBeNull()
  })

  it('continues another opening after the selected line is left', () => {
    const book = bookFromLines([['d2d4', 'b8a6'], ['d2d4', 'd7d5', 'c2c4']])
    const session = new TrainingSession(italian, 'w', book)
    expect(session.playPlayer({ from: 'd2', to: 'd4' })?.san).toBe('d4')
    expect(session.bookActive).toBe(false)
    expect(session.hasBookContinuation).toBe(true)
    expect(session.advanceBook()?.san).toBe('d5')
    expect(session.hasBookContinuation).toBe(true)
    expect(session.playPlayer({ from: 'c2', to: 'c4' })?.san).toBe('c4')
    expect(session.advanceBook()).toBeNull()
  })

  it('continues a C33 database line after the selected opening name ends', () => {
    const base: Opening = { id: 3, eco: 'C33', name: "King's Gambit Accepted", moves: ['e2e4', 'e7e5', 'f2f4', 'e5f4'], position: '' }
    const longer = [...base.moves, 'f1c4', 'g7g5']
    const session = new TrainingSession(base, 'w', bookFromLines([base.moves, longer]))
    expect(session.playPlayer({ from: 'e2', to: 'e4' })?.san).toBe('e4')
    expect(session.advanceBook()?.san).toBe('e5')
    expect(session.playPlayer({ from: 'f2', to: 'f4' })?.san).toBe('f4')
    expect(session.advanceBook()?.san).toBe('exf4')
    expect(session.openingReached).toBe(true)
    expect(session.playPlayer({ from: 'f1', to: 'c4' })?.san).toBe('Bc4')
    expect(session.bookActive).toBe(false)
    expect(session.hasBookContinuation).toBe(true)
    expect(session.availableOpeningLength).toBe(longer.length)
    expect(session.advanceBook()?.san).toBe('g5')
    expect(session.hasBookContinuation).toBe(false)
  })

  it('takes back the latest White turn and removes undone opportunity records', () => {
    const session = new TrainingSession(italian, 'w', emptyBook)
    session.playPlayer({ from: 'e2', to: 'e4' })
    session.advanceBook()
    session.playPlayer({ from: 'g1', to: 'f3' })
    session.recordOpportunityCheck(3)
    session.playCpu({ from: 'b8', to: 'c6' })
    session.opportunities.push({ fen: '', ply: 3, cpuMove: 'b8c6', suggestedReply: 'f1c4', estimatedLossCp: 50 })
    session.finish('stopped')
    expect(session.takeBack()).toBe(true)
    expect(session.chess.history()).toEqual(['e4', 'e5'])
    expect(session.isPlayerTurn).toBe(true)
    expect(session.bookActive).toBe(true)
    expect(session.completed).toBe(false)
    expect(session.finishReason).toBeNull()
    expect(session.opportunityChecks).toBe(0)
    expect(session.opportunities).toEqual([])
  })

  it('takes back a Black move with or without a CPU response', () => {
    const session = new TrainingSession(italian, 'b', emptyBook)
    expect(session.canTakeBack).toBe(false)
    expect(session.takeBack()).toBe(false)
    session.playPlayer({ from: 'e7', to: 'e5' })
    expect(session.takeBack()).toBe(true)
    expect(session.chess.history()).toEqual(['e4'])
    session.playPlayer({ from: 'e7', to: 'e5' })
    session.advanceBook()
    expect(session.chess.history()).toEqual(['e4', 'e5', 'Nf3'])
    expect(session.takeBack()).toBe(true)
    expect(session.chess.history()).toEqual(['e4'])
    expect(session.isPlayerTurn).toBe(true)
  })
})
