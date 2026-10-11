"""A job is one case on its way to a video. Everything lives in data/jobs/<slug>/."""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .config import data_dir

# new -> researched -> media_ready -> scripted -> rendered -> approved | rejected
STATUSES = ["new", "researched", "media_ready", "scripted", "rendered", "approved", "rejected"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "case"


@dataclass
class Job:
    slug: str
    case: str
    notes: str = ""
    status: str = "new"
    created: str = field(default_factory=now)
    updated: str = field(default_factory=now)
    review_notes: str = ""
    history: list[dict] = field(default_factory=list)

    @property
    def dir(self) -> Path:
        return jobs_dir() / self.slug

    def path(self, *parts: str) -> Path:
        return self.dir.joinpath(*parts)

    def set_status(self, status: str, note: str = "") -> None:
        assert status in STATUSES, status
        self.status = status
        self.history.append({"at": now(), "status": status, "note": note})
        self.save()

    def save(self) -> None:
        self.updated = now()
        self.dir.mkdir(parents=True, exist_ok=True)
        self.path("job.json").write_text(json.dumps(asdict(self), indent=2))

    def read_json(self, name: str, default=None):
        p = self.path(name)
        return json.loads(p.read_text()) if p.exists() else default

    def write_json(self, name: str, data) -> None:
        p = self.path(name)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2))


def jobs_dir() -> Path:
    d = data_dir() / "jobs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def create_job(case: str, notes: str = "") -> Job:
    base = slugify(case)
    slug, n = base, 2
    while (jobs_dir() / slug).exists():
        slug, n = f"{base}-{n}", n + 1
    job = Job(slug=slug, case=case, notes=notes)
    job.set_status("new", "created")
    return job


def load_job(slug: str) -> Job:
    p = jobs_dir() / slug / "job.json"
    if not p.exists():
        raise SystemExit(f"No job named {slug!r}. Run `studio list` to see jobs.")
    return Job(**json.loads(p.read_text()))


def list_jobs() -> list[Job]:
    jobs = [Job(**json.loads(p.read_text())) for p in jobs_dir().glob("*/job.json")]
    return sorted(jobs, key=lambda j: j.updated, reverse=True)
