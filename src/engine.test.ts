import { afterEach, describe, expect, it, vi } from 'vitest'
import { Chess } from 'chess.js'
import { EngineClient, parseInfo, scoreForWhite } from './engine'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

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

  it('clears a cancelled startup timeout before starting another worker', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', globalThis)
    class FakeWorker {
      static instances: FakeWorker[] = []
      onmessage: ((event: MessageEvent<string>) => void) | null = null
      onerror: (() => void) | null = null
      terminated = false

      constructor() { FakeWorker.instances.push(this) }
      postMessage(command: string): void {
        if (command.startsWith('go movetime')) queueMicrotask(() => this.onmessage?.({ data: 'bestmove e2e4' } as MessageEvent<string>))
      }
      terminate(): void { this.terminated = true }
    }
    vi.stubGlobal('Worker', FakeWorker)

    const client = new EngineClient()
    const cancelled = client.search(new Chess().fen(), 500)
    await Promise.resolve()
    expect(FakeWorker.instances).toHaveLength(1)
    client.terminate()
    await expect(cancelled).rejects.toThrow('Engine stopped')

    const next = client.search(new Chess().fen(), 500)
    await Promise.resolve()
    await Promise.resolve()
    expect(FakeWorker.instances).toHaveLength(2)
    FakeWorker.instances[1].onmessage?.({ data: 'readyok' } as MessageEvent<string>)
    await expect(next).resolves.toMatchObject({ bestMove: 'e2e4' })
    vi.advanceTimersByTime(20000)
    expect(FakeWorker.instances[1].terminated).toBe(false)
  })
})
