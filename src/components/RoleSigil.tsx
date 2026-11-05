/** Carved line sigils for each role (replace emoji on the role card). */
const PATHS: Record<string, string> = {
  // three claw rakes across a crescent
  werewolf: 'M40 10a22 22 0 1 0 14 34A18 18 0 1 1 40 10z M18 22l10 22 M26 18l10 24 M34 16l9 24',
  // cottage
  villager: 'M12 30 L32 12 L52 30 M16 27 V52 H48 V27 M28 52 V38 H36 V52 M42 16 V22',
  // eye in a ring
  seer: 'M32 8a24 24 0 1 1 0 48a24 24 0 1 1 0-48 M12 32 Q32 14 52 32 Q32 50 12 32 Z M32 26a6 6 0 1 1 0 12a6 6 0 1 1 0-12',
  // mortar and pestle
  doctor: 'M12 32 H52 Q50 50 32 52 Q14 50 12 32 Z M36 30 L50 10 M24 56 H40',
  // cauldron with rising bubbles
  witch: 'M14 30 H50 M16 30 Q14 52 32 52 Q50 52 48 30 M20 52 L16 58 M44 52 L48 58 M28 22a3 3 0 1 1 0 .1 M36 14a4 4 0 1 1 0 .1 M32 24a2 2 0 1 1 0 .1',
  // arrow with fletching
  hunter: 'M12 52 L52 12 M52 12 L40 14 M52 12 L50 24 M12 52 L12 42 M12 52 L22 52 M18 46 L14 40 M18 46 L24 50',
  // heart pierced by arrow
  cupid: 'M32 50 C12 36 12 18 24 16 C30 15 32 20 32 22 C32 20 34 15 40 16 C52 18 52 36 32 50 Z M8 44 L56 18 M56 18 L48 18 M56 18 L52 25',
  // keyhole
  spy: 'M32 8a24 24 0 1 1 0 48a24 24 0 1 1 0-48 M32 20a6 6 0 1 1 0 12a6 6 0 1 1 0-12 M29 31 L26 44 H38 L35 31',
  // lantern
  littlegirl: 'M24 18 H40 L44 24 V46 L40 52 H24 L20 46 V24 Z M28 12 H36 M32 12 V18 M32 30 Q28 36 32 42 Q36 36 32 30 Z',
}
const FALLBACK = 'M32 8a24 24 0 1 1 0 48a24 24 0 1 1 0-48 M22 26h6 M36 26h6 M22 40 Q32 46 42 40'

export function RoleSigil({ role }: { role?: string }) {
  return (
    <svg class="role-sigil" viewBox="0 0 64 64" aria-hidden="true">
      <path d={(role && PATHS[role]) || FALLBACK} />
    </svg>
  )
}
