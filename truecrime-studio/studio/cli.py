"""Command line: `studio run "Case name"` does everything up to the review queue."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from . import media
from .config import data_dir, load_config
from .jobs import create_job, list_jobs, load_job


def cmd_new(a, cfg):
    job = create_job(a.case, a.notes or "")
    print(job.slug)
    return job


def cmd_research(a, cfg):
    from .research import run_research

    job = load_job(a.slug)
    print(f"Researching {job.case!r} (web search; this takes a few minutes)...")
    run_research(job, cfg)
    media.seed_from_casefile(job)
    print(f"Dossier: {job.path('research', 'dossier.md')}")


def cmd_media(a, cfg):
    job = load_job(a.slug)
    if a.action == "add":
        if Path(a.target).exists():
            item = media.add_local(job, Path(a.target), a.publisher or "", a.description or "")
        else:
            item = media.add_candidate(job, a.target, a.publisher or "", "other", a.description or "")
        print(f"Added {item['id']}: {item['url']}")
    elif a.action == "fetch":
        media.fetch(job, cfg["media"])
    elif a.action == "approve":
        if not a.target:
            raise SystemExit("Usage: studio media approve <slug> <id>[,<id>...]")
        media.fetch(job, cfg["media"], approve_ids=set(a.target.split(",")))
    items = media.load_manifest(job)
    for i in items:
        extra = i.get("error") or i.get("provenance") or ""
        print(f"  {i['id']:>4}  {i['status']:<10} {i['kind']:<14} {i['publisher'][:30]:<30} {extra}")
        print(f"        {i['url']}")
    if any(i["status"] == "downloaded" for i in items) and job.status == "researched":
        job.set_status("media_ready", f"{sum(i['status'] == 'downloaded' for i in items)} files")


def cmd_script(a, cfg):
    from .script import write_script

    job = load_job(a.slug)
    script = write_script(job, cfg)
    print(f"{script.title}  ({len(script.segments)} segments)")
    for note in script.fact_check_notes:
        print(f"  check: {note}")


def cmd_render(a, cfg):
    from .render import render_job

    job = load_job(a.slug)
    for path in render_job(job, cfg):
        print(path)


def cmd_run(a, cfg):
    job = cmd_new(a, cfg)
    a.slug = job.slug
    cmd_research(a, cfg)
    a.action, a.target = "fetch", None
    cmd_media(a, cfg)
    cmd_script(a, cfg)
    cmd_render(a, cfg)
    print(f"\nReady for review: studio review  (job {job.slug})")


def cmd_list(a, cfg):
    for j in list_jobs():
        print(f"{j.slug:<40} {j.status:<12} {j.updated}  {j.case}")


def cmd_review(a, cfg):
    from .review.app import create_app

    create_app(cfg).run(host=a.host, port=a.port, debug=False)


def main(argv=None):
    p = argparse.ArgumentParser(prog="studio", description=__doc__)
    p.add_argument("--config", help="path to config.toml")
    sub = p.add_subparsers(dest="cmd", required=True)

    for name, fn in [("new", cmd_new), ("run", cmd_run)]:
        s = sub.add_parser(name, help="create a job" if name == "new" else "research -> media -> script -> render")
        s.add_argument("case", help='case name, e.g. "The murder of ... (2019)"')
        s.add_argument("--notes", help="angle, facts to emphasise, sources to start from")
        s.set_defaults(fn=fn)
    for name, fn, h in [("research", cmd_research, "web research + case file"),
                        ("script", cmd_script, "write the narration script"),
                        ("render", cmd_render, "build the video files")]:
        s = sub.add_parser(name, help=h)
        s.add_argument("slug")
        s.set_defaults(fn=fn)

    s = sub.add_parser("media", help="list, fetch, add or approve media")
    s.add_argument("action", choices=["list", "fetch", "add", "approve"])
    s.add_argument("slug")
    s.add_argument("target", nargs="?", help="URL or file for add; ids for approve")
    s.add_argument("--publisher", help="who published it (shown as the on-screen credit)")
    s.add_argument("--description")
    s.set_defaults(fn=cmd_media)

    sub.add_parser("list", help="list jobs").set_defaults(fn=cmd_list)
    s = sub.add_parser("review", help="open the review queue web UI")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8765)
    s.set_defaults(fn=cmd_review)

    a = p.parse_args(argv)
    cfg = load_config(a.config)
    a.fn(a, cfg)


def approve_to_outbox(job, note: str = "") -> Path:
    """Copy an approved job's videos and post metadata to data/outbox/<slug>/."""
    script = job.read_json("script.json")
    out = data_dir() / "outbox" / job.slug
    out.mkdir(parents=True, exist_ok=True)
    videos = sorted(job.dir.glob(f"{job.slug}_*.mp4"))
    for v in videos:
        shutil.copy2(v, out / v.name)
    casefile = job.read_json("research/casefile.json", {})
    job.write_json("post.json", {
        "title": script["title"],
        "description": script["description"],
        "hashtags": script["hashtags"],
        "videos": [v.name for v in videos],
        "sources": casefile.get("sources", []),
        "media_credits": [
            {"publisher": i["publisher"], "url": i["url"], "provenance": i["provenance"]}
            for i in media.load_manifest(job) if i["status"] == "downloaded"
        ],
        "review_note": note,
    })
    shutil.copy2(job.path("post.json"), out / "post.json")
    return out


if __name__ == "__main__":
    main()
