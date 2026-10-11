"""Step 2: gather case media from official sources, with provenance for every file.

Auto-download happens only for allowlisted publishers (config [media]). Every other
lead stays a candidate until a person approves it with `studio media approve`.
"""
from __future__ import annotations

import base64
import io
import json
import subprocess
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image, ImageDraw, ImageFont

from .jobs import Job, now

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MANIFEST = "media/manifest.json"


# ---------------------------------------------------------------- manifest

def load_manifest(job: Job) -> list[dict]:
    return job.read_json(MANIFEST, [])


def save_manifest(job: Job, items: list[dict]) -> None:
    job.write_json(MANIFEST, items)


def add_candidate(job: Job, url: str, publisher: str = "", kind: str = "other",
                  description: str = "", official: bool = False) -> dict:
    items = load_manifest(job)
    for item in items:
        if item["url"] == url:
            return item
    item = {
        "id": f"m{len(items) + 1}",
        "url": url,
        "publisher": publisher,
        "kind": kind,
        "description": description,
        "official_release": official,
        "status": "candidate",          # candidate | downloaded | failed | skipped
        "provenance": "",               # allowlisted | approved_by_user
        "added": now(),
    }
    items.append(item)
    save_manifest(job, items)
    return item


def seed_from_casefile(job: Job) -> None:
    casefile = job.read_json("research/casefile.json", {})
    for c in casefile.get("media_candidates", []):
        add_candidate(job, c["url"], c["publisher"], c["kind"], c["description"], c["official_release"])


# ---------------------------------------------------------------- allowlist

def host_allowed(url: str, cfg: dict) -> bool:
    host = (urlparse(url).hostname or "").lower()
    if any(host == d or host.endswith("." + d) for d in cfg["allowed_domains"]):
        return True
    return any(host.endswith(s) for s in cfg["allowed_domain_suffixes"])


def channel_allowed(info: dict, cfg: dict) -> bool:
    allowed = {c.lower().rstrip("/") for c in cfg["allowed_channels"]}
    if not allowed:
        return False
    ids = [info.get(k) for k in ("channel_id", "uploader_id", "channel_url", "uploader_url", "channel")]
    ids = {str(i).lower().rstrip("/") for i in ids if i}
    # match "@Handle" against ".../@Handle" URLs too
    ids |= {i.rsplit("/", 1)[-1] for i in ids}
    return bool(ids & allowed)


# ---------------------------------------------------------------- fetching

def fetch(job: Job, cfg: dict, approve_ids: set[str] | None = None) -> list[dict]:
    """Download allowlisted candidates, plus any ids the user explicitly approved."""
    items = load_manifest(job)
    out_dir = job.path("media")
    out_dir.mkdir(parents=True, exist_ok=True)
    for item in items:
        if item["status"] == "downloaded":
            continue
        approved = approve_ids is not None and item["id"] in approve_ids
        if item["status"] != "candidate" and not approved:
            continue
        try:
            _fetch_one(item, out_dir, cfg, approved)
        except Exception as exc:  # keep going; the review page shows the error
            item["status"], item["error"] = "failed", str(exc)[:500]
        save_manifest(job, items)
    return items


def _fetch_one(item: dict, out_dir: Path, cfg: dict, approved: bool) -> None:
    url = item["url"]
    ext = Path(urlparse(url).path).suffix.lower()
    if ext in IMAGE_EXTS:
        if not (approved or host_allowed(url, cfg)):
            return  # stays a candidate
        dest = out_dir / f"{item['id']}{ext}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 truecrime-studio"})
        with urllib.request.urlopen(req, timeout=60) as r:
            dest.write_bytes(r.read())
        item.update(type="image", local=dest.name, status="downloaded",
                    provenance="approved_by_user" if approved else "allowlisted")
        _describe(item, dest)
        return

    import yt_dlp

    opts = {"quiet": True, "no_warnings": True, "noplaylist": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    item["title"] = info.get("title", "")
    item["channel"] = info.get("channel") or info.get("uploader") or ""
    item["channel_url"] = info.get("channel_url") or info.get("uploader_url") or ""
    allowed = host_allowed(url, cfg) or channel_allowed(info, cfg)
    if not (approved or allowed):
        return  # stays a candidate until a person approves it
    duration = info.get("duration") or 0
    if duration > cfg["max_clip_minutes"] * 60:
        item.update(status="skipped", error=f"longer than {cfg['max_clip_minutes']} min; raise max_clip_minutes to allow")
        return

    h = cfg["max_height"]
    opts.update({
        "outtmpl": str(out_dir / f"{item['id']}.%(ext)s"),
        "format": f"bv*[height<={h}]+ba/b[height<={h}]/b",
        "merge_output_format": "mp4",
    })
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        path = Path(ydl.prepare_filename(info)).with_suffix(".mp4")
    if not path.exists():  # merge may keep original extension
        path = next(out_dir.glob(f"{item['id']}.*"))
    item.update(type="video", local=path.name, status="downloaded",
                provenance="approved_by_user" if approved else "allowlisted")
    _describe(item, path)


def _describe(item: dict, path: Path) -> None:
    probe = ffprobe(path)
    item["duration"] = float(probe.get("format", {}).get("duration") or 0)
    item["has_audio"] = any(s.get("codec_type") == "audio" for s in probe.get("streams", []))
    v = next((s for s in probe.get("streams", []) if s.get("codec_type") == "video"), {})
    item["width"], item["height"] = v.get("width"), v.get("height")


def ffprobe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def add_local(job: Job, file: Path, publisher: str, description: str) -> dict:
    """Register a file you already have (e.g. from a public records request)."""
    item = add_candidate(job, f"file://{file.resolve()}", publisher, "other", description, True)
    dest = job.path("media", f"{item['id']}{file.suffix.lower()}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(file.read_bytes())
    items = load_manifest(job)
    for it in items:
        if it["id"] == item["id"]:
            it.update(type="image" if file.suffix.lower() in IMAGE_EXTS else "video",
                      local=dest.name, status="downloaded", provenance="approved_by_user")
            _describe(it, dest)
            item = it
    save_manifest(job, items)
    return item


# ---------------------------------------------------------------- previews for the scriptwriter

def contact_sheet(job: Job, item: dict, frames: int = 12) -> tuple[bytes, list[float]]:
    """A grid of timestamped stills so the model can choose which moments to show."""
    path = job.path("media", item["local"])
    if item["type"] == "image":
        img = Image.open(path).convert("RGB")
        img.thumbnail((1024, 1024))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=80)
        return buf.getvalue(), [0.0]

    duration = max(item.get("duration") or 1, 1)
    times = [round(duration * (i + 0.5) / frames, 1) for i in range(frames)]
    tile_w, tile_h, cols = 320, 180, 4
    rows = (len(times) + cols - 1) // cols
    sheet = Image.new("RGB", (tile_w * cols, tile_h * rows), "black")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=22)
    for i, t in enumerate(times):
        png = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", str(t), "-i", str(path), "-frames:v", "1",
             "-vf", f"scale={tile_w}:{tile_h}:force_original_aspect_ratio=decrease,pad={tile_w}:{tile_h}:-1:-1",
             "-f", "image2pipe", "-vcodec", "png", "-"],
            capture_output=True,
        ).stdout
        if png:
            sheet.paste(Image.open(io.BytesIO(png)), ((i % cols) * tile_w, (i // cols) * tile_h))
        x, y = (i % cols) * tile_w + 6, (i // cols) * tile_h + 4
        draw.rectangle([x - 4, y - 2, x + 80, y + 26], fill="black")
        draw.text((x, y), f"{t:.1f}s", fill="yellow", font=font)
    buf = io.BytesIO()
    sheet.save(buf, "JPEG", quality=75)
    return buf.getvalue(), times


def image_block(jpeg: bytes) -> dict:
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                        "data": base64.b64encode(jpeg).decode()}}
