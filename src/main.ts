import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <main class="shell">
    <p class="eyebrow">OPENING PRACTICE, ONE MOVE AT A TIME</p>
    <h1>CHESS <span>TRAP</span> BOARD</h1>
    <p class="intro">Learn an opening line. Then explore what happens when an opponent slips.</p>
    <div class="mode-preview" aria-label="Training modes">
      <article><span class="mode-number">01</span><h2>Memorize lines</h2><p>Practice the moves of a named opening, with immediate correction.</p></article>
      <article><span class="mode-number">02</span><h2>Explore traps</h2><p>Play a full game and review the missed opportunities afterward.</p></article>
    </div>
    <p class="build-note">The interactive board is under construction.</p>
  </main>
`
