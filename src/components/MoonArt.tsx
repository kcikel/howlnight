/**
 * Woodcut-style hero: a carved moon with gouged halo rings, a howling wolf on
 * a ridge and the sleeping village below. Colours come from CSS variables so
 * the print reads as bone ink on woad-blue paper.
 */
export function MoonArt() {
  // Gouge marks across the sky: short carved cuts, deterministic.
  const cuts = Array.from({ length: 30 }, (_, i) => {
    const y = 16 + ((i * 37) % 150)
    const x = (i * 83) % 380
    const len = 10 + ((i * 13) % 26)
    return { x, y, len }
  })
  const stars = Array.from({ length: 14 }, (_, i) => ({
    x: (i * 61 + 23) % 380,
    y: 12 + ((i * 41) % 120),
  }))
  return (
    <div class="hero-art" aria-hidden="true">
      <svg viewBox="0 0 390 270" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice">
        <defs>
          <clipPath id="hn-moon-clip">
            <circle cx="236" cy="112" r="64" />
          </clipPath>
        </defs>
        <g class="wc-cuts">
          {cuts.map((c, i) => (
            <path key={i} d={`M${c.x} ${c.y} q${c.len / 2} -1.5 ${c.len} 0`} />
          ))}
        </g>
        <g class="wc-stars">
          {stars.map((s, i) => (
            <path key={i} d={`M${s.x} ${s.y - 3} v6 M${s.x - 3} ${s.y} h6`} />
          ))}
        </g>
        <g class="wc-moon">
          <g class="wc-halo">
            <circle cx="236" cy="112" r="80" />
            <circle cx="236" cy="112" r="96" />
            <circle cx="236" cy="112" r="114" />
          </g>
          <circle cx="236" cy="112" r="64" class="wc-moon-disc" />
          {/* carved shading on the moon's far limb */}
          <g class="wc-hatch" clip-path="url(#hn-moon-clip)">
            <path d="M266 52 q30 60 0 120" />
            <path d="M276 52 q30 60 0 120" />
            <path d="M286 52 q28 60 0 120" />
            <path d="M206 78 q10 -6 22 -3" />
            <path d="M214 92 q8 -3 14 0" />
            <path d="M248 140 q8 4 16 1" />
          </g>
        </g>
        <path
          class="wc-ridge"
          d="M0 214 L12 202 L18 182 L24 202 L36 196 L44 174 L52 196 L66 200 L78 184 L86 200 L110 204 L140 206 L180 210 L214 200 L240 204 L270 198 L284 178 L292 198 L318 196 L330 172 L338 196 L360 192 L372 176 L380 194 L390 192 L390 290 L0 290 Z"
        />
        {/* village roofs, cut from the same paper as the page */}
        <path
          class="wc-village"
          d="M170 290 L170 232 L186 218 L202 232 L210 232 L210 224 L216 224 L216 232 L224 232 L240 218 L256 232 L262 232 L262 194 L266 180 L270 194 L270 226 L282 226 L298 212 L314 226 L322 226 L338 214 L354 226 L390 222 L390 290 Z"
        />
        <g class="wc-windows">
          <rect x="183" y="238" width="5" height="7" />
          <rect x="236" y="236" width="5" height="7" />
          <rect x="264" y="206" width="3" height="6" />
          <rect x="296" y="232" width="5" height="7" />
          <rect x="346" y="236" width="5" height="6" />
        </g>
        {/* the crag and the wolf howling across the moon */}
        <path class="wc-crag" d="M0 236 Q50 222 96 214 L120 192 L150 186 L180 192 L196 214 Q206 236 214 290 L0 290 Z" />
        <g class="wc-crag-cuts">
          <path d="M20 250 q22 -8 44 -4" />
          <path d="M120 206 q16 -4 30 0" />
          <path d="M140 226 q20 -2 36 8" />
        </g>
        <path
          class="wc-wolf"
          transform="translate(126 189) scale(1.12)"
          d="M0 0 Q4 -6 14 -8 C10 -20 14 -34 22 -42 C26 -50 28 -60 30 -66 C31 -72 33 -76 36 -80 L35 -92 L43 -84 L52 -92 L62 -102 L60 -95 L55 -92 L57 -88 C51 -82 49 -76 48 -70 C52 -60 52 -50 50 -40 L50 -6 L56 0 L44 0 L44 -20 C40 -24 34 -18 32 -10 L36 -2 L38 0 Z"
        />
      </svg>
    </div>
  )
}

export function BrandMark() {
  return (
    <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" class="bm-ring" />
      <path class="bm-moon" d="M24 8a12 12 0 1 0 8 19A10 10 0 1 1 24 8z" />
      <path class="bm-cut" d="M9 31 q5 -3 11 -1" />
    </svg>
  )
}
