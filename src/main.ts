import { Chess, type Color } from 'chess.js'
import { BoardView } from './board'
import { exportPgn, gameStatus, tryMove } from './chess'
import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')!
let chess = new Chess()
let orientation: Color = 'w'

app.innerHTML = `
  <div class="page">
    <header class="site-header">
      <div class="brand"><span class="brand-mark">♞</span><div><strong>CHESS TRAP BOARD</strong><small>OPENING PRACTICE</small></div></div>
      <a class="source-link" href="https://github.com/lzap/chesstrapboard">Source ↗</a>
    </header>
    <main class="play-layout">
      <section class="panel intro-panel" aria-labelledby="intro-title">
        <p class="eyebrow">TRAIN WITH PURPOSE</p>
        <h1 id="intro-title">Your next move starts here.</h1>
        <p>Practice openings, spot opportunities, and learn from every game.</p>
        <div class="milestone-note"><span class="note-dot"></span><div><strong>Playable board</strong><br />Two-player local play is ready. Opening modes and the engine are coming in the next commits.</div></div>
        <div class="quick-guide"><h2>How to play</h2><p>Select a piece, then its destination. Legal moves are marked on the board. Keyboard users can tab to squares and press Enter.</p></div>
      </section>
      <section class="board-column" aria-label="Game">
        <div class="board-top"><span class="chip" id="turn-chip">Local game</span><span class="board-hint" id="board-hint">Choose a piece to move</span></div>
        <div id="board-container" class="board-container"></div>
        <div class="board-bottom"><p id="status" role="status" aria-live="polite"></p><button type="button" class="text-button" id="flip-button">↻ Flip board</button></div>
        <div class="action-row"><button type="button" id="new-button" class="button button-primary">New game</button><button type="button" id="undo-button" class="button button-secondary">Undo move</button></div>
      </section>
      <aside class="panel moves-panel" aria-label="Moves and PGN">
        <div class="panel-heading"><div><p class="eyebrow">GAME RECORD</p><h2>Moves</h2></div><span id="move-count" class="move-count">0 moves</span></div>
        <div id="move-list" class="move-list"></div>
        <div class="pgn-panel"><label for="pgn">PGN notation</label><textarea id="pgn" readonly spellcheck="false"></textarea><button type="button" id="copy-button" class="button button-secondary">Copy PGN</button></div>
      </aside>
    </main>
    <footer>Made for thoughtful opening practice · <a href="https://github.com/lzap/chesstrapboard/blob/main/THIRD_PARTY_NOTICES.md">Licenses and credits</a></footer>
  </div>
`

const board = new BoardView(document.querySelector('#board-container')!, (input) => {
  const move = tryMove(chess, input)
  if (move) render()
})

function render(): void {
  board.update(chess, orientation)
  document.querySelector<HTMLElement>('#status')!.textContent = gameStatus(chess)
  const moves = chess.history()
  document.querySelector<HTMLElement>('#move-count')!.textContent = `${moves.length} ${moves.length === 1 ? 'move' : 'moves'}`
  document.querySelector<HTMLElement>('#move-list')!.innerHTML = moves.length
    ? Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => `<div class="move-row"><span>${index + 1}.</span><strong>${moves[index * 2]}</strong><strong>${moves[index * 2 + 1] ?? ''}</strong></div>`).join('')
    : '<p class="empty-state">The board is set. Your moves will appear here.</p>'
  document.querySelector<HTMLTextAreaElement>('#pgn')!.value = exportPgn(chess)
  document.querySelector<HTMLButtonElement>('#undo-button')!.disabled = moves.length === 0
}

document.querySelector<HTMLButtonElement>('#new-button')!.addEventListener('click', () => {
  chess = new Chess()
  render()
})
document.querySelector<HTMLButtonElement>('#undo-button')!.addEventListener('click', () => {
  chess.undo()
  render()
})
document.querySelector<HTMLButtonElement>('#flip-button')!.addEventListener('click', () => {
  orientation = orientation === 'w' ? 'b' : 'w'
  render()
})
document.querySelector<HTMLButtonElement>('#copy-button')!.addEventListener('click', async (event) => {
  const textarea = document.querySelector<HTMLTextAreaElement>('#pgn')!
  try {
    await navigator.clipboard.writeText(textarea.value)
    ;(event.currentTarget as HTMLButtonElement).textContent = 'Copied!'
    window.setTimeout(() => { (event.currentTarget as HTMLButtonElement).textContent = 'Copy PGN' }, 1800)
  } catch {
    textarea.focus()
    textarea.select()
  }
})

render()
