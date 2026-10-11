"""Configuration: built-in defaults overlaid with an optional config.toml."""
from __future__ import annotations

import os
import tomllib
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = PACKAGE_DIR.parent


def _merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config(path: str | Path | None = None) -> dict:
    with open(PACKAGE_DIR / "default_config.toml", "rb") as f:
        config = tomllib.load(f)
    path = Path(path or os.environ.get("STUDIO_CONFIG") or PROJECT_DIR / "config.toml")
    if path.exists():
        with open(path, "rb") as f:
            config = _merge(config, tomllib.load(f))
    return config


def data_dir() -> Path:
    d = Path(os.environ.get("STUDIO_DATA") or PROJECT_DIR / "data")
    d.mkdir(parents=True, exist_ok=True)
    return d
