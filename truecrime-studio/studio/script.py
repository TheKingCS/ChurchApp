"""Step 3: write an original narration script that pairs every line with a visual."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from . import llm, media
from .jobs import Job

SCRIPT_SYSTEM = """You write original short-form true crime documentaries. Your voice is \
calm, precise and respectful: tension comes from the facts and the pacing, not from gore \
or sensational adjectives.

Hard rules:
- Every factual sentence must be supported by the dossier; list the dossier source \
numbers it relies on in source_ids. If the dossier does not support a claim, leave it out.
- Use "allegedly", "accused" or "charged with" for anyone not convicted. Never state \
guilt the courts have not established. Present disputed points as disputed.
- Treat victims and families with dignity: no graphic injury detail, no jokes, no \
speculation about their character. Do not name victims who were minors.
- Write in your own words. Do not reproduce other creators' scripts, titles or catchphrases.
- Open with a hook in the first sentence that makes the viewer want the answer.
- End with the legal outcome or the current status of the case.
- Do not invent visuals: a clip or image visual must reference a media_id you were given \
and a start_seconds you can see in that media's contact sheet. Use a "card" (a text \
title card such as a date, location or quote from a court record) when no media fits.
- Each segment is one to three sentences of narration (roughly 4 to 12 seconds spoken).
- Add a fact_check_notes entry for any claim the human reviewer should double-check.
"""


class Visual(BaseModel):
    kind: Literal["clip", "image", "card"]
    media_id: str
    start_seconds: float
    card_text: str


class Segment(BaseModel):
    narration: str
    source_ids: list[int]
    visual: Visual


class Script(BaseModel):
    title: str
    description: str
    hashtags: list[str]
    segments: list[Segment]
    fact_check_notes: list[str]


def write_script(job: Job, config: dict) -> Script:
    dossier = job.path("research", "dossier.md").read_text()
    items = [i for i in media.load_manifest(job) if i["status"] == "downloaded"]

    content: list[dict] = [{"type": "text", "text": f"# Case dossier\n\n{dossier}"}]
    if items:
        content.append({"type": "text", "text": "# Available media\nEach item below has its "
                        "metadata and a contact sheet of stills labeled with timestamps in seconds."})
    for item in items[:10]:
        jpeg, _ = media.contact_sheet(job, item)
        meta = (f"media_id={item['id']} type={item['type']} kind={item['kind']} "
                f"publisher={item['publisher']!r} duration={item.get('duration', 0):.0f}s\n"
                f"description: {item['description']}")
        content += [{"type": "text", "text": meta}, media.image_block(jpeg)]

    words = int(config["video"]["target_seconds"] * 2.5)
    content.append({"type": "text", "text":
        f"Write the script. Aim for about {words} words of narration in total. "
        "Title under 70 characters; description of 2-4 sentences ending with a line "
        "crediting the agencies whose footage is used; 5-8 hashtags without spaces."})

    with llm.client().messages.stream(
        model=config["llm"]["model"],
        max_tokens=32000,
        system=SCRIPT_SYSTEM,
        messages=[{"role": "user", "content": content}],
        output_format=Script,
        thinking={"type": "adaptive"},
        output_config={"effort": config["llm"]["effort"]},
        extra_headers=llm.FALLBACK_HEADERS,
        extra_body=llm.FALLBACK_BODY,
    ) as stream:
        message = stream.get_final_message()
    llm.check_stop(message)
    script = validate(message.parsed_output, items)
    job.write_json("script.json", script.model_dump())
    job.set_status("scripted", f"{len(script.segments)} segments")
    return script


def validate(script: Script, items: list[dict]) -> Script:
    """Downgrade any visual that points at media we don't have to a title card."""
    by_id = {i["id"]: i for i in items}
    for seg in script.segments:
        v = seg.visual
        item = by_id.get(v.media_id)
        if v.kind in ("clip", "image") and not item:
            v.kind, v.media_id = "card", ""
            v.card_text = v.card_text or seg.narration.split(".")[0][:80]
        elif item and v.kind == "clip" and item["type"] == "image":
            v.kind = "image"
        elif item:
            v.start_seconds = min(max(v.start_seconds, 0.0), max((item.get("duration") or 0) - 1, 0.0))
    return script
