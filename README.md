# Howlnight

Mobile-first PWA narrator for in-person Werewolf / Mafia (4–20 players, one phone).

## Stack

Vite + TypeScript + Preact · Vite PWA · Vitest · Web Speech API

## Commands

```bash
npm install
npm run dev
npm test
npm run simulate
npm run build
npm run preview
```

## Local path

`/workspace/howlnight`

Built assets: `/workspace/howlnight/dist`

## Narrator voice

Pre-rendered MP3 clips in `public/voice/<lang>/` (EN / ES / PT), generated with
[OpenBMB VoxCPM2](https://github.com/OpenBMB/VoxCPM) (Apache-2.0) via
`scripts/generate-voice.py --engine voxcpm`. Player names and missing clips fall
back to the Web Speech API. Legacy Piper generation remains available with
`--engine piper`.

Requires a local `.venv-voxcpm` (Python 3.10–3.12) and model weights under
`tools/voxcpm-models/VoxCPM2` (gitignored).
