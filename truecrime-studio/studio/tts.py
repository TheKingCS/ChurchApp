"""Narration voice. Each backend writes an audio file for one segment."""
from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path


def synthesize(text: str, out: Path, cfg: dict) -> Path:
    backend = cfg["backend"]
    if backend == "edge":
        import edge_tts

        out = out.with_suffix(".mp3")
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")  # aiohttp ignores env proxies
        asyncio.run(edge_tts.Communicate(text, cfg["voice"], rate=cfg["rate"], proxy=proxy).save(str(out)))
        return out
    if backend == "silent":  # for tests and dry runs: silence at a natural speaking pace
        out = out.with_suffix(".wav")
        seconds = max(1.5, len(text.split()) / 2.6)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                        "anullsrc=r=48000:cl=stereo", "-t", f"{seconds:.2f}", str(out)], check=True)
        return out
    raise ValueError(f"Unknown TTS backend {backend!r} (use 'edge' or 'silent')")
