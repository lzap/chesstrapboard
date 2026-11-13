import { describe, expect, it } from 'vitest'
import { parseInfo, scoreForWhite } from './engine'

describe('UCI evaluation parsing', () => {
  it('keeps candidate rank, score, depth, and variation', () => {
    expect(parseInfo('info depth 12 seldepth 17 multipv 2 score cp -85 nodes 10000 pv e2e4 e7e5')).toEqual({
      depth: 12,
      rank: 2,
      score: { kind: 'cp', value: -85 },
      moves: ['e2e4', 'e7e5'],
    })
    expect(parseInfo('info depth 8 score mate 3 nodes 100 pv g6g7')).toMatchObject({ score: { kind: 'mate', value: 3 } })
  })

  it('ignores unstable score bounds and normalizes to White', () => {
    expect(parseInfo('info depth 8 score cp 100 lowerbound pv e2e4')).toBeNull()
    expect(scoreForWhite({ kind: 'cp', value: 80 }, 'b')).toEqual({ kind: 'cp', value: -80 })
    expect(scoreForWhite({ kind: 'mate', value: -2 }, 'b')).toEqual({ kind: 'mate', value: 2 })
  })
})
