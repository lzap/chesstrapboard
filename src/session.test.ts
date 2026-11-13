import { describe, expect, it } from 'vitest'
import { TrainingSession } from './session'
import { classifyGame, openingSan, type Opening } from './openings'

const italian: Opening = {
  id: 1,
  eco: 'C50',
  name: 'Italian Game',
  moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'],
  position: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -',
}

describe('opening practice', () => {
  it('corrects a legal deviation immediately without advancing the line', () => {
    const session = new TrainingSession(italian, 'memorize', 'w')
    expect(session.playPlayer({ from: 'd2', to: 'd4' })).toBeNull()
    expect(session.chess.history()).toEqual([])
    expect(session.feedback).toContain('Try e4')
    expect(session.playPlayer({ from: 'e2', to: 'e4' })?.san).toBe('e4')
    expect(session.chess.history()).toEqual(['e4', 'e5'])
  })

  it('starts the book for a Black-side learner and ends at the line', () => {
    const session = new TrainingSession(italian, 'memorize', 'b')
    expect(session.chess.history()).toEqual(['e4'])
    session.playPlayer({ from: 'e7', to: 'e5' })
    session.playPlayer({ from: 'b8', to: 'c6' })
    expect(session.completed).toBe(true)
    expect(session.openingReached).toBe(true)
    expect(session.chess.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
  })

  it('allows deviation in trap mode while preserving game legality', () => {
    const session = new TrainingSession(italian, 'traps', 'w')
    expect(session.playPlayer({ from: 'd2', to: 'd4' })?.san).toBe('d4')
    expect(session.bookActive).toBe(false)
    expect(session.advanceBook()).toBeNull()
    expect(session.playCpu({ from: 'd7', to: 'd5' })?.san).toBe('d5')
    session.finish('stopped')
    expect(session.completed).toBe(true)
    expect(session.playPlayer({ from: 'c2', to: 'c4' })).toBeNull()
  })

  it('derives SAN preview and classifies a named position', () => {
    const session = new TrainingSession(italian, 'memorize', 'w')
    session.playPlayer({ from: 'e2', to: 'e4' })
    session.playPlayer({ from: 'g1', to: 'f3' })
    session.playPlayer({ from: 'f1', to: 'c4' })
    expect(openingSan(italian)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])
    expect(classifyGame(session.chess, [italian])?.name).toBe('Italian Game')
  })
})
