# Howlnight — Product & Launch Plan

Working name: **Howlnight**. Pass-the-phone narrator for in-person Werewolf/Mafia. Original UI, copy, and art. Game mechanics are public-domain folk rules.

Competitor benchmark (public): *Werewolf : Undercover* (~$9.3k MRR, ~726 subs, TrustMRR Nov 2026). IAP: Premium Weekly **$3.99**, Premium Yearly **$24.99**, Full Game **$39.99**.

## Insights that shaped the MVP

1. **Narration + atmosphere is the product** — reviews praise voice and ambiance more than role count. We ship Web Speech narration + dark atmospheric UI + light synthesized pad from day one.
2. **Privacy friction kills trust** — some players disliked photo-based identity checks. Howlnight uses classic pass-the-phone reveal only (no camera, no accounts).
3. **Everyone wants to play** — the classic pain is losing one person as moderator. One shared phone, full night/day loop, no human narrator.
4. **Aggressive ads / locked content annoy party groups** — freemium with a clear Pro pack; MVP keeps all roles unlocked while beta-pricing is placeholder-only.

---

## Path: PWA → App Store / Google Play

1. **Ship PWA now** (this repo): installable, offline after first load, shareable URL for playtests.
2. **Wrap with Capacitor** when ready for stores:
   - `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
   - `npx cap init Howlnight <app-id>` → `npx cap add ios|android` → point `webDir` to `dist`.
   - Keep the Vite web build as the single source of truth; native shells for IAP, haptics, status bar.
3. **Apple App Store**
   - User pays **Apple Developer Program USD 99/year**.
   - Need: Apple ID, D-U-N-S if company, privacy policy URL, screenshots (we generate 390×844), age rating 12+ or 4+ depending on dark theme copy, StoreKit / RevenueCat for subscriptions.
4. **Google Play**
   - User pays **USD 25 one-time** Play Console fee.
   - Need: Play Console account, privacy policy, content rating questionnaire, Play Billing / RevenueCat.
5. **Suggested app IDs**: `app.howlnight.party` (or user brand domain).
6. **CI**: build web → sync Capacitor → Fastlane optional later.

---

## Monetization (freemium)

| SKU | Suggested USD | Notes vs competitor |
|-----|---------------|---------------------|
| Free | $0 | Core loop, 4–20 players, basic roles (Wolf, Villager, Seer, Doctor), EN/ES/PT |
| Premium Roles Pack | **$4.99** one-time | Witch, Hunter, Cupid, Spy (marked Pro in MVP) |
| Pro Weekly | **$2.99** | Undercut $3.99 weekly slightly |
| Pro Yearly | **$19.99** | Undercut $24.99; ~2 months free vs weekly |
| Lifetime / Full | **$34.99** | Undercut $39.99 full game |

**Pro subscription / lifetime includes:** premium roles, extra narrator voice packs (recorded or premium TTS), theme packs, custom discuss timers, future role creator.

**MVP status:** upsell screen only — **no real payments**. Wire RevenueCat after Capacitor.

Avoid mid-game ads. Party tables hate interruptions more than a clear paywall on role select.

---

## ASO keywords

### English
Primary: werewolf narrator, mafia party game, werewolf app, no moderator werewolf, pass the phone werewolf  
Secondary: social deduction, party game night, impostor party, village werewolf, narrator game master

### Español
hombre lobo app, narrador hombre lobo, mafia juego fiesta, hombre lobo sin moderador, juego de roles fiesta, impostor fiesta

### Português
lobisomem app, narrador lobisomem, máfia jogo festa, lobisomem sem narrador, jogo de dedução social, impostor festa

Store subtitle ideas:
- EN: *Party Werewolf narrator — one phone*
- ES: *Narrador de hombre lobo — un solo teléfono*
- PT: *Narrador de lobisomem — um só celular*

---

## First 100 users

### Short video (TikTok / Reels / Shorts)
1. “Nobody wants to be the narrator” → flip to Howlnight moon + voice line.
2. Pass-the-phone ASMR: reveal → hide → next player gasp.
3. POV: eyes closed, phone says “Werewolves, choose…” friends lose it.
4. Split-screen: messy paper cards vs clean app dawn reveal.
5. ES/PT versions with Rioplatense / BR voiceover for LATAM.

Hashtags: `#werewolf` `#mafia` `#partygame` `#homlobo` `#lobisomem` `#juegodemesa`

### Reddit
- r/boardgames, r/PartyGames, r/Werewolf, r/socialdeduction — show gameplay clip + honest “PWA beta, feedback wanted”; no spam dumps.
- Local city / university party threads (ES/PT) with “pasá el celu” angle.

### Spanish / Portuguese markets
- Argentina, Uruguay, Chile, México, España, Brasil: party culture + strong “hombre lobo / lobisomem” search intent.
- Seed with WhatsApp / Instagram story share of the tunnel or Pages URL.
- Campus ambassadors: one QR on a flyer at asados / afters.

### Funnel
Landing (SEO section in app) → install PWA → first game → soft Pro screen → waitlist email (later).

---

## Remaining work

- [ ] Real TTS packs or recorded narrator (higher quality than Web Speech)
- [ ] Capacitor shells + store listings
- [ ] RevenueCat / StoreKit / Play Billing
- [ ] Lock premium roles behind purchase
- [ ] More roles (Wild Child, Elder, etc.) and custom role builder
- [ ] Haptics, optional ambient howl SFX pack
- [ ] Accessibility: larger type, reduce motion
- [ ] Privacy policy + terms pages
- [ ] Analytics (privacy-friendly) + crash reporting
- [ ] Tablet / landscape layout
- [ ] Optional QR “second screen” for eliminated players (spectate log)

---

## What the user must provide next

1. **Apple Developer** ($99/yr) and/or **Google Play** ($25) accounts when going native.
2. **Domain + privacy policy** URL for stores.
3. **Payment decision**: RevenueCat vs native IAP only; final prices.
4. **Brand**: confirm name Howlnight vs final trademark search.
5. **Hosting** for permanent URL (Cloudflare Pages / Vercel) if the temporary tunnel expires.
