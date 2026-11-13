import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { TrainingSession } from './session'
import { classifyGame, fromUci, OpeningBook, openingSan, positionKey, type Opening } from './openings'

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
})
