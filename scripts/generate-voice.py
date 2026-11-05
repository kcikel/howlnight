#!/usr/bin/env python3
"""Generate Piper TTS narration clips for Howlnight."""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VOICES_DIR = ROOT / "tools" / "piper-voices"
OUT = ROOT / "public" / "voice"
PIPER = ROOT / ".venv-tts" / "bin" / "piper"

# Keys that the narrator speaks (fixed lines). Dynamic names use Web Speech fallback.
NARRATOR_KEYS = [
    "nightFalls",
    "everyoneSleep",
    "dawnTitle",
    "wake",
    "role_werewolf",
    "role_seer",
    "role_doctor",
    "role_witch",
    "role_cupid",
    "role_spy",
    "wolvesChoose",
    "seerChoose",
    "doctorChoose",
    "witchHealAsk",
    "witchPoisonAsk",
    "cupidChoose",
    "spyChoose",
    "visionWolf",
    "visionVillager",
    "nobodyDied",
    "foundDead",
    "eliminated",
    "survivedVote",
    "hunterShot",
    "winners_wolves",
    "winners_village",
    "winners_lovers",
]

# Inline the three language dicts (subset) — keep in sync with src/i18n/messages.ts
TEXTS = {
    "en": {
        "nightFalls": "Night falls on the village…",
        "everyoneSleep": "Everyone, close your eyes.",
        "dawnTitle": "Dawn.",
        "wake": "Wake up:",
        "role_werewolf": "Werewolf.",
        "role_seer": "Seer.",
        "role_doctor": "Doctor.",
        "role_witch": "Witch.",
        "role_cupid": "Cupid.",
        "role_spy": "Spy.",
        "wolvesChoose": "Werewolves, choose your prey.",
        "seerChoose": "Seer, choose someone to inspect.",
        "doctorChoose": "Doctor, choose someone to protect.",
        "witchHealAsk": "Witch — the wolves struck. Use your heal potion?",
        "witchPoisonAsk": "Witch — use your poison on someone?",
        "cupidChoose": "Cupid, choose two lovers.",
        "spyChoose": "Spy, choose someone to peek at.",
        "visionWolf": "is a Werewolf.",
        "visionVillager": "is NOT a Werewolf.",
        "nobodyDied": "The village wakes. Nobody died tonight.",
        "foundDead": "Found dead this morning.",
        "eliminated": "Eliminated.",
        "survivedVote": "The village could not decide.",
        "hunterShot": "Hunter — choose your dying shot.",
        "winners_wolves": "Werewolves win.",
        "winners_village": "Village wins.",
        "winners_lovers": "Lovers win.",
    },
    "es": {
        "nightFalls": "La noche cae sobre el pueblo…",
        "everyoneSleep": "Todos, cierren los ojos.",
        "dawnTitle": "Amanecer.",
        "wake": "Despierta:",
        "role_werewolf": "Hombre lobo.",
        "role_seer": "Vidente.",
        "role_doctor": "Doctor.",
        "role_witch": "Bruja.",
        "role_cupid": "Cupido.",
        "role_spy": "Espía.",
        "wolvesChoose": "Hombres lobo, elijan a su presa.",
        "seerChoose": "Vidente, elegí a quién inspeccionar.",
        "doctorChoose": "Doctor, elegí a quién proteger.",
        "witchHealAsk": "Bruja — los lobos atacaron. ¿Usás la poción de cura?",
        "witchPoisonAsk": "Bruja — ¿usás el veneno con alguien?",
        "cupidChoose": "Cupido, elegí a dos amantes.",
        "spyChoose": "Espía, elegí a quién espiar.",
        "visionWolf": "es un Hombre lobo.",
        "visionVillager": "NO es un Hombre lobo.",
        "nobodyDied": "El pueblo despierta. Nadie murió esta noche.",
        "foundDead": "Encontrados muertos esta mañana.",
        "eliminated": "Eliminado.",
        "survivedVote": "El pueblo no se puso de acuerdo.",
        "hunterShot": "Cazador — elegí tu último disparo.",
        "winners_wolves": "Ganan los Hombres lobo.",
        "winners_village": "Gana el Pueblo.",
        "winners_lovers": "Ganan los Amantes.",
    },
    "pt": {
        "nightFalls": "A noite cai sobre a vila…",
        "everyoneSleep": "Todos, fechem os olhos.",
        "dawnTitle": "Amanhecer.",
        "wake": "Acorde:",
        "role_werewolf": "Lobisomem.",
        "role_seer": "Vidente.",
        "role_doctor": "Médico.",
        "role_witch": "Bruxa.",
        "role_cupid": "Cupido.",
        "role_spy": "Espião.",
        "wolvesChoose": "Lobisomens, escolham sua presa.",
        "seerChoose": "Vidente, escolha quem inspecionar.",
        "doctorChoose": "Médico, escolha quem proteger.",
        "witchHealAsk": "Bruxa — os lobos atacaram. Usar a poção de cura?",
        "witchPoisonAsk": "Bruxa — usar o veneno em alguém?",
        "cupidChoose": "Cupido, escolha dois amantes.",
        "spyChoose": "Espião, escolha quem espiar.",
        "visionWolf": "é um Lobisomem.",
        "visionVillager": "NÃO é um Lobisomem.",
        "nobodyDied": "A vila acorda. Ninguém morreu esta noite.",
        "foundDead": "Encontrados mortos esta manhã.",
        "eliminated": "Eliminado.",
        "survivedVote": "A vila não chegou a um acordo.",
        "hunterShot": "Caçador — escolha seu último tiro.",
        "winners_wolves": "Lobisomens vencem.",
        "winners_village": "A Vila vence.",
        "winners_lovers": "Os Amantes vencem.",
    },
}

VOICES = {
    "en": "en_US-norman-medium.onnx",
    "es": "es_MX-claude-high.onnx",
    "pt": "pt_BR-jeff-medium.onnx",
}

VOICE_META = {
    "en": {
        "id": "en_US-norman-medium",
        "license": "public domain (LibriVox dataset)",
        "quality": "medium",
    },
    "es": {
        "id": "es_MX-claude-high",
        "license": "Apache-2.0",
        "quality": "high",
    },
    "pt": {
        "id": "pt_BR-jeff-medium",
        "license": "CC0 (OHF-Voice voice-datasets)",
        "quality": "medium",
    },
}


def synth(lang: str, key: str, text: str, dest: Path) -> None:
    model = VOICES_DIR / VOICES[lang]
    config = Path(str(model) + ".json")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav = Path(tmp.name)
    try:
        # Slightly slower + sentence silence for dramatic pacing
        cmd = [
            str(PIPER),
            "-m",
            str(model),
            "-c",
            str(config),
            "-f",
            str(wav),
            "--length-scale",
            "1.12",
            "--sentence-silence",
            "0.35",
        ]
        subprocess.run(cmd, input=text + "\n", text=True, check=True, capture_output=True)
        # Compact mono mp3 ~56kbps (iOS-friendly)
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(wav),
                "-ac",
                "1",
                "-ar",
                "22050",
                "-b:a",
                "56k",
                "-codec:a",
                "libmp3lame",
                str(dest),
            ],
            check=True,
            capture_output=True,
        )
    finally:
        wav.unlink(missing_ok=True)


def main() -> None:
    manifest: dict = {
        "engine": "piper-tts",
        "format": "mp3",
        "bitrate": "56k",
        "voices": VOICE_META,
        "keys": NARRATOR_KEYS,
        "files": {},
    }
    for lang in ("en", "es", "pt"):
        out_lang = OUT / lang
        out_lang.mkdir(parents=True, exist_ok=True)
        manifest["files"][lang] = {}
        for key in NARRATOR_KEYS:
            text = TEXTS[lang][key]
            dest = out_lang / f"{key}.mp3"
            print(f"[{lang}] {key}: {text}")
            synth(lang, key, text, dest)
            size = dest.stat().st_size
            manifest["files"][lang][key] = {"file": f"{key}.mp3", "bytes": size, "text": text}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    total = sum(p.stat().st_size for p in OUT.rglob("*.mp3"))
    print(f"Done. Total mp3 bytes: {total} ({total/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()
