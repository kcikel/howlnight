#!/usr/bin/env python3
"""Generate Howlnight narrator clips.

Engines:
  --engine voxcpm  (default) OpenBMB VoxCPM2, Apache-2.0, multilingual voice design
  --engine piper   legacy Piper ONNX voices
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "voice"
VOXCPM_DIR = ROOT / "tools" / "voxcpm-models" / "VoxCPM2"
VOXCPM_VENV_PY = ROOT / ".venv-voxcpm" / "bin" / "python"
PIPER = ROOT / ".venv-tts" / "bin" / "piper"
VOICES_DIR = ROOT / "tools" / "piper-voices"

NARRATOR_KEYS = [
    "nightFalls",
    "everyoneSleep",
    "dawnTitle",
    "wake",
    "role_werewolf",
    "role_seer",
    "role_doctor",
    "role_witch",
    "role_hunter",
    "role_cupid",
    "role_spy",
    "role_littlegirl",
    "wolvesChoose",
    "seerChoose",
    "doctorChoose",
    "witchHealAsk",
    "witchPoisonAsk",
    "cupidChoose",
    "spyChoose",
    "littlegirlChoose",
    "visionWolf",
    "visionVillager",
    "nobodyDied",
    "foundDead",
    "discussStart",
    "timeRunningOut",
    "voteStart",
    "eliminated",
    "survivedVote",
    "hunterShot",
    "winners_wolves",
    "winners_village",
    "winners_lovers",
]

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
        "role_hunter": "Hunter.",
        "role_littlegirl": "Little Girl.",
        "role_cupid": "Cupid.",
        "role_spy": "Spy.",
        "wolvesChoose": "Werewolves, choose your prey.",
        "seerChoose": "Seer, choose someone to inspect.",
        "doctorChoose": "Doctor, choose someone to protect.",
        "witchHealAsk": "Witch — the wolves struck. Use your heal potion?",
        "witchPoisonAsk": "Witch — use your poison on someone?",
        "cupidChoose": "Cupid, choose two lovers.",
        "spyChoose": "Spy, choose someone to peek at.",
        "littlegirlChoose": "Little Girl — carefully peek at someone. If they are a wolf, you may be caught.",
        "visionWolf": "is a Werewolf.",
        "visionVillager": "is NOT a Werewolf.",
        "nobodyDied": "The village wakes. Nobody died tonight.",
        "foundDead": "Found dead this morning.",
        "discussStart": "Discuss. Accuse. Defend. The village is listening.",
        "timeRunningOut": "Time is running out.",
        "voteStart": "It is time to vote.",
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
        "role_hunter": "Cazador.",
        "role_littlegirl": "Niña.",
        "role_cupid": "Cupido.",
        "role_spy": "Espía.",
        "wolvesChoose": "Hombres lobo, elijan a su presa.",
        "seerChoose": "Vidente, elegí a quién inspeccionar.",
        "doctorChoose": "Doctor, elegí a quién proteger.",
        "witchHealAsk": "Bruja — los lobos atacaron. ¿Usás la poción de cura?",
        "witchPoisonAsk": "Bruja — ¿usás el veneno con alguien?",
        "cupidChoose": "Cupido, elegí a dos amantes.",
        "spyChoose": "Espía, elegí a quién espiar.",
        "littlegirlChoose": "Niña — mirá con cuidado a alguien. Si es lobo, pueden atraparte.",
        "visionWolf": "es un Hombre lobo.",
        "visionVillager": "NO es un Hombre lobo.",
        "nobodyDied": "El pueblo despierta. Nadie murió esta noche.",
        "foundDead": "Encontrados muertos esta mañana.",
        "discussStart": "Discutan. Acusen. Defiendan. El pueblo escucha.",
        "timeRunningOut": "Se acaba el tiempo.",
        "voteStart": "Es hora de votar.",
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
        "role_hunter": "Caçador.",
        "role_littlegirl": "Menina.",
        "role_cupid": "Cupido.",
        "role_spy": "Espião.",
        "wolvesChoose": "Lobisomens, escolham sua presa.",
        "seerChoose": "Vidente, escolha quem inspecionar.",
        "doctorChoose": "Médico, escolha quem proteger.",
        "witchHealAsk": "Bruxa — os lobos atacaram. Usar a poção de cura?",
        "witchPoisonAsk": "Bruxa — usar o veneno em alguém?",
        "cupidChoose": "Cupido, escolha dois amantes.",
        "spyChoose": "Espião, escolha quem espiar.",
        "littlegirlChoose": "Menina — espie alguém com cuidado. Se for lobo, podem te pegar.",
        "visionWolf": "é um Lobisomem.",
        "visionVillager": "NÃO é um Lobisomem.",
        "nobodyDied": "A vila acorda. Ninguém morreu esta noite.",
        "foundDead": "Encontrados mortos esta manhã.",
        "discussStart": "Discutam. Acusem. Defendan. A vila escuta.",
        "timeRunningOut": "O tempo está acabando.",
        "voteStart": "É hora de votar.",
        "eliminated": "Eliminado.",
        "survivedVote": "A vila não chegou a um acordo.",
        "hunterShot": "Caçador — escolha seu último tiro.",
        "winners_wolves": "Lobisomens vencem.",
        "winners_village": "A Vila vence.",
        "winners_lovers": "Os Amantes vencem.",
    },
}

# Deep warm dramatic campfire narrator — same character across langs; accent via prompt.
VOXCPM_VOICES = {
    "en": (
        "A deep warm mature male storyteller voice, gravelly and resonant, "
        "speaking slowly and dramatically like a campfire narrator telling a "
        "spooky village legend at night, clear American English"
    ),
    "es": (
        "A deep warm mature male storyteller voice, gravelly and resonant, "
        "speaking slowly and dramatically like a campfire narrator telling a "
        "spooky village legend at night, Latin American Spanish accent"
    ),
    "pt": (
        "A deep warm mature male storyteller voice, gravelly and resonant, "
        "speaking slowly and dramatically like a campfire narrator telling a "
        "spooky village legend at night, Brazilian Portuguese accent"
    ),
}

PIPER_VOICES = {
    "en": "en_US-norman-medium.onnx",
    "es": "es_MX-claude-high.onnx",
    "pt": "pt_BR-jeff-medium.onnx",
}

PIPER_META = {
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

VOXCPM_META = {
    "en": {
        "id": "openbmb/VoxCPM2",
        "license": "Apache-2.0",
        "quality": "48kHz voice-design",
        "voice_prompt": VOXCPM_VOICES["en"],
    },
    "es": {
        "id": "openbmb/VoxCPM2",
        "license": "Apache-2.0",
        "quality": "48kHz voice-design",
        "voice_prompt": VOXCPM_VOICES["es"],
    },
    "pt": {
        "id": "openbmb/VoxCPM2",
        "license": "Apache-2.0",
        "quality": "48kHz voice-design",
        "voice_prompt": VOXCPM_VOICES["pt"],
    },
}


def wav_to_mp3(wav: np.ndarray, sr: int, dest: Path, bitrate: str = "64k") -> None:
    """Peak-normalize, trim edge silence, encode mono MP3 atomically."""
    import soundfile as sf

    peak = float(np.max(np.abs(wav))) or 1.0
    wav_n = (wav / peak * 0.89).astype(np.float32)  # leave headroom (~-1 dBFS)
    # Trim leading/trailing near-silence in numpy (more reliable than ffmpeg silenceremove)
    thr = 0.01
    idx = np.where(np.abs(wav_n) > thr)[0]
    if len(idx):
        pad = int(0.05 * sr)
        a = max(0, int(idx[0]) - pad)
        b = min(len(wav_n), int(idx[-1]) + pad)
        wav_n = wav_n[a:b]
    if len(wav_n) < int(0.08 * sr):
        # keep a tiny pad so ffmpeg always has something to encode
        wav_n = np.pad(wav_n, (0, max(0, int(0.12 * sr) - len(wav_n))))
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = Path(tmp.name)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False, dir=str(dest.parent)) as tmpo:
        mp3_tmp = Path(tmpo.name)
    try:
        sf.write(wav_path, wav_n, sr)
        # dynaudnorm is stabler than loudnorm on very short clips
        af = "dynaudnorm=f=75:g=10:p=0.9"
        r = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(wav_path),
                "-af",
                af,
                "-ac",
                "1",
                "-ar",
                "22050",
                "-b:a",
                bitrate,
                "-codec:a",
                "libmp3lame",
                str(mp3_tmp),
            ],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0 or mp3_tmp.stat().st_size < 200:
            # fallback: no af
            r2 = subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(wav_path),
                    "-ac",
                    "1",
                    "-ar",
                    "22050",
                    "-b:a",
                    bitrate,
                    "-codec:a",
                    "libmp3lame",
                    str(mp3_tmp),
                ],
                capture_output=True,
                text=True,
            )
            if r2.returncode != 0:
                raise RuntimeError(r.stderr[-400:] + "\n" + r2.stderr[-400:])
        mp3_tmp.replace(dest)
    finally:
        wav_path.unlink(missing_ok=True)
        mp3_tmp.unlink(missing_ok=True)


def synth_piper(lang: str, text: str, dest: Path) -> None:
    model = VOICES_DIR / PIPER_VOICES[lang]
    config = Path(str(model) + ".json")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav = Path(tmp.name)
    try:
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


def run_voxcpm(only_lang: str | None, only_key: str | None, bitrate: str, seed: int = 42, force: bool = False) -> None:
    import torch
    from voxcpm import VoxCPM

    print(f"Loading VoxCPM2 from {VOXCPM_DIR} …", flush=True)
    t0 = time.time()
    model = VoxCPM.from_pretrained(
        str(VOXCPM_DIR),
        load_denoiser=False,
        device="cpu",
        optimize=False,
    )
    print(f"Loaded in {time.time() - t0:.1f}s  sample_rate={model.tts_model.sample_rate}", flush=True)

    manifest: dict = {
        "engine": "voxcpm2",
        "model": "openbmb/VoxCPM2",
        "model_license": "Apache-2.0",
        "format": "mp3",
        "bitrate": bitrate,
        "sample_rate_native": model.tts_model.sample_rate,
        "voices": VOXCPM_META,
        "keys": NARRATOR_KEYS,
        "files": {},
        "generation": {"device": "cpu", "cfg_value": 2.0, "inference_timesteps": 10},
    }

    langs = (only_lang,) if only_lang else ("en", "es", "pt")
    keys = (only_key,) if only_key else tuple(NARRATOR_KEYS)
    total_gen = 0.0
    n = 0
    for lang in langs:
        out_lang = OUT / lang
        out_lang.mkdir(parents=True, exist_ok=True)
        manifest["files"].setdefault(lang, {})
        for key in keys:
            text = TEXTS[lang][key]
            prompt = f"({VOXCPM_VOICES[lang]}){text}"
            dest = out_lang / f"{key}.mp3"
            if dest.exists() and not force and only_key is None:
                print(f"[{lang}] {key}: skip existing", flush=True)
                size = dest.stat().st_size
                manifest["files"][lang][key] = {"file": f"{key}.mp3", "bytes": size, "text": text, "skipped": True}
                continue
            print(f"[{lang}] {key}: {text}", flush=True)
            torch.manual_seed(seed)  # fixed seed for consistent narrator timbre
            t1 = time.time()
            words = len(text.replace("…", " ").replace("—", " ").split())
            steps = 14 if words <= 2 else 10
            wav = model.generate(text=prompt, cfg_value=2.0, inference_timesteps=steps)
            gen_s = time.time() - t1
            total_gen += gen_s
            n += 1
            raw_dur = len(wav) / model.tts_model.sample_rate
            peak = float(np.max(np.abs(wav))) if len(wav) else 0.0
            # Retry once if near-silent or absurdly short for multi-word lines
            min_dur = 0.35 if words <= 2 else 0.7
            if peak < 0.02 or raw_dur < min_dur:
                print(f"  retry (peak={peak:.4f} dur={raw_dur:.2f})", flush=True)
                torch.manual_seed(43)
                t1 = time.time()
                wav = model.generate(text=prompt, cfg_value=2.0, inference_timesteps=12)
                gen_s = time.time() - t1
                total_gen += gen_s
                raw_dur = len(wav) / model.tts_model.sample_rate
                peak = float(np.max(np.abs(wav))) if len(wav) else 0.0
            wav_to_mp3(wav, model.tts_model.sample_rate, dest, bitrate=bitrate)
            size = dest.stat().st_size
            manifest["files"][lang][key] = {
                "file": f"{key}.mp3",
                "bytes": size,
                "text": text,
                "gen_seconds": round(gen_s, 2),
                "raw_duration": round(raw_dur, 3),
                "peak": round(peak, 4),
            }
            print(f"  -> {size}B gen={gen_s:.1f}s raw={raw_dur:.2f}s peak={peak:.3f}", flush=True)

    # If regenerating a subset, merge with existing manifest files for other langs/keys
    existing_path = OUT / "manifest.json"
    if existing_path.exists() and (only_lang or only_key):
        try:
            old = json.loads(existing_path.read_text())
            for lang, files in old.get("files", {}).items():
                manifest["files"].setdefault(lang, {})
                for k, v in files.items():
                    if k not in manifest["files"][lang]:
                        manifest["files"][lang][k] = v
        except Exception:
            pass

    manifest["stats"] = {
        "clips": n,
        "total_gen_seconds": round(total_gen, 1),
        "avg_gen_seconds": round(total_gen / n, 2) if n else 0,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    total = sum(p.stat().st_size for p in OUT.rglob("*.mp3"))
    print(f"Done. {n} clips, gen_time={total_gen:.1f}s, total mp3={total/1024/1024:.2f} MB")


def run_piper() -> None:
    manifest: dict = {
        "engine": "piper-tts",
        "format": "mp3",
        "bitrate": "56k",
        "voices": PIPER_META,
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
            synth_piper(lang, text, dest)
            size = dest.stat().st_size
            manifest["files"][lang][key] = {"file": f"{key}.mp3", "bytes": size, "text": text}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    total = sum(p.stat().st_size for p in OUT.rglob("*.mp3"))
    print(f"Done. Total mp3 bytes: {total} ({total/1024/1024:.2f} MB)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", choices=("voxcpm", "piper"), default="voxcpm")
    ap.add_argument("--lang", choices=("en", "es", "pt"), default=None)
    ap.add_argument("--key", default=None)
    ap.add_argument("--bitrate", default="64k")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--force", action="store_true", help="Overwrite existing clips")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.engine == "voxcpm":
        run_voxcpm(args.lang, args.key, args.bitrate, seed=args.seed, force=args.force)
    else:
        run_piper()


if __name__ == "__main__":
    main()
