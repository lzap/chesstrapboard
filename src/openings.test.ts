import { describe, expect, it } from 'vitest'
import { pickOpening, type Opening } from './openings'

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
})
