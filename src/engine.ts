export type EngineScore = { kind: 'cp' | 'mate'; value: number }

export interface EngineLine {
  depth: number
  rank: number
  score: EngineScore
  moves: string[]
}

export interface SearchResult {
  bestMove: string | null
  lines: EngineLine[]
  rootTurn: 'w' | 'b'
}

export function parseInfo(line: string): EngineLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ') || line.includes(' lowerbound') || line.includes(' upperbound')) return null
  const depth = /\bdepth (\d+)/.exec(line)
  const rank = /\bmultipv (\d+)/.exec(line)
  const score = /\bscore (cp|mate) (-?\d+)/.exec(line)
  const pv = /\bpv (.+)$/.exec(line)
  if (!depth || !score || !pv) return null
  return {
    depth: Number(depth[1]),
    rank: rank ? Number(rank[1]) : 1,
    score: { kind: score[1] as EngineScore['kind'], value: Number(score[2]) },
    moves: pv[1].trim().split(/\s+/),
  }
}

export function scoreForWhite(score: EngineScore, rootTurn: 'w' | 'b'): EngineScore {
  return { ...score, value: rootTurn === 'w' ? score.value : -score.value }
}

interface PendingSearch {
  rootTurn: 'w' | 'b'
  lines: Map<number, EngineLine>
  resolve: (result: SearchResult) => void
  reject: (error: Error) => void
  timer: number
}

export class EngineClient {
  private worker: Worker | null = null
  private ready: Promise<void> | null = null
  private readyResolve: (() => void) | null = null
  private readyReject: ((error: Error) => void) | null = null
  private pending: PendingSearch | null = null
  private queue: Promise<void> = Promise.resolve()

  async search(fen: string, milliseconds: number, multiPv = 1): Promise<SearchResult> {
    const task = this.queue.then(() => this.runSearch(fen, milliseconds, multiPv))
    this.queue = task.then(() => undefined, () => undefined)
    return task
  }

  stop(): void {
    this.worker?.postMessage('stop')
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    this.ready = null
    this.readyReject?.(new Error('Engine stopped'))
    this.readyReject = null
    this.readyResolve = null
    if (this.pending) {
      window.clearTimeout(this.pending.timer)
      this.pending.reject(new Error('Engine stopped'))
      this.pending = null
    }
  }

  private init(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
      const url = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`
      try {
        this.worker = new Worker(url)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Engine Worker could not start'))
        return
      }
      const timer = window.setTimeout(() => {
        this.worker?.terminate()
        this.worker = null
        this.ready = null
        reject(new Error('Engine startup timed out'))
      }, 20000)
      this.worker.onmessage = (event: MessageEvent<string>) => {
        for (const line of String(event.data).split(/\r?\n/)) {
          if (line === 'uciok') this.worker?.postMessage('isready')
          if (line === 'readyok') {
            window.clearTimeout(timer)
            this.readyResolve?.()
            this.readyResolve = null
            this.readyReject = null
          }
          this.handleSearchLine(line)
        }
      }
      this.worker.onerror = () => {
        const failure = new Error('Engine Worker failed to load')
        window.clearTimeout(timer)
        this.readyReject?.(failure)
        if (this.pending) {
          window.clearTimeout(this.pending.timer)
          this.pending.reject(failure)
        }
        this.readyReject = null
        this.pending = null
        this.worker?.terminate()
        this.worker = null
        this.ready = null
      }
      this.worker.postMessage('uci')
    })
    return this.ready
  }

  private async runSearch(fen: string, milliseconds: number, multiPv: number): Promise<SearchResult> {
    await this.init()
    const rootTurn = fen.split(' ')[1] === 'b' ? 'b' : 'w'
    return new Promise<SearchResult>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.worker?.terminate()
        this.worker = null
        this.ready = null
        this.pending = null
        reject(new Error('Engine search timed out'))
      }, Math.max(5000, milliseconds + 5000))
      this.pending = { rootTurn, lines: new Map(), resolve, reject, timer }
      this.worker?.postMessage(`setoption name MultiPV value ${Math.max(1, Math.min(8, multiPv))}`)
      this.worker?.postMessage(`position fen ${fen}`)
      this.worker?.postMessage(`go movetime ${Math.max(50, Math.min(20000, Math.round(milliseconds)))}`)
    })
  }

  private handleSearchLine(line: string): void {
    const pending = this.pending
    if (!pending) return
    const info = parseInfo(line)
    if (info && (!pending.lines.has(info.rank) || pending.lines.get(info.rank)!.depth <= info.depth)) {
      pending.lines.set(info.rank, info)
    }
    const bestMove = /^bestmove (\S+)/.exec(line)
    if (!bestMove) return
    window.clearTimeout(pending.timer)
    this.pending = null
    pending.resolve({
      bestMove: bestMove[1] === '(none)' ? null : bestMove[1],
      lines: [...pending.lines.values()].sort((a, b) => a.rank - b.rank),
      rootTurn: pending.rootTurn,
    })
  }
}
