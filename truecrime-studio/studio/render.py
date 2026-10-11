"""Step 4: turn the script into finished videos with ffmpeg.

Per segment: narration audio + a visual (clip, still image with slow zoom, or title card)
fitted to the frame over a blurred fill, original footage audio ducked underneath.
Segments are concatenated, then captions and source credits are burned in.
"""
from __future__ import annotations

import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from . import media, tts
from .jobs import Job

FORMATS = {"vertical": (1080, 1920), "horizontal": (1920, 1080)}
FPS = 30
TAIL = 0.35  # breathing room after each narration line


def run(cmd: list[str], cwd: Path | None = None) -> None:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {' '.join(cmd[:6])}...\n{result.stderr[-2000:]}")


def duration(path: Path) -> float:
    return float(media.ffprobe(path)["format"]["duration"])


def render_job(job: Job, config: dict) -> list[Path]:
    script = job.read_json("script.json")
    items = {i["id"]: i for i in media.load_manifest(job)}
    work = job.path("render")
    work.mkdir(parents=True, exist_ok=True)

    # Narration once, shared by every format.
    audio = []
    for n, seg in enumerate(script["segments"]):
        path = tts.synthesize(seg["narration"], work / f"narration_{n:02d}", config["tts"])
        audio.append((path, duration(path) + TAIL))

    outputs = []
    for fmt in config["video"]["formats"]:
        outputs.append(_render_format(job, script, items, audio, fmt, config))
    job.set_status("rendered", ", ".join(p.name for p in outputs))
    return outputs


def _render_format(job, script, items, audio, fmt, config) -> Path:
    w, h = FORMATS[fmt]
    work = job.path("render", fmt)
    work.mkdir(parents=True, exist_ok=True)
    vcfg = config["video"]

    parts = []
    for n, (seg, (narration, seconds)) in enumerate(zip(script["segments"], audio)):
        out = work / f"seg_{n:02d}.mp4"
        _render_segment(job, seg, items, narration, seconds, out, w, h, vcfg)
        parts.append(out)

    concat = work / "concat.txt"
    concat.write_text("".join(f"file '{p.name}'\n" for p in parts))
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "concat.txt",
         "-c", "copy", "joined.mp4"], cwd=work)

    _write_captions(work / "captions.ass", script, items, audio, w, h, vcfg)
    final = job.path(f"{job.slug}_{fmt}.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-i", "joined.mp4",
         "-vf", f"subtitles=captions.ass:fontsdir={vcfg['caption_fonts_dir']}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "copy", "-movflags", "+faststart", str(final)], cwd=work)
    return final


def _fit(w: int, h: int) -> str:
    """Fit the source inside the frame over a blurred, zoomed copy of itself."""
    return (f"split[a][b];"
            f"[a]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},boxblur=24:4,eq=brightness=-0.12[bg];"
            f"[b]scale={w}:{h}:force_original_aspect_ratio=decrease[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2")


def _render_segment(job, seg, items, narration, seconds, out, w, h, vcfg) -> None:
    visual = seg["visual"]
    item = items.get(visual["media_id"]) if visual["media_id"] else None
    frames = int(seconds * FPS)
    enc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
           "-r", str(FPS), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
           "-t", f"{seconds:.3f}", str(out)]
    narr = "aresample=48000,aformat=channel_layouts=stereo,apad"

    if visual["kind"] == "clip" and item and item.get("type") == "video":
        src = job.path("media", item["local"])
        start = visual["start_seconds"]
        # loop the source if the narration outlasts the remaining footage
        loop = ["-stream_loop", "-1"] if (item.get("duration") or 0) - start < seconds else []
        vol = vcfg["source_audio_volume"]
        if item.get("has_audio") and vol > 0:
            audio = (f"[0:a]aresample=48000,aformat=channel_layouts=stereo,volume={vol}[src];"
                     f"[1:a]{narr}[nar];[nar][src]amix=inputs=2:duration=first:normalize=0[aout]")
        else:
            audio = f"[1:a]{narr}[aout]"
        graph = f"[0:v]{_fit(w, h)},fps={FPS},setsar=1,format=yuv420p[vout];{audio}"
        run(["ffmpeg", "-v", "error", "-y", *loop, "-ss", f"{start:.2f}", "-i", str(src),
             "-i", str(narration), "-filter_complex", graph, "-map", "[vout]", "-map", "[aout]", *enc])
        return

    if visual["kind"] == "image" and item and item.get("type") == "image":
        still = job.path("media", item["local"])
    else:
        still = out.with_suffix(".png")
        _title_card(still, visual["card_text"] or seg["narration"], w, h, vcfg["font"])

    # Slow push-in on stills (Ken Burns); title cards get a gentler one.
    rate = 0.0006 if visual["kind"] == "image" else 0.0002
    graph = (f"[0:v]{_fit(w, h)},scale={w * 2}:{h * 2},"
             f"zoompan=z='min(1+{rate}*on,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
             f":d={frames}:s={w}x{h}:fps={FPS},setsar=1,format=yuv420p[vout];[1:a]{narr}[aout]")
    run(["ffmpeg", "-v", "error", "-y", "-i", str(still), "-i", str(narration),
         "-filter_complex", graph, "-map", "[vout]", "-map", "[aout]", *enc])


def _title_card(path: Path, text: str, w: int, h: int, font_path: str) -> None:
    img = Image.new("RGB", (w, h), (12, 12, 16))
    draw = ImageDraw.Draw(img)
    size = int(min(w, h) * 0.075)
    try:
        font = ImageFont.truetype(font_path, size)
    except OSError:
        font = ImageFont.load_default(size=size)
    lines = textwrap.wrap(text, width=18 if w < h else 32)[:6]
    line_h = int(size * 1.3)
    y = (h - line_h * len(lines)) // 2
    draw.rectangle([w * 0.08, y - line_h * 0.6, w * 0.08 + 12, y + line_h * len(lines)], fill=(200, 30, 40))
    for line in lines:
        draw.text((w * 0.08 + 48, y), line, font=font, fill=(240, 240, 240))
        y += line_h
    img.save(path)


# ---------------------------------------------------------------- captions

def _ass_time(t: float) -> str:
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def _ass_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", " ")


def _chunks(text: str, max_words: int = 4) -> list[str]:
    words = text.split()
    return [" ".join(words[i:i + max_words]) for i in range(0, len(words), max_words)]


def _write_captions(path: Path, script, items, audio, w, h, vcfg) -> None:
    vertical = h > w
    size = 78 if vertical else 64
    margin_v = int(h * (0.23 if vertical else 0.08))
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{vcfg['caption_font_name']},{size},&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,5,2,2,60,60,{margin_v},1
Style: Credit,{vcfg['caption_font_name']},{int(size * 0.5)},&H00DDDDDD,&H000000FF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,3,2,0,7,40,40,{int(h * 0.06)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    t = 0.0
    for seg, (narration, seconds) in zip(script["segments"], audio):
        spoken = seconds - TAIL
        chunks = _chunks(seg["narration"])
        total_chars = sum(len(c) for c in chunks) or 1
        ct = t
        for c in chunks:  # time each chunk by its share of the characters
            d = spoken * len(c) / total_chars
            events.append(f"Dialogue: 0,{_ass_time(ct)},{_ass_time(ct + d)},Caption,,0,0,0,,{_ass_escape(c.upper())}")
            ct += d
        item = items.get(seg["visual"]["media_id"]) if seg["visual"]["kind"] != "card" else None
        if item:
            credit = f"Footage: {item.get('publisher') or item.get('channel') or 'source'}"
            events.append(f"Dialogue: 1,{_ass_time(t)},{_ass_time(t + seconds)},Credit,,0,0,0,,{_ass_escape(credit)}")
        t += seconds
    path.write_text(header + "\n".join(events) + "\n")
