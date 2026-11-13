import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { OpeningBook, pickOpening, positionKey, type Opening } from './openings'

const options: Opening[] = [
  { id: 0, eco: 'C50', name: 'Italian Game', moves: ['e2e4', 'e7e5'], position: '' },
  { id: 1, eco: 'B20', name: 'Sicilian Defense', moves: ['e2e4', 'c7c5'], position: '' },
  { id: 2, eco: 'D06', name: "Queen's Gambit", moves: ['d2d4', 'd7d5'], position: '' },
]

describe('optional opening selection', () => {
  it('chooses among lines compatible with the player’s first move', () => {
    expect(pickOpening(options, { from: 'e2', to: 'e4' }, () => 0)?.name).toBe('Italian Game')
    expect(pickOpening(options, { from: 'e2', to: 'e4' }, () => 0.99)?.name).toBe('Sicilian Defense')
  })

  it('chooses from all options before a move or when none match', () => {
    expect(pickOpening(options, undefined, () => 0.99)?.name).toBe("Queen's Gambit")
    expect(pickOpening(options, { from: 'g1', to: 'h3' }, () => 0.99)?.name).toBe("Queen's Gambit")
    expect(pickOpening([])).toBeNull()
  })

  it('finds a legal database continuation after a move-order transposition', () => {
    const source = new Chess()
    for (const move of ['d4', 'Nf6', 'c4', 'e6']) source.move(move)
    const transposed = new Chess()
    for (const move of ['d4', 'e6', 'c4', 'Nf6']) transposed.move(move)
    expect(positionKey(transposed)).toBe(positionKey(source))
    const book = new OpeningBook([[positionKey(source), ['e2e5', 'g1f3', 'g1f3'], 12]])
    expect(book.hasContinuation(transposed)).toBe(true)
    expect(book.longestLinePly(transposed)).toBe(12)
    expect(book.moves(transposed)).toEqual(['g1f3'])
    expect(book.pickMove(transposed)).toBe('g1f3')
  })

  it('prefers book moves that keep a line going while retaining variety', () => {
    const position = new Chess()
    position.move('d4')
    const afterD5 = new Chess(position.fen())
    afterD5.move('d5')
    const afterNf6 = new Chess(position.fen())
    afterNf6.move('Nf6')
    const book = new OpeningBook([
      [positionKey(position), ['b8a6', 'd7d5', 'g8f6'], 8],
      [positionKey(afterD5), ['c2c4'], 8],
      [positionKey(afterNf6), ['c2c4'], 8],
    ])
    expect(book.pickMove(position, () => 0)).toBe('d7d5')
    expect(book.pickMove(position, () => 0.99)).toBe('g8f6')
    expect(book.moves(position)).toEqual(['b8a6', 'd7d5', 'g8f6'])
  })
})
