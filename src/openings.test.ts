import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'
import { OpeningBook, positionKey } from './openings'
import commonBookData from '../public/data/common-book.json'

describe('optional opening selection', () => {
  it('ships a common book with mainstream first moves and no unusual first moves', () => {
    const book = new OpeningBook(commonBookData.positions as [string, string[], number][])
    expect(book.moves(new Chess())).toEqual(['c2c4', 'd2d4', 'e2e4', 'g1f3'])
    const afterE4 = new Chess()
    afterE4.move('e4')
    expect(book.moves(afterE4)).toContain('e7e5')
    expect(book.moves(afterE4)).not.toContain('b7b5')
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
