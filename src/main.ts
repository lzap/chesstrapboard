import { Chess, type Color, type Square } from 'chess.js'
import { BoardView } from './board'
import { exportPgn, gameStatus, tryMove, type MoveInput } from './chess'
import { EngineClient, scoreForWhite, type EngineScore } from './engine'
import { classifyGame, fromUci, loadOpeningBook, loadOpenings, OpeningBook, openingPosition, openingSan, pickOpening, searchOpenings, type Opening } from './openings'
import { analyzeGame, formatScore, moveAnnotation, whiteShare, type GameReview } from './review'
import { TrainingSession } from './session'
import { GameSounds } from './sound'
import { canSeekOpportunity, confirmCandidateMistake, findCandidateMistake, selectEngineMove, shouldAttemptMistake, type MistakeFrequency, type MistakeSize } from './traps'
import './style.css'

const element = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!
const previewChess = new Chess()
const preferencesKey = 'chess-trap-board-preferences-v1'
let openings: Opening[] = []
let openingBook = new OpeningBook([])
let selectedOpening: Opening | null = null
let session: TrainingSession | null = null
let playerColor: Color = 'w'
let orientation: Color = 'w'
let loadError = ''
let thinking = false
let engineError = false
let generation = 0
let review: GameReview | null = null
let reviewing = false
let reviewDone = 0
let reviewTotal = 0
let reviewError = ''
let viewPly: number | null = null
let liveEvaluation: { fen: string; score: EngineScore | null } | null = null
let evaluating = false
let evaluationError = ''
let evaluationToken = 0
let hintMove: MoveInput | null = null
let hintSearching = false
let hintToken = 0
let bookHints: { fen: string; moves: string[]; index: number } | null = null
let linePreview: { session: TrainingSession; ply: number; positions: Chess[]; step: number } | null = null
let linePreviewTimer: number | null = null
const evaluationCache = new Map<string, EngineScore | null>()
const engine = new EngineClient()
const evaluationEngine = new EngineClient()
const sounds = new GameSounds()

function savePreferences(): void {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify({
      playerColor,
      opening: selectedOpening ? [selectedOpening.eco, selectedOpening.name] : null,
      evaluation: element<HTMLInputElement>('#evaluation-toggle').checked,
      difficulty: element<HTMLSelectElement>('#difficulty').value,
      frequency: element<HTMLSelectElement>('#mistake-frequency').value,
      size: element<HTMLSelectElement>('#mistake-size').value,
      sound: element<HTMLInputElement>('#sound-toggle').checked,
      opportunityCue: element<HTMLInputElement>('#opportunity-cue-toggle').checked,
      volume: element<HTMLInputElement>('#sound-volume').value,
    }))
  } catch { /* Preferences remain usable for this session. */ }
}

function restorePreferences(): [string, string] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey) ?? '{}') as Record<string, unknown>
    if (saved.playerColor === 'b') playerColor = 'b'
    orientation = playerColor
    element<HTMLInputElement>(`input[name="side"][value="${playerColor}"]`).checked = true
    element<HTMLInputElement>('#evaluation-toggle').checked = saved.evaluation === true
    element<HTMLInputElement>('#sound-toggle').checked = saved.sound !== false
    const savedCue = typeof saved.opportunityCue === 'boolean' ? saved.opportunityCue : saved.opportunitySound
    element<HTMLInputElement>('#opportunity-cue-toggle').checked = savedCue !== false
    if (typeof saved.volume === 'string' && /^\d{1,3}$/.test(saved.volume)) element<HTMLInputElement>('#sound-volume').value = saved.volume
    sounds.moveEnabled = element<HTMLInputElement>('#sound-toggle').checked
    sounds.opportunityEnabled = element<HTMLInputElement>('#opportunity-cue-toggle').checked
    sounds.volume = Number(element<HTMLInputElement>('#sound-volume').value) / 100
    const frequency = saved.frequency === 'always' ? 'almostAlways' : saved.frequency
    for (const [id, value] of [['#difficulty', saved.difficulty], ['#mistake-frequency', frequency], ['#mistake-size', saved.size]] as const) {
      const select = element<HTMLSelectElement>(id)
      if (typeof value === 'string' && [...select.options].some((option) => option.value === value)) select.value = value
    }
    if (Array.isArray(saved.opening) && saved.opening.length === 2 && saved.opening.every((value) => typeof value === 'string')) return saved.opening as [string, string]
  } catch { /* Use defaults when storage is unavailable or invalid. */ }
  return null
}

function positionPly(): number {
  const total = session?.chess.history().length ?? 0
  return Math.max(0, Math.min(viewPly ?? total, total))
}

function positionAt(ply: number): Chess {
  const current = session?.chess ?? previewChess
  if (!session || ply === current.history().length) return current
  const position = new Chess(session.initialFen)
  for (const move of current.history({ verbose: true }).slice(0, ply)) {
    position.move({ from: move.from, to: move.to, promotion: move.promotion })
  }
  return position
}

function cancelEvaluation(clearScore = true): void {
  evaluationToken += 1
  evaluationEngine.terminate()
  if (clearScore) liveEvaluation = null
  evaluating = false
  evaluationError = ''
}

function clearHint(): void {
  hintToken += 1
  if (hintSearching) engine.stop()
  hintMove = null
  hintSearching = false
  bookHints = null
}

function shuffledMoves(moves: string[]): string[] {
  const shuffled = [...moves]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    const value = shuffled[index]
    shuffled[index] = shuffled[other]
    shuffled[other] = value
  }
  return shuffled
}

async function evaluateVisiblePosition(): Promise<void> {
  const current = session
  if (!current || !element<HTMLInputElement>('#evaluation-toggle').checked || review) return
  const fen = positionAt(positionPly()).fen()
  if (evaluationCache.has(fen)) {
    evaluationToken += 1
    evaluationEngine.terminate()
    liveEvaluation = { fen, score: evaluationCache.get(fen) ?? null }
    evaluating = false
    evaluationError = ''
    renderReview()
    return
  }
  const token = ++evaluationToken
  evaluationEngine.terminate()
  evaluating = true
  evaluationError = ''
  renderReview()
  try {
    const result = await evaluationEngine.search(fen, 350)
    if (token !== evaluationToken || current !== session || review || !element<HTMLInputElement>('#evaluation-toggle').checked) return
    const best = result.lines.find((line) => line.rank === 1)
    const score = best ? scoreForWhite(best.score, result.rootTurn) : null
    evaluationCache.set(fen, score)
    liveEvaluation = { fen, score }
    evaluating = false
    renderReview()
  } catch (error) {
    if (token !== evaluationToken || current !== session) return
    evaluating = false
    liveEvaluation = null
    evaluationError = error instanceof Error ? error.message : 'Evaluation unavailable'
    renderReview()
  }
}

function navigateTo(ply: number): void {
  if (!session) return
  const total = session.chess.history().length
  const next = Math.max(0, Math.min(ply, total))
  if (next === positionPly()) return
  clearHint()
  clearLinePreview()
  const focusMove = element<HTMLDivElement>('#move-list').contains(document.activeElement)
  viewPly = next === total ? null : next
  render()
  if (focusMove) element<HTMLButtonElement>(`#move-list button[data-ply="${next}"]`)?.focus()
  void evaluateVisiblePosition()
}

const board = new BoardView(element('#board-container'), (input) => {
  if (!session) {
    if (playerColor === 'w') startGame(input)
    return
  }
  const move = session.playPlayer(input)
  if (move) {
    clearHint()
    sounds.playAfterMove(session.chess)
  }
  render()
  if (move) void evaluateVisiblePosition()
  if (move) {
    if (session.completed) void runReview()
    else void runCpu()
  }
}, (square: Square) => {
  if (session || playerColor !== 'b' || !openings.length || previewChess.get(square)?.color !== 'b') return false
  startGame()
  queueMicrotask(() => element<HTMLButtonElement>(`#board-container [data-square="${square}"]`)?.click())
  return true
})

function renderBoard(visiblePosition = positionAt(positionPly()), viewingHistory = Boolean(session && positionPly() < session.chess.history().length)): void {
  const preview = linePreview?.session === session && linePreview.ply === positionPly() ? linePreview.positions[linePreview.step] : null
  board.update(preview ?? visiblePosition, orientation, session?.playerColor ?? playerColor,
    !preview && (session ? session.isPlayerTurn && !thinking && !viewingHistory : playerColor === 'w' && openings.length > 0),
    preview ? null : hintMove)
}

function clearLinePreview(): void {
  if (linePreviewTimer !== null) window.clearTimeout(linePreviewTimer)
  linePreviewTimer = null
  linePreview = null
}

function previewSuggestedLine(event: PointerEvent): void {
  if (!session || !review) return
  if (linePreviewTimer !== null) window.clearTimeout(linePreviewTimer)
  linePreviewTimer = null
  const ply = positionPly()
  const entry = review.entries[ply - 1]
  if (!entry?.bestMoves.length) return
  if (linePreview?.session !== session || linePreview.ply !== ply) {
    const start = positionAt(ply - 1).fen()
    const chess = new Chess(start)
    const played: string[] = []
    const positions: Chess[] = []
    for (const uci of entry.bestMoves) {
      try {
        chess.move(fromUci(uci))
        played.push(uci)
        const snapshot = new Chess(start)
        for (const move of played) snapshot.move(fromUci(move))
        positions.push(snapshot)
      } catch { break }
    }
    if (!positions.length) return
    linePreview = { session, ply, positions, step: -1 }
  }
  const detail = element<HTMLElement>('#review-detail')
  const bounds = detail.getBoundingClientRect()
  const text = document.createRange()
  text.selectNodeContents(detail)
  const sweepWidth = Math.max(1, Math.min(bounds.width, text.getBoundingClientRect().width))
  const fraction = Math.max(0, Math.min(0.999, (event.clientX - bounds.left) / sweepWidth))
  const step = Math.floor(fraction * linePreview.positions.length)
  if (step === linePreview.step) return
  linePreview.step = step
  renderBoard()
}

function restoreSuggestedLine(): void {
  if (linePreviewTimer !== null) window.clearTimeout(linePreviewTimer)
  linePreviewTimer = window.setTimeout(() => {
    linePreviewTimer = null
    if (!linePreview) return
    linePreview = null
    renderBoard()
  }, 180)
}

function invalidateGame(): void {
  clearHint()
  clearLinePreview()
  generation += 1
  engine.stop()
  cancelEvaluation()
  evaluationCache.clear()
  thinking = false
  engineError = false
  reviewing = false
  review = null
  reviewDone = 0
  reviewTotal = 0
  reviewError = ''
  viewPly = null
}

function difficultyBudget(): number {
  const difficulty = element<HTMLSelectElement>('#difficulty').value
  return difficulty === 'beginner' ? 180 : difficulty === 'strong' ? 1300 : 550
}

async function revealHint(): Promise<void> {
  const current = session
  if (!current || hintSearching || thinking || reviewing) return
  const position = positionAt(positionPly())
  const viewingHistory = positionPly() < current.chess.history().length
  if (position.isGameOver() || (!viewingHistory && !current.isPlayerTurn)) return
  const fen = position.fen()
  const bookMoves = current.bookMovesAt(position)
  if (bookMoves.length) {
    if (!bookHints || bookHints.fen !== fen) bookHints = { fen, moves: shuffledMoves(bookMoves), index: 0 }
    else bookHints.index = (bookHints.index + 1) % bookHints.moves.length
    hintMove = fromUci(bookHints.moves[bookHints.index])
    render()
    return
  }
  if (hintMove) {
    clearHint()
    render()
    return
  }
  const token = ++hintToken
  hintSearching = true
  render()
  try {
    const result = await engine.search(fen, Math.max(1200, difficultyBudget()))
    if (token !== hintToken || current !== session || positionAt(positionPly()).fen() !== fen) return
    const move = result.bestMove && tryMove(new Chess(fen), fromUci(result.bestMove))
    if (!move) throw new Error('No legal suggestion was returned')
    hintMove = { from: move.from, to: move.to }
    hintSearching = false
    render()
  } catch (error) {
    if (token !== hintToken || current !== session) return
    hintSearching = false
    console.warn('[Chess Trap Board] Hint unavailable:', error)
    render()
  }
}

async function runCpu(): Promise<void> {
  const current = session
  if (!current || !current.isCpuTurn) return
  const ply = current.chess.history().length
  const lastOpportunity = current.opportunities.at(-1)
  const frequency = element<HTMLSelectElement>('#mistake-frequency').value as MistakeFrequency
  const attempt = canSeekOpportunity(current.absolutePly, current.availableOpeningLength, current.opportunities.length,
    lastOpportunity ? current.startingPly + lastOpportunity.ply : undefined)
    && shouldAttemptMistake(frequency, Math.random())
  if (attempt) current.recordOpportunityCheck(ply)
  if (!attempt && current.advanceBook()) {
    sounds.playAfterMove(current.chess)
    render()
    void evaluateVisiblePosition()
    if (current.completed) void runReview()
    return
  }
  const token = generation
  thinking = true
  engineError = false
  render()
  try {
    const fen = current.chess.fen()
    let result
    let candidate = null
    if (attempt) {
      const shallow = await engine.search(fen, Math.max(180, Math.floor(difficultyBudget() / 2)), 5)
      if (token !== generation || current !== session) return
      result = await engine.search(fen, Math.max(950, difficultyBudget()), 6)
      const size = element<HTMLSelectElement>('#mistake-size').value as MistakeSize
      candidate = findCandidateMistake(fen, shallow, result, size)
      if (candidate) {
        const candidatePosition = new Chess(fen)
        candidatePosition.move(fromUci(candidate.move))
        const confirmation = await engine.search(candidatePosition.fen(), Math.max(800, difficultyBudget()))
        if (token !== generation || current !== session) return
        candidate = confirmCandidateMistake(fen, result, confirmation, candidate, size)
      }
    }
    if (token !== generation || current !== session) return
    if (!candidate && current.advanceBook()) {
      thinking = false
      sounds.playAfterMove(current.chess)
      render()
      void evaluateVisiblePosition()
      if (current.completed) void runReview()
      return
    }
    result ??= await engine.search(fen, difficultyBudget(), 2)
    if (token !== generation || current !== session) return
    thinking = false
    const chosenMove = candidate?.move ?? selectEngineMove(fen, result)
    if (!chosenMove || !current.playCpu(fromUci(chosenMove))) throw new Error('Engine did not return a legal move')
    if (candidate) {
      current.opportunities.push({ fen, ply, cpuMove: candidate.move, suggestedReply: candidate.reply, estimatedLossCp: candidate.lossCp })
    }
    sounds.playAfterMove(current.chess, Boolean(candidate))
    render()
    void evaluateVisiblePosition()
    if (current.completed) void runReview()
  } catch (error) {
    if (token !== generation || current !== session) return
    thinking = false
    if (current.advanceBook()) {
      sounds.playAfterMove(current.chess)
      render()
      void evaluateVisiblePosition()
      if (current.completed) void runReview()
      return
    }
    engineError = true
    engine.terminate()
    current.feedback = error instanceof Error ? error.message : 'Engine failed to move'
    render()
  }
}

async function runReview(): Promise<void> {
  const current = session
  if (!current || !current.completed) return
  const token = generation
  clearLinePreview()
  cancelEvaluation(false)
  reviewing = true
  review = null
  reviewError = ''
  reviewDone = 0
  reviewTotal = current.chess.history().length + 1
  render()
  try {
    const result = await analyzeGame(
      current.chess,
      (fen, milliseconds, multiPv) => engine.search(fen, milliseconds, multiPv),
      current.opportunities,
      (done, total) => {
        if (token !== generation || current !== session) return
        reviewDone = done
        reviewTotal = total
        renderReview()
      },
      () => token !== generation || current !== session,
    )
    if (token !== generation || current !== session) return
    review = result
    reviewing = false
    const actualOpening = classifyGame(current.chess, openings)
    console.info(`[Chess Trap Board] ${current.openingReached ? 'Opening reached.' : `Opening not reached${actualOpening ? `; position matched ${actualOpening.name}` : ''}.`} ${current.opportunityChecks} opportunity ${current.opportunityChecks === 1 ? 'check' : 'checks'}, ${result.generated} generated; ${result.used} found, ${result.missed} missed. Underlines mark generated CPU moves; opportunity replies use ! or ? in place of general annotations. Move marks are engine estimates.`)
    render()
  } catch (error) {
    if (token !== generation || current !== session) return
    reviewing = false
    reviewError = error instanceof Error ? error.message : 'Review failed'
    render()
  }
}

function renderOpeningResults(): void {
  const results = element<HTMLDivElement>('#opening-results')
  results.replaceChildren()
  for (const opening of searchOpenings(openings, element<HTMLInputElement>('#opening-search').value)) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'opening-result'
    button.setAttribute('role', 'option')
    button.setAttribute('aria-selected', String(selectedOpening?.id === opening.id))
    const code = document.createElement('span')
    code.textContent = opening.eco
    const name = document.createElement('strong')
    name.textContent = opening.name
    button.append(code, name)
    button.addEventListener('click', () => {
      invalidateGame()
      selectedOpening = opening
      session = null
      savePreferences()
      renderOpeningSelection()
      renderOpeningResults()
      render()
    })
    results.append(button)
  }
  if (!results.childElementCount && !loadError) results.textContent = openings.length ? 'No matching openings.' : 'Loading…'
}

function renderOpeningSelection(): void {
  const panel = element<HTMLDivElement>('#selected-opening')
  panel.replaceChildren()
  if (!selectedOpening) {
    if (loadError) panel.textContent = loadError
    else if (!openings.length) panel.textContent = 'Loading opening names…'
    else if (!session) panel.textContent = 'No opening selected · computer will choose at random.'
    else panel.textContent = `Random opening: ${session.opening.eco} · ${session.opening.name}`
  } else {
    const title = document.createElement('strong')
    title.textContent = `${selectedOpening.eco} · ${selectedOpening.name}`
    const preview = document.createElement('p')
    const san = openingSan(selectedOpening)
    preview.textContent = san.slice(0, 10).map((move, index) => `${index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}${move}`).join(' ') + (san.length > 10 ? ' …' : '')
    const clear = document.createElement('button')
    clear.type = 'button'
    clear.className = 'text-button clear-opening'
    clear.textContent = 'Clear opening'
    clear.addEventListener('click', () => {
      invalidateGame()
      selectedOpening = null
      session = null
      savePreferences()
      renderOpeningSelection()
      renderOpeningResults()
      render()
    })
    panel.append(title, preview, clear)
  }
}

function renderReview(): void {
  const total = session?.chess.history().length ?? 0
  const position = positionPly()
  const liveEnabled = element<HTMLInputElement>('#evaluation-toggle').checked
  element<HTMLElement>('#review-progress').textContent = reviewing
    ? `Analyzing ${reviewDone} of ${reviewTotal} positions…`
    : reviewError || (liveEnabled && evaluationError ? evaluationError : liveEnabled && evaluating ? 'Evaluating position…' : '')
  const meter = element<HTMLProgressElement>('#review-meter')
  meter.hidden = !reviewing
  meter.value = reviewTotal ? Math.round(reviewDone / reviewTotal * 100) : 0
  element<HTMLButtonElement>('#cancel-review').hidden = !reviewing
  const fen = positionAt(position).fen()
  const score = review
    ? (position === 0 ? review.initialScore : review.entries[position - 1]?.whiteScore ?? null)
    : liveEnabled ? liveEvaluation?.score ?? null : null
  const activeEvaluation = Boolean(review || liveEnabled && session)
  const staleEvaluation = Boolean(liveEnabled && !review && liveEvaluation && liveEvaluation.fen !== fen)
  const fill = element<HTMLElement>('#eval-white')
  fill.hidden = !activeEvaluation
  fill.style.height = `${whiteShare(score)}%`
  element<HTMLElement>('#eval-label').textContent = score ? formatScore(score) : activeEvaluation ? evaluating || reviewing ? '…' : '—' : ''
  element<HTMLElement>('.eval-track').setAttribute('aria-label', score ? `${staleEvaluation ? 'Previous position evaluation while updating' : 'Evaluation after selected move'}: ${formatScore(score)} from White's perspective` : activeEvaluation ? 'Evaluation pending or unavailable' : 'Evaluation hidden')
  element<HTMLElement>('#review-position').textContent = position === 0 ? 'Starting position' : `Move ${position} of ${total}`
  element<HTMLButtonElement>('#review-prev').disabled = position === 0
  element<HTMLButtonElement>('#review-next').disabled = position >= total
  const detail = element<HTMLElement>('#review-detail')
  const entry = review?.entries[position - 1]
  detail.textContent = entry?.bestLine ?? ''
  detail.title = entry?.bestLine ?? ''
  detail.setAttribute('aria-label', entry?.bestLine ? `Suggested line: ${entry.bestLine}` : 'No suggested line')
}

function render(): void {
  const chess = session?.chess ?? previewChess
  const position = positionPly()
  const visiblePosition = positionAt(position)
  const viewingHistory = Boolean(session && position < chess.history().length)
  const opportunityNow = Boolean(session?.isPlayerTurn && session.opportunities.at(-1)?.ply === chess.history().length - 1)
  renderBoard(visiblePosition, viewingHistory)
  element<HTMLElement>('#status').textContent = viewingHistory
    ? position === 0 ? 'Viewing starting position' : `Viewing move ${position} of ${chess.history().length}`
    : session?.completed
    ? session.finishReason ? 'Game ended' : gameStatus(chess)
    : thinking ? 'Computer is thinking…' : session ? gameStatus(chess) : openings.length ? 'Make a move or press New game' : loadError || 'Loading openings…'
  const boardHint = element<HTMLElement>('#board-hint')
  const showOpportunityCue = opportunityNow && !viewingHistory && element<HTMLInputElement>('#opportunity-cue-toggle').checked
  boardHint.classList.toggle('opportunity-cue', showOpportunityCue)
  boardHint.textContent = viewingHistory ? 'History' : showOpportunityCue
    ? 'Possible opportunity · find your best reply'
    : session ? session.openingReached ? session.hasBookContinuation ? 'Opening reached · following database' : 'Opening reached · full game' : session.bookActive ? 'Following opening' : session.hasBookContinuation ? 'Following database' : 'Full game' : openings.length ? 'Make a move to begin' : loadError || 'Loading openings…'
  element<HTMLElement>('#feedback').textContent = session?.feedback || (thinking ? 'The engine is choosing a move. Its files are hosted by this site.' : reviewing ? 'Reviewing the finished game…' : session?.completed ? 'Game finished. Review the moves below.' : session ? 'Play the whole game. Review comes after it ends.' : loadError || (openings.length ? '' : 'Loading openings…'))
  const moves = chess.history()
  element<HTMLElement>('#move-count').textContent = `${moves.length} ${moves.length === 1 ? 'move' : 'moves'}`
  const moveList = element<HTMLDivElement>('#move-list')
  moveList.replaceChildren()
  if (!moves.length) {
    const empty = document.createElement('p')
    empty.className = 'empty-state'
    empty.textContent = 'The board is set. Your moves will appear here.'
    moveList.append(empty)
  } else {
    const startingPly = session?.startingPly ?? 0
    for (let absolute = Math.floor(startingPly / 2) * 2; absolute < startingPly + moves.length; absolute += 2) {
      const row = document.createElement('div')
      row.className = 'move-row'
      const number = document.createElement('span')
      number.className = 'move-number'
      number.textContent = `${Math.floor(absolute / 2) + 1}.`
      row.append(number)
      for (let offset = 0; offset < 2; offset += 1) {
        const index = absolute + offset - startingPly
        if (index < 0 || index >= moves.length) {
          row.append(document.createElement('span'))
          continue
        }
        const ply = index + 1
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.ply = String(ply)
        const entry = review?.entries[ply - 1]
        const mark = entry ? moveAnnotation(entry) : ''
        const annotationLabel = { '': '', '!': 'strong move', '!!': 'exceptional move', '?': 'mistake', '??': 'blunder' }[mark]
        button.textContent = `${moves[index]}${mark}`
        button.setAttribute('aria-current', String(position === ply))
        button.setAttribute('aria-label', `${Math.floor(absolute / 2) + 1}${offset === 0 ? '.' : '...'} ${moves[index]}${entry?.opportunity ? ', generated opportunity' : ''}${entry?.replyFound === undefined ? annotationLabel ? `, ${annotationLabel}` : '' : entry.replyFound ? ', opportunity found' : ', opportunity missed'}`)
        if (entry?.opportunity) button.classList.add('generated-opportunity')
        button.addEventListener('click', () => navigateTo(ply))
        row.append(button)
      }
      moveList.append(row)
    }
    const selected = moveList.querySelector<HTMLButtonElement>('button[aria-current="true"]')
    if (selected) {
      const item = selected.getBoundingClientRect()
      const frame = moveList.getBoundingClientRect()
      if (item.bottom > frame.bottom) moveList.scrollTop += item.bottom - frame.bottom
      else if (item.top < frame.top) moveList.scrollTop -= frame.top - item.top
    }
  }
  element<HTMLButtonElement>('#copy-button').disabled = !session || moves.length === 0
  const hintButton = element<HTMLButtonElement>('#hint-button')
  hintButton.disabled = !session || thinking || reviewing || hintSearching || visiblePosition.isGameOver() || (!viewingHistory && !session.isPlayerTurn)
  hintButton.textContent = hintSearching ? 'Thinking…' : bookHints && hintMove ? `Hint ${bookHints.index + 1}/${bookHints.moves.length}` : hintMove ? 'Hide hint' : 'Hint'
  if (bookHints && hintMove) {
    hintButton.removeAttribute('aria-pressed')
    hintButton.setAttribute('aria-label', `Opening hint ${bookHints.index + 1} of ${bookHints.moves.length}; show next`)
  } else {
    hintButton.setAttribute('aria-pressed', String(Boolean(hintMove)))
    hintButton.removeAttribute('aria-label')
  }
  element<HTMLButtonElement>('#finish-button').disabled = !session || reviewing || session.completed && Boolean(review)
  element<HTMLButtonElement>('#take-back-button').disabled = !session?.canTakeBack
  element<HTMLButtonElement>('#retry-cpu-button').hidden = !engineError || !session?.isCpuTurn
  element<HTMLButtonElement>('#new-button').disabled = openings.length === 0
  const selectedPosition = selectedOpening ? openingPosition(selectedOpening) : null
  const openingButton = element<HTMLButtonElement>('#new-opening-button')
  openingButton.textContent = selectedOpening ? `New ${selectedOpening.eco} game` : 'New opening game'
  openingButton.disabled = !selectedPosition || selectedPosition.isGameOver()
  openingButton.title = !selectedOpening ? 'Select an opening first' : selectedPosition?.isGameOver()
    ? 'This opening already ends the game' : `Start from the final position of ${selectedOpening.name}`
  openingButton.setAttribute('aria-label', openingButton.title)
  renderReview()
}

function startGame(initialMove?: MoveInput, startAtOpening = false): void {
  if (startAtOpening && !selectedOpening) return
  const opening = selectedOpening ?? pickOpening(openings, initialMove)
  if (!opening) return
  invalidateGame()
  session = new TrainingSession(opening, playerColor, openingBook, startAtOpening)
  orientation = playerColor
  sounds.activate()
  if (session.chess.history().length) sounds.playAfterMove(session.chess)
  if (initialMove && !startAtOpening && session.playPlayer(initialMove)) sounds.playAfterMove(session.chess)
  renderOpeningSelection()
  render()
  void evaluateVisiblePosition()
  void runCpu()
}

let lastWheelStep = 0
function wheelThroughMoves(event: WheelEvent): void {
  if (!session || !session.chess.history().length || element('#board-container').querySelector('.promotion') || event.ctrlKey || Math.abs(event.deltaY) < 2) return
  const next = Math.max(0, Math.min(positionPly() + (event.deltaY > 0 ? 1 : -1), session.chess.history().length))
  if (next === positionPly()) return
  event.preventDefault()
  const now = performance.now()
  if (now - lastWheelStep < 110) return
  lastWheelStep = now
  navigateTo(next)
}

for (const id of ['#board-container', '#move-list', '#evaluation-panel', '#review-panel']) {
  element<HTMLElement>(id).addEventListener('wheel', wheelThroughMoves, { passive: false })
}
document.addEventListener('keydown', (event) => {
  if (!session?.chess.history().length || element('#board-container').querySelector('.promotion') || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.closest('.intro-panel'))) return
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }
  const step = steps[event.key]
  if (!step) return
  event.preventDefault()
  navigateTo(positionPly() + step)
})

element<HTMLInputElement>('#opening-search').addEventListener('input', renderOpeningResults)
element<HTMLButtonElement>('#new-button').addEventListener('click', () => startGame())
element<HTMLButtonElement>('#new-opening-button').addEventListener('click', () => startGame(undefined, true))
element<HTMLButtonElement>('#take-back-button').addEventListener('click', () => {
  if (!session?.canTakeBack) return
  const current = session
  invalidateGame()
  current.takeBack()
  render()
  void evaluateVisiblePosition()
})
element<HTMLButtonElement>('#flip-button').addEventListener('click', () => {
  orientation = orientation === 'w' ? 'b' : 'w'
  render()
})
element<HTMLButtonElement>('#finish-button').addEventListener('click', () => {
  if (session?.completed) {
    void runReview()
    return
  }
  invalidateGame()
  session?.finish('stopped')
  render()
  void runReview()
})
element<HTMLButtonElement>('#retry-cpu-button').addEventListener('click', () => void runCpu())
element<HTMLButtonElement>('#cancel-review').addEventListener('click', () => {
  generation += 1
  engine.stop()
  reviewing = false
  reviewError = 'Review cancelled.'
  render()
})
element<HTMLButtonElement>('#review-prev').addEventListener('click', () => {
  navigateTo(positionPly() - 1)
})
element<HTMLButtonElement>('#review-next').addEventListener('click', () => {
  navigateTo(positionPly() + 1)
})
document.querySelectorAll<HTMLInputElement>('input[name="side"]').forEach((radio) => radio.addEventListener('change', () => {
  invalidateGame()
  playerColor = radio.value as Color
  session = null
  orientation = playerColor
  savePreferences()
  renderOpeningSelection()
  render()
}))
element<HTMLInputElement>('#evaluation-toggle').addEventListener('change', () => {
  savePreferences()
  if (element<HTMLInputElement>('#evaluation-toggle').checked) void evaluateVisiblePosition()
  else { cancelEvaluation(); renderReview() }
})
element<HTMLInputElement>('#sound-toggle').addEventListener('change', () => {
  sounds.moveEnabled = element<HTMLInputElement>('#sound-toggle').checked
  sounds.activate()
  savePreferences()
})
element<HTMLInputElement>('#opportunity-cue-toggle').addEventListener('change', () => {
  sounds.opportunityEnabled = element<HTMLInputElement>('#opportunity-cue-toggle').checked
  sounds.activate()
  savePreferences()
  render()
})
element<HTMLInputElement>('#sound-volume').addEventListener('input', () => {
  sounds.volume = Number(element<HTMLInputElement>('#sound-volume').value) / 100
  sounds.activate()
  savePreferences()
})
for (const id of ['#difficulty', '#mistake-frequency', '#mistake-size']) element<HTMLSelectElement>(id).addEventListener('change', savePreferences)
element<HTMLButtonElement>('#copy-button').addEventListener('click', async () => {
  if (!session) return
  const white = session.playerColor === 'w' ? 'Player' : 'Computer'
  const black = session.playerColor === 'b' ? 'Player' : 'Computer'
  const resultOverride = session.finishReason === 'resigned' ? (session.playerColor === 'w' ? '0-1' : '1-0') : undefined
  const pgn = exportPgn(session.chess, white, black, session.openingReached ? { name: session.opening.name, eco: session.opening.eco } : undefined, resultOverride)
  const feedback = element<HTMLElement>('#copy-feedback')
  try {
    await navigator.clipboard.writeText(pgn)
    feedback.textContent = 'PGN copied.'
  } catch {
    const temporary = document.createElement('textarea')
    temporary.value = pgn
    temporary.style.position = 'fixed'
    temporary.style.opacity = '0'
    document.body.append(temporary)
    temporary.select()
    let copied = false
    try { copied = document.execCommand('copy') } catch { /* Report the copy failure below. */ }
    temporary.remove()
    feedback.textContent = copied ? 'PGN copied.' : 'Could not copy PGN. Check clipboard permissions.'
  }
  window.setTimeout(() => { feedback.textContent = '' }, 2500)
})
element<HTMLButtonElement>('#hint-button').addEventListener('click', () => void revealHint())
element<HTMLElement>('#review-detail').addEventListener('pointerenter', previewSuggestedLine)
element<HTMLElement>('#review-detail').addEventListener('pointermove', previewSuggestedLine)
element<HTMLElement>('#review-detail').addEventListener('pointerleave', restoreSuggestedLine)

const savedOpening = restorePreferences()
render()
Promise.all([loadOpenings(), loadOpeningBook()]).then(([loaded, book]) => {
  openings = loaded
  openingBook = book
  selectedOpening = savedOpening ? openings.find((opening) => opening.eco === savedOpening[0] && opening.name === savedOpening[1]) ?? null : null
  renderOpeningResults()
  renderOpeningSelection()
  render()
}).catch((error: unknown) => {
  loadError = error instanceof Error ? error.message : 'Opening names could not be loaded.'
  renderOpeningSelection()
  render()
})
