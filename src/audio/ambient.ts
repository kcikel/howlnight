/** Tiny synthesized wind/howl pad via Web Audio — original, no samples. */

let ctx: AudioContext | null = null
let nodes: AudioNode[] = []
let running = false

export function startAmbient() {
  if (running || typeof window === 'undefined') return
  try {
    ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0.04
    master.connect(ctx.destination)

    // Low rumble
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = 55
    const g1 = ctx.createGain()
    g1.gain.value = 0.5
    osc1.connect(g1)
    g1.connect(master)
    osc1.start()

    // Soft noise-ish via detuned triangle
    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.value = 110
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.08
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 8
    lfo.connect(lfoGain)
    lfoGain.connect(osc2.frequency)
    const g2 = ctx.createGain()
    g2.gain.value = 0.15
    osc2.connect(g2)
    g2.connect(master)
    osc2.start()
    lfo.start()

    nodes = [osc1, osc2, lfo, g1, g2, lfoGain, master]
    running = true
  } catch {
    /* ignore */
  }
}

export function stopAmbient() {
  if (!ctx) return
  try {
    for (const n of nodes) {
      if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
        try {
          ;(n as OscillatorNode).stop()
        } catch {
          /* */
        }
      }
      try {
        n.disconnect()
      } catch {
        /* */
      }
    }
    void ctx.close()
  } catch {
    /* */
  }
  ctx = null
  nodes = []
  running = false
}
