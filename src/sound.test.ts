import { Chess } from 'chess.js'
import { describe, expect, it, vi } from 'vitest'
import { GameSounds } from './sound'

describe('move sounds', () => {
  it('replaces the move tap with one chime for checkmate or stalemate', () => {
    const sounds = new GameSounds()
    const move = vi.spyOn(sounds, 'playMove').mockImplementation(() => undefined)
    const chime = vi.spyOn(sounds, 'playOpportunity').mockImplementation(() => undefined)
    const ordinary = new Chess()
    ordinary.move('e4')
    sounds.playAfterMove(ordinary)
    expect(move).toHaveBeenCalledTimes(1)
    expect(chime).not.toHaveBeenCalled()

    sounds.playAfterMove(ordinary, true)
    expect(move).toHaveBeenCalledTimes(2)
    expect(chime).toHaveBeenCalledWith(0.17)

    const checkmate = new Chess()
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) checkmate.move(san)
    expect(checkmate.isCheckmate()).toBe(true)
    sounds.playAfterMove(checkmate, true)
    expect(move).toHaveBeenCalledTimes(2)
    expect(chime).toHaveBeenCalledTimes(2)
    expect(chime).toHaveBeenLastCalledWith()

    const stalemate = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(stalemate.isStalemate()).toBe(true)
    sounds.playAfterMove(stalemate)
    expect(move).toHaveBeenCalledTimes(2)
    expect(chime).toHaveBeenCalledTimes(3)
    expect(chime).toHaveBeenLastCalledWith()
  })
})
