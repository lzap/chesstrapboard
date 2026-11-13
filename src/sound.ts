/** A short, locally synthesized wooden-style tap. No external audio file is loaded. */
export class MoveSound {
  enabled = false
  volume = 0.35
  private context: AudioContext | null = null

  play(): void {
    if (!this.enabled || this.volume <= 0) return
    try {
      this.context ??= new AudioContext()
      const context = this.context
      if (context.state === 'suspended') void context.resume()
      const start = context.currentTime
      const duration = 0.13
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
      const samples = buffer.getChannelData(0)
      for (let index = 0; index < samples.length; index += 1) {
        const seconds = index / context.sampleRate
        const attack = Math.min(1, seconds / 0.002)
        samples[index] = (Math.random() * 2 - 1) * attack * Math.exp(-seconds * 34)
      }
      const noise = context.createBufferSource()
      noise.buffer = buffer
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 900
      const noiseGain = context.createGain()
      noiseGain.gain.value = this.volume * 0.75
      noise.connect(filter).connect(noiseGain).connect(context.destination)
      noise.start(start)
      noise.stop(start + duration)

      const thump = context.createOscillator()
      thump.type = 'triangle'
      thump.frequency.setValueAtTime(170, start)
      thump.frequency.exponentialRampToValueAtTime(85, start + 0.075)
      const thumpGain = context.createGain()
      thumpGain.gain.setValueAtTime(Math.max(0.001, this.volume * 0.2), start)
      thumpGain.gain.exponentialRampToValueAtTime(0.001, start + 0.09)
      thump.connect(thumpGain).connect(context.destination)
      thump.start(start)
      thump.stop(start + 0.09)
    } catch {
      // Audio is optional; unavailable devices and blocked playback stay silent.
    }
  }
}
