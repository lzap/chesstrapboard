import { Chess, type Color } from 'chess.js'
import { BoardView } from './board'
import { exportPgn, gameStatus } from './chess'
import { EngineClient } from './engine'
import { classifyGame, fromUci, loadOpenings, openingSan, searchOpenings, toUci, type Opening } from './openings'
import { analyzeGame, formatScore, whiteShare, type GameReview } from './review'
import { TrainingSession, type Mode } from './session'
import { findCandidateMistake, shouldAttemptMistake, type MistakeFrequency, type MistakeSize } from './traps'
import './style.css'

const element = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!
const previewChess = new Chess()
const preferencesKey = 'chess-trap-board-preferences-v1'
let openings: Opening[] = []
let selectedOpening: Opening | null = null
let session: TrainingSession | null = null
let playerColor: Color = 'w'
let orientation: Color = 'w'
let loadError = ''
let mode: Mode = 'memorize'
let thinking = false
let engineError = false
let generation = 0
let review: GameReview | null = null
let reviewing = false
let reviewDone = 0
let reviewTotal = 0
let reviewError = ''
let reviewIndex: number | null = null
const engine = new EngineClient()

function savePreferences(): void {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify({
      mode, playerColor,
      opening: selectedOpening ? [selectedOpening.eco, selectedOpening.name] : null,
      hint: element<HTMLInputElement>('#hint-toggle').checked,
      difficulty: element<HTMLSelectElement>('#difficulty').value,
      frequency: element<HTMLSelectElement>('#mistake-frequency').value,
      size: element<HTMLSelectElement>('#mistake-size').value,
    }))
  } catch { /* Preferences remain usable for this session. */ }
}

function restorePreferences(): [string, string] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey) ?? '{}') as Record<string, unknown>
    if (saved.mode === 'traps') mode = 'traps'
    if (saved.playerColor === 'b') playerColor = 'b'
    orientation = playerColor
    element<HTMLInputElement>(`input[name="side"][value="${playerColor}"]`).checked = true
    element<HTMLInputElement>('#hint-toggle').checked = saved.hint === true
    for (const [id, value] of [['#difficulty', saved.difficulty], ['#mistake-frequency', saved.frequency], ['#mistake-size', saved.size]] as const) {
      const select = element<HTMLSelectElement>(id)
      if (typeof value === 'string' && [...select.options].some((option) => option.value === value)) select.value = value
    }
    if (Array.isArray(saved.opening) && saved.opening.length === 2 && saved.opening.every((value) => typeof value === 'string')) return saved.opening as [string, string]
  } catch { /* Use defaults when storage is unavailable or invalid. */ }
  return null
}

const board = new BoardView(element('#board-container'), (input) => {
  if (!session) return
  const move = session.playPlayer(input)
  render()
  if (move && mode === 'traps') {
    if (session.completed) void runReview()
    else void runCpu()
  }
})

function invalidateGame(): void {
  generation += 1
  engine.stop()
  thinking = false
  engineError = false
  reviewing = false
  review = null
  reviewDone = 0
  reviewTotal = 0
  reviewError = ''
  reviewIndex = null
}

function difficultyBudget(): number {
  const difficulty = element<HTMLSelectElement>('#difficulty').value
  return difficulty === 'beginner' ? 180 : difficulty === 'strong' ? 1300 : 550
}

async function runCpu(): Promise<void> {
  const current = session
  if (!current || current.mode !== 'traps' || !current.isCpuTurn) return
  if (current.advanceBook()) {
    render()
    if (current.completed) void runReview()
    return
  }
  const token = generation
  thinking = true
  engineError = false
  render()
  try {
    const fen = current.chess.fen()
    const ply = current.chess.history().length
    const lastOpportunity = current.opportunities.at(-1)
    const eligible = (current.openingReached || !current.bookActive)
      && ply <= Math.min(36, Math.max(20, current.opening.moves.length + 10))
      && current.opportunities.length < 3
      && (!lastOpportunity || ply - lastOpportunity.ply >= 6)
    const frequency = element<HTMLSelectElement>('#mistake-frequency').value as MistakeFrequency
    let result
    let candidate = null
    if (eligible && shouldAttemptMistake(frequency, Math.random())) {
      const shallow = await engine.search(fen, Math.max(180, Math.floor(difficultyBudget() / 2)), 5)
      if (token !== generation || current !== session) return
      result = await engine.search(fen, Math.max(950, difficultyBudget()), 6)
      candidate = findCandidateMistake(fen, shallow, result, element<HTMLSelectElement>('#mistake-size').value as MistakeSize)
    } else {
      result = await engine.search(fen, difficultyBudget())
    }
    if (token !== generation || current !== session) return
    thinking = false
    const chosenMove = candidate?.move ?? result.bestMove
    if (!chosenMove || !current.playCpu(fromUci(chosenMove))) throw new Error('Engine did not return a legal move')
    if (candidate) current.opportunities.push({ fen, ply, cpuMove: candidate.move, suggestedReply: candidate.reply, estimatedLossCp: candidate.lossCp })
    render()
    if (current.completed) void runReview()
  } catch (error) {
    if (token !== generation || current !== session) return
    thinking = false
    engineError = true
    engine.terminate()
    current.feedback = error instanceof Error ? error.message : 'Engine failed to move'
    render()
  }
}

async function runReview(): Promise<void> {
  const current = session
  if (!current || current.mode !== 'traps' || !current.completed) return
  const token = generation
  reviewing = true
  review = null
  reviewError = ''
  reviewDone = 0
  reviewTotal = current.chess.history().length + 1
  reviewIndex = current.chess.history().length
  render()
  try {
    const result = await analyzeGame(
      current.chess,
      (fen, milliseconds) => engine.search(fen, milliseconds),
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
    render()
  } catch (error) {
    if (token !== generation || current !== session) return
    reviewing = false
    reviewError = error instanceof Error ? error.message : 'Review failed'
    render()
  }
}

function expectedSan(current: TrainingSession): string | null {
  if (!current.expected) return null
  const expected = fromUci(current.expected)
  return current.chess.moves({ verbose: true }).find((move) => toUci(move) === toUci(expected))?.san ?? null
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
    panel.textContent = loadError || 'Choose an opening from the list.'
    element<HTMLButtonElement>('#start-button').disabled = true
    return
  }
  const title = document.createElement('strong')
  title.textContent = `${selectedOpening.eco} · ${selectedOpening.name}`
  const preview = document.createElement('p')
  const san = openingSan(selectedOpening)
  preview.textContent = san.slice(0, 10).map((move, index) => `${index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}${move}`).join(' ') + (san.length > 10 ? ' …' : '')
  panel.append(title, preview)
  const hasPlayerMove = selectedOpening.moves.some((_, index) => index % 2 === (playerColor === 'w' ? 0 : 1))
  if (mode === 'memorize' && !hasPlayerMove) {
    const note = document.createElement('p')
    note.textContent = 'Choose a longer variation to practice this color.'
    panel.append(note)
  }
  element<HTMLButtonElement>('#start-button').disabled = mode === 'memorize' && !hasPlayerMove
}

function renderModeControls(): void {
  for (const [name, id] of [['memorize', '#memorize-mode'], ['traps', '#traps-mode']] as const) {
    const button = element<HTMLButtonElement>(id)
    button.classList.toggle('active', mode === name)
    button.setAttribute('aria-pressed', String(mode === name))
  }
  element<HTMLLabelElement>('#hint-option').hidden = mode !== 'memorize'
  element<HTMLDivElement>('#trap-controls').hidden = mode !== 'traps'
  element<HTMLButtonElement>('#undo-button').hidden = mode !== 'memorize'
  element<HTMLButtonElement>('#finish-button').hidden = mode !== 'traps'
  element<HTMLButtonElement>('#new-button').textContent = mode === 'memorize' ? 'Restart line' : 'New game'
  element<HTMLButtonElement>('#start-button').textContent = mode === 'memorize' ? 'Start practice' : 'Start game'
}

function renderReview(): void {
  const panel = element<HTMLElement>('#review-panel')
  panel.hidden = !session || session.mode !== 'traps' || !session.completed
  if (panel.hidden || !session) return
  element<HTMLElement>('#review-progress').textContent = reviewing
    ? `Analyzing ${reviewDone} of ${reviewTotal} positions…`
    : reviewError || (review ? 'Review complete. Select a move to inspect it.' : 'Ready to analyze.')
  const meter = element<HTMLProgressElement>('#review-meter')
  meter.hidden = !reviewing
  meter.value = reviewTotal ? Math.round(reviewDone / reviewTotal * 100) : 0
  element<HTMLButtonElement>('#cancel-review').hidden = !reviewing
  element<HTMLButtonElement>('#review-button').hidden = reviewing
  const actualOpening = classifyGame(session.chess, openings)
  element<HTMLElement>('#review-summary').textContent = review
    ? `${session.openingReached ? 'Target opening reached.' : `Target opening not reached${actualOpening ? `; position matched ${actualOpening.name}` : ''}.`} ${review.generated} generated opportunity ${review.generated === 1 ? 'attempt' : 'attempts'}; ${review.used} used, ${review.missed} missed. Scores are estimates.`
    : ''
  const position = reviewIndex ?? session.chess.history().length
  const entry = review?.entries[position - 1]
  const score = entry?.whiteScore ?? null
  element<HTMLElement>('#eval-white').style.height = `${whiteShare(score)}%`
  element<HTMLElement>('#eval-label').textContent = formatScore(score)
  element<HTMLElement>('.eval-track').setAttribute('aria-label', `Evaluation after selected move: ${formatScore(score)} from White's perspective`)
  element<HTMLElement>('#review-position').textContent = position === 0 ? 'Starting position' : `Move ${position} of ${session.chess.history().length}`
  element<HTMLButtonElement>('#review-prev').disabled = !review || position === 0
  element<HTMLButtonElement>('#review-next').disabled = !review || position >= session.chess.history().length
  const detail = element<HTMLElement>('#review-detail')
  if (!review) detail.textContent = ''
  else if (!entry) detail.textContent = 'Starting position. Choose a move to see its engine review.'
  else {
    const moveLabel = `${Math.floor((position + 1) / 2)}${entry.color === 'w' ? '.' : '...'} ${entry.san}`
    const best = entry.bestSan ? ` Best move: ${entry.bestSan}.` : ''
    const line = entry.bestLine ? ` Suggested line: ${entry.bestLine}.` : ''
    const opportunity = entry.opportunity ? ` Engine-generated opportunity: ${entry.opportunity.replace('-', ' ')}.` : ''
    detail.textContent = `${moveLabel} · ${entry.grade}${entry.lossCp === null ? '' : ` · about ${(entry.lossCp / 100).toFixed(1)} pawns lost`}.${best}${line}${opportunity}`
  }
  const list = element<HTMLDivElement>('#review-list')
  list.replaceChildren()
  if (!review) return
  for (const item of review.entries) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `review-row grade-${item.grade}`
    button.setAttribute('aria-current', String(position === item.ply + 1))
    const moveLabel = `${Math.floor(item.ply / 2) + 1}${item.color === 'w' ? '.' : '...'} ${item.san}`
    button.textContent = `${moveLabel} · ${item.grade}${item.opportunity ? ` · opportunity ${item.opportunity}` : ''}`
    button.addEventListener('click', () => { reviewIndex = item.ply + 1; render() })
    list.append(button)
  }
}

function render(): void {
  renderModeControls()
  const chess = session?.chess ?? previewChess
  let boardChess = chess
  if (session?.mode === 'traps' && session.completed && reviewIndex !== null) {
    boardChess = new Chess()
    for (const move of session.chess.history({ verbose: true }).slice(0, reviewIndex)) boardChess.move({ from: move.from, to: move.to, promotion: move.promotion })
  }
  board.update(boardChess, orientation, session?.playerColor ?? null, Boolean(session?.isPlayerTurn) && !thinking)
  element<HTMLElement>('#status').textContent = session?.completed
    ? session.mode === 'memorize' ? 'Opening line complete' : session.finishReason ? 'Game ended' : gameStatus(chess)
    : thinking ? 'Computer is thinking…' : session ? gameStatus(chess) : 'Choose an opening to begin'
  element<HTMLElement>('#turn-chip').textContent = mode === 'memorize' ? 'Memorize lines' : 'Explore traps'
  element<HTMLElement>('#board-hint').textContent = session
    ? session.mode === 'memorize'
      ? `${Math.min(chess.history().length, session.opening.moves.length)} of ${session.opening.moves.length} line moves`
      : session.openingReached ? 'Opening reached · full game' : session.bookActive ? 'Following opening' : 'Full game'
    : 'Select an opening to begin'
  const hint = mode === 'memorize' && session?.isPlayerTurn && element<HTMLInputElement>('#hint-toggle').checked ? expectedSan(session) : null
  element<HTMLElement>('#feedback').textContent = session?.feedback || (hint ? `Next move: ${hint}` : thinking ? 'The engine is choosing a move. Its files are hosted by this site.' : reviewing ? 'Reviewing the finished game…' : session?.completed && mode === 'traps' ? 'Game finished. Review the moves below.' : session ? mode === 'memorize' ? 'Follow the line. A different move will be corrected immediately.' : 'Play the whole game. Review comes after it ends.' : loadError || 'Choose an opening to begin.')
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
    for (let index = 0; index < moves.length; index += 2) {
      const row = document.createElement('div')
      row.className = 'move-row'
      for (const text of [`${index / 2 + 1}.`, moves[index], moves[index + 1] ?? '']) {
        const cell = document.createElement('span')
        cell.textContent = text
        row.append(cell)
      }
      moveList.append(row)
    }
  }
  const white = session?.playerColor === 'w' ? 'Player' : 'Computer'
  const black = session?.playerColor === 'b' ? 'Player' : 'Computer'
  const resultOverride = session?.finishReason === 'resigned' ? (session.playerColor === 'w' ? '0-1' : '1-0') : undefined
  element<HTMLTextAreaElement>('#pgn').value = exportPgn(chess, white, black, session?.openingReached ? { name: session.opening.name, eco: session.opening.eco } : undefined, resultOverride)
  element<HTMLButtonElement>('#undo-button').disabled = !session || moves.length === 0
  element<HTMLButtonElement>('#finish-button').disabled = !session || session.completed
  element<HTMLButtonElement>('#retry-cpu-button').hidden = !engineError || !session?.isCpuTurn
  element<HTMLButtonElement>('#new-button').disabled = !selectedOpening
  renderReview()
}

function startPractice(): void {
  if (!selectedOpening) return
  invalidateGame()
  session = new TrainingSession(selectedOpening, mode, playerColor)
  orientation = playerColor
  render()
  if (mode === 'traps') void runCpu()
}

element<HTMLInputElement>('#opening-search').addEventListener('input', renderOpeningResults)
for (const [name, id] of [['memorize', '#memorize-mode'], ['traps', '#traps-mode']] as const) {
  element<HTMLButtonElement>(id).addEventListener('click', () => {
    if (mode === name) return
    invalidateGame()
    mode = name
    session = null
    savePreferences()
    renderOpeningSelection()
    render()
  })
}
element<HTMLButtonElement>('#start-button').addEventListener('click', startPractice)
element<HTMLButtonElement>('#new-button').addEventListener('click', startPractice)
element<HTMLButtonElement>('#undo-button').addEventListener('click', () => {
  session?.undoPractice()
  session?.advanceBook()
  render()
})
element<HTMLButtonElement>('#flip-button').addEventListener('click', () => {
  orientation = orientation === 'w' ? 'b' : 'w'
  render()
})
element<HTMLButtonElement>('#finish-button').addEventListener('click', () => {
  invalidateGame()
  session?.finish('stopped')
  render()
  void runReview()
})
element<HTMLButtonElement>('#retry-cpu-button').addEventListener('click', () => void runCpu())
element<HTMLButtonElement>('#review-button').addEventListener('click', () => void runReview())
element<HTMLButtonElement>('#cancel-review').addEventListener('click', () => {
  generation += 1
  engine.stop()
  reviewing = false
  reviewError = 'Review cancelled. You can analyze again.'
  render()
})
element<HTMLButtonElement>('#review-prev').addEventListener('click', () => {
  reviewIndex = Math.max(0, (reviewIndex ?? 0) - 1)
  render()
})
element<HTMLButtonElement>('#review-next').addEventListener('click', () => {
  reviewIndex = Math.min(session?.chess.history().length ?? 0, (reviewIndex ?? 0) + 1)
  render()
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
element<HTMLInputElement>('#hint-toggle').addEventListener('change', () => { savePreferences(); render() })
for (const id of ['#difficulty', '#mistake-frequency', '#mistake-size']) element<HTMLSelectElement>(id).addEventListener('change', savePreferences)
element<HTMLButtonElement>('#copy-button').addEventListener('click', async (event) => {
  const button = event.currentTarget as HTMLButtonElement
  const textarea = element<HTMLTextAreaElement>('#pgn')
  try {
    await navigator.clipboard.writeText(textarea.value)
    button.textContent = 'Copied!'
    window.setTimeout(() => { button.textContent = 'Copy PGN' }, 1800)
  } catch {
    textarea.focus()
    textarea.select()
  }
})

const savedOpening = restorePreferences()
render()
loadOpenings().then((loaded) => {
  openings = loaded
  selectedOpening = (savedOpening && openings.find((opening) => opening.eco === savedOpening[0] && opening.name === savedOpening[1]))
    || openings.find((opening) => opening.name === 'Italian Game') || openings[0]
  renderOpeningResults()
  renderOpeningSelection()
  render()
}).catch((error: unknown) => {
  loadError = error instanceof Error ? error.message : 'Opening names could not be loaded.'
  renderOpeningSelection()
  render()
})
