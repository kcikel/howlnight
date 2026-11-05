# Howlnight

Mobile-first PWA narrator for in-person Werewolf / Mafia (4–20 players).

**Modes**
- **Multi-device rooms** — host creates a 4-letter code + QR / share link; everyone plays on their own phone. Host is narrator + authoritative state (PeerJS / WebRTC).
- **Pass-the-phone** — classic single-device flow (still available).

## Stack

Vite + TypeScript + Preact · Vite PWA · Vitest · PeerJS · Playwright

## Commands

```bash
npm install
npm run dev
npm test
npm run test:e2e   # needs build; probes PeerJS then runs host+players
npm run simulate
npm run build
npm run preview
```

## Local path

`/workspace/howlnight`

Live: https://howlnight.com

## Multi-device notes

- Transport: PeerJS free broker (`0.peerjs.com`) + Google STUN. No TURN → some carrier NAT pairs may fail; same Wi‑Fi is best.
- Payloads are AES-GCM sealed with a key derived from room code + host salt (on top of WebRTC DTLS).
- Host should keep the screen on (Wake Lock when supported).
