import { describe, expect, it } from 'vitest'
import { parseLinkSettings, resolveLinkOpening, shareSearch } from './share'
import type { Opening } from './openings'

const options: Opening[] = [
  { id: 1, eco: 'C57', name: 'Italian Game: Two Knights Defense, Traxler Counterattack', moves: ['e2e4'], position: '' },
  { id: 2, eco: 'C57', name: 'Italian Game: Two Knights Defense', moves: ['e2e4'], position: '' },
  { id: 3, eco: 'C57', name: 'Italian Game: Two Knights Defense, Fried Liver Attack', moves: ['e2e4'], position: '' },
]

describe('shareable training links', () => {
  it('parses an exact opening, side, and key training settings', () => {
    expect(parseLinkSettings('?opening=c57&name=Italian+Game%3A+Two+Knights+Defense%2C+Fried+Liver+Attack&side=black&difficulty=beginner&frequency=often&size=mild&evaluation=on')).toEqual({
      requested: true,
      openingCode: 'C57',
      openingName: 'Italian Game: Two Knights Defense, Fried Liver Attack',
      side: 'b', difficulty: 'beginner', frequency: 'often', size: 'mild', evaluation: true,
    })
    expect(resolveLinkOpening(options, 'C57', 'Italian Game: Two Knights Defense, Fried Liver Attack')).toBe(options[2])
    expect(resolveLinkOpening(options, 'C57', null)).toBe(options[1])
  })

  it('ignores unsupported settings and never selects a different named line', () => {
    expect(parseLinkSettings('?side=blue&difficulty=expert&frequency=100&size=huge&evaluation=maybe')).toMatchObject({
      requested: false, side: null, difficulty: null, frequency: null, size: null, evaluation: null,
    })
    expect(resolveLinkOpening(options, 'C57', 'Missing line')).toBeNull()
    expect(resolveLinkOpening(options, 'X57', null)).toBeNull()
  })

  it('writes a complete reproducible link while retaining unrelated parameters', () => {
    const query = shareSearch('?utm_source=readme&opening=A00', {
      opening: options[2], side: 'w', difficulty: 'intermediate', frequency: 'almostAlways', size: 'large', evaluation: false,
    })
    const parsed = parseLinkSettings(`?${query}`)
    expect(parsed).toMatchObject({ openingCode: 'C57', openingName: options[2].name, side: 'w', difficulty: 'intermediate', frequency: 'almostAlways', size: 'large', evaluation: false })
    expect(new URLSearchParams(query).get('utm_source')).toBe('readme')
  })
})
