"""Step 1: research the case on the web and turn the findings into a structured case file."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from . import llm
from .jobs import Job

RESEARCH_SYSTEM = """You are the research desk for a true crime documentary channel. \
You build accurate, sourced case dossiers that a scriptwriter will turn into an original video.

Rules:
- Prefer primary and authoritative sources: court records and filings, police and \
prosecutor press releases, government sites, and established news organizations. \
Use Wikipedia only as a map to better sources.
- Never rely on other true crime creators' videos or posts as a source of facts.
- Keep a clear line between what is established (convictions, court findings, \
official statements) and what is alleged, disputed or unknown. Note the current legal \
status of every suspect: charged, convicted, acquitted, deceased, never charged.
- Flag anyone who was a minor at the time.
- Find OFFICIAL media releases tied to the case: body-worn and dash camera footage, \
911 audio, interview or interrogation recordings, surveillance stills, booking photos \
and court video that a police department, prosecutor, court or government agency \
published itself (its own website or its own verified YouTube/Facebook channel). \
Record the exact URL of the agency's own upload and who published it. News outlets \
re-hosting agency footage are acceptable only when you cannot find the original.
"""

RESEARCH_PROMPT = """Research this case and write a dossier.

Case: {case}
Producer notes: {notes}

Write the dossier in Markdown with these sections:
1. Overview (5 sentences)
2. Timeline (dated bullet points)
3. People (name, role, legal status, minor yes/no)
4. Investigation and evidence
5. Legal outcome and current status
6. Open questions and disputed points
7. Official media releases (one bullet each: URL, publisher, what it shows, date)
8. Sources (numbered list: [n] title - publisher - URL)

Cite sources inline as [n] after every factual claim."""


class Person(BaseModel):
    name: str
    role: str
    legal_status: str
    was_minor: bool


class Source(BaseModel):
    id: int
    title: str
    publisher: str
    url: str


class MediaCandidate(BaseModel):
    url: str
    publisher: str
    kind: Literal["bodycam", "dashcam", "911_audio", "interrogation", "surveillance",
                  "court_video", "photo", "press_conference", "other"]
    description: str
    official_release: bool


class CaseFile(BaseModel):
    case_title: str
    summary: str
    legal_status: str
    people: list[Person]
    sources: list[Source]
    media_candidates: list[MediaCandidate]


def run_research(job: Job, config: dict) -> str:
    cfg = config["llm"]
    tools = [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": cfg["max_searches"]},
        {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": cfg["max_searches"]},
    ]
    messages = [{"role": "user", "content": RESEARCH_PROMPT.format(case=job.case, notes=job.notes or "none")}]

    # Server-side tools run in a loop on Anthropic's side; a long run comes back as
    # pause_turn and is resumed by re-sending the conversation unchanged.
    for _ in range(6):
        with llm.client().messages.stream(
            model=cfg["model"],
            max_tokens=64000,
            system=RESEARCH_SYSTEM,
            messages=messages,
            tools=tools,
            thinking={"type": "adaptive"},
            output_config={"effort": cfg["effort"]},
            extra_headers=llm.FALLBACK_HEADERS,
            extra_body=llm.FALLBACK_BODY,
        ) as stream:
            message = stream.get_final_message()
        if message.stop_reason != "pause_turn":
            break
        messages = [messages[0], {"role": "assistant", "content": message.content}]
    llm.check_stop(message)

    dossier = llm.text_of(message).strip()
    job.path("research").mkdir(parents=True, exist_ok=True)
    job.path("research", "dossier.md").write_text(dossier)

    casefile = extract_casefile(dossier, config)
    job.write_json("research/casefile.json", casefile.model_dump())
    job.set_status("researched", f"{len(casefile.sources)} sources, {len(casefile.media_candidates)} media leads")
    return dossier


def extract_casefile(dossier: str, config: dict) -> CaseFile:
    response = llm.client().messages.parse(
        model=config["llm"]["model"],
        max_tokens=16000,
        output_config={"effort": "low"},
        messages=[{
            "role": "user",
            "content": "Convert this dossier into the structured case file. Copy URLs exactly; "
                       "do not add anything that is not in the dossier. Mark official_release true "
                       "only when the publisher is the agency, prosecutor or court itself.\n\n" + dossier,
        }],
        output_format=CaseFile,
        extra_headers=llm.FALLBACK_HEADERS,
        extra_body=llm.FALLBACK_BODY,
    )
    llm.check_stop(response)
    return response.parsed_output
