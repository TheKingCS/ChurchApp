"""Review queue: watch each render, check the script against its sources, approve or reject."""
from __future__ import annotations

from flask import Flask, abort, redirect, render_template, request, send_from_directory, url_for

from .. import media
from ..cli import approve_to_outbox
from ..jobs import list_jobs, load_job


def create_app(config: dict) -> Flask:
    app = Flask(__name__)

    @app.get("/")
    def index():
        jobs = list_jobs()
        waiting = [j for j in jobs if j.status == "rendered"]
        return render_template("index.html", jobs=jobs, waiting=waiting)

    @app.get("/job/<slug>")
    def job(slug):
        j = load_job(slug)
        script = j.read_json("script.json")
        casefile = j.read_json("research/casefile.json", {})
        sources = {s["id"]: s for s in casefile.get("sources", [])}
        videos = sorted(p.name for p in j.dir.glob(f"{j.slug}_*.mp4"))
        return render_template("job.html", job=j, script=script, casefile=casefile, sources=sources,
                               items=media.load_manifest(j), videos=videos)

    @app.get("/job/<slug>/file/<path:name>")
    def file(slug, name):
        j = load_job(slug)
        if name not in {p.name for p in j.dir.glob("*.mp4")} | {"research/dossier.md"}:
            abort(404)
        return send_from_directory(j.dir, name)

    @app.post("/job/<slug>/decide")
    def decide(slug):
        j = load_job(slug)
        note = request.form.get("note", "").strip()
        j.review_notes = note
        if request.form["decision"] == "approve":
            if j.status != "rendered":
                abort(400, "Only rendered videos can be approved.")
            approve_to_outbox(j, note)
            j.set_status("approved", note)
        else:
            j.set_status("rejected", note)
        return redirect(url_for("index"))

    return app
