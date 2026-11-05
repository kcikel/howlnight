export function MoonArt() {
  return (
    <div class="hero-art" aria-hidden="true">
      <svg viewBox="0 0 390 180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sky" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stop-color="#2a1f4d" />
            <stop offset="100%" stop-color="#0b0a12" />
          </radialGradient>
          <radialGradient id="moonG" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#fff8" />
            <stop offset="45%" stop-color="#c9b8ff" />
            <stop offset="100%" stop-color="#6b4dff" />
          </radialGradient>
        </defs>
        <rect width="390" height="180" fill="url(#sky)" />
        {/* stars */}
        {Array.from({ length: 28 }, (_, i) => {
          const x = (i * 47 + 13) % 390
          const y = (i * 29 + 11) % 110
          const r = 0.6 + (i % 3) * 0.4
          return <circle key={i} cx={x} cy={y} r={r} fill="#efe9ff" opacity={0.35 + (i % 5) * 0.1} />
        })}
        <circle cx="300" cy="52" r="28" fill="url(#moonG)" />
        <circle cx="288" cy="46" r="24" fill="#14121f" opacity="0.85" />
        {/* pines */}
        <path d="M0 180 L0 140 L30 100 L50 140 L70 90 L95 140 L110 115 L130 145 L160 100 L185 145 L210 120 L235 150 L270 105 L300 150 L330 125 L360 155 L390 130 L390 180 Z" fill="#12101c" />
        <path d="M40 180 L55 130 L70 180 M120 180 L140 115 L160 180 M220 180 L245 125 L270 180 M320 180 L340 135 L360 180" fill="#1a1728" />
        {/* wolf silhouette */}
        <path
          d="M95 150 c8-18 22-28 38-28 10 0 18 4 26 12 4-10 14-16 24-14 2 8-2 16-8 22 12 2 20 10 22 22 H90 c2-8 6-12 13-14z"
          fill="#0b0a12"
          stroke="#9b7cff"
          stroke-width="1.2"
          opacity="0.95"
        />
        <circle cx="120" cy="132" r="1.6" fill="#e0455a" />
      </svg>
    </div>
  )
}

export function BrandMark() {
  return (
    <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#14121f" stroke="#2e2a45" />
      <circle cx="34" cy="28" r="14" fill="#c9b8ff" />
      <circle cx="28" cy="24" r="14" fill="#14121f" />
      <path d="M20 46c4-7 9-10 14-10s10 3 14 10" stroke="#9b7cff" stroke-width="3" stroke-linecap="round" fill="none" />
    </svg>
  )
}
