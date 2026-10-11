"""Offline tests: no API calls, silent narration, synthetic media."""
import subprocess

import pytest

from studio import media
from studio.config import load_config
from studio.jobs import create_job, load_job
from studio.script import Script, Segment, Visual, validate


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDIO_DATA", str(tmp_path / "data"))
    cfg = load_config(tmp_path / "missing.toml")
    cfg["tts"]["backend"] = "silent"
    cfg["video"]["formats"] = ["vertical", "horizontal"]
    return tmp_path, cfg


def make_media(job, tmp_path):
    clip = tmp_path / "clip.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=6",
                    "-f", "lavfi", "-i", "sine=f=440:d=6", "-shortest", "-pix_fmt", "yuv420p", str(clip)], check=True)
    still = tmp_path / "photo.png"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=800x600:d=1",
                    "-frames:v", "1", str(still)], check=True)
    v = media.add_local(job, clip, "Example Police Department", "body camera")
    i = media.add_local(job, still, "Example County Sheriff", "scene photo")
    return v, i


def test_allowlist():
    cfg = {"allowed_domains": ["phoenix.gov", "nypdnews.com"], "allowed_domain_suffixes": [".gov"],
           "allowed_channels": ["@PhoenixPolice", "UC123"]}
    assert media.host_allowed("https://www.fbi.gov/news/x.mp4", cfg)
    assert media.host_allowed("https://nypdnews.com/clip", cfg)
    assert not media.host_allowed("https://evilgov.com/clip", cfg)
    assert not media.host_allowed("https://www.instagram.com/reel/abc", cfg)
    assert media.channel_allowed({"uploader_url": "https://www.youtube.com/@PhoenixPolice"}, cfg)
    assert media.channel_allowed({"channel_id": "UC123"}, cfg)
    assert not media.channel_allowed({"channel_id": "UC999", "channel": "Crime Recaps"}, cfg)


def test_validate_drops_unknown_media():
    s = Script(title="t", description="d", hashtags=[], fact_check_notes=[], segments=[
        Segment(narration="It began at night. More.", source_ids=[1],
                visual=Visual(kind="clip", media_id="m9", start_seconds=3, card_text="")),
        Segment(narration="Later.", source_ids=[1],
                visual=Visual(kind="clip", media_id="m1", start_seconds=99, card_text="")),
    ])
    out = validate(s, [{"id": "m1", "type": "video", "duration": 10}])
    assert out.segments[0].visual.kind == "card" and out.segments[0].visual.card_text == "It began at night"
    assert out.segments[1].visual.start_seconds == 9


def test_render_and_review(env):
    tmp_path, cfg = env
    from studio.render import render_job

    job = create_job("Test Case (2020)")
    v, i = make_media(job, tmp_path)
    job.write_json("research/casefile.json", {"legal_status": "convicted", "sources": [
        {"id": 1, "title": "Press release", "publisher": "Example PD", "url": "https://example.gov/pr"}],
        "media_candidates": []})
    job.path("research", "dossier.md").write_text("# dossier")
    job.write_json("script.json", {
        "title": "The Night Shift", "description": "A case.", "hashtags": ["#truecrime"],
        "fact_check_notes": ["Confirm the date."],
        "segments": [
            {"narration": "On a quiet night in March, one call changed everything.", "source_ids": [1],
             "visual": {"kind": "card", "media_id": "", "start_seconds": 0, "card_text": "March 3, 2020 - Example City"}},
            {"narration": "Officers arrived within minutes, cameras rolling, and found the door open.",
             "source_ids": [1], "visual": {"kind": "clip", "media_id": v["id"], "start_seconds": 4, "card_text": ""}},
            {"narration": "The scene photo shows how little had been disturbed.", "source_ids": [1],
             "visual": {"kind": "image", "media_id": i["id"], "start_seconds": 0, "card_text": ""}},
        ]})
    job.set_status("scripted")

    outputs = render_job(job, cfg)
    assert [p.name for p in outputs] == ["test-case-2020_vertical.mp4", "test-case-2020_horizontal.mp4"]
    for p, size in zip(outputs, [(1080, 1920), (1920, 1080)]):
        probe = media.ffprobe(p)
        video = next(s for s in probe["streams"] if s["codec_type"] == "video")
        assert (video["width"], video["height"]) == size
        assert any(s["codec_type"] == "audio" for s in probe["streams"])
        assert float(probe["format"]["duration"]) > 8
    assert "Footage: Example Police Department" in job.path("render", "vertical", "captions.ass").read_text()

    # contact sheet for the scriptwriter
    jpeg, times = media.contact_sheet(job, media.load_manifest(job)[0])
    assert jpeg[:2] == b"\xff\xd8" and len(times) == 12

    from studio.review.app import create_app
    client = create_app(cfg).test_client()
    assert b"Test Case (2020)" in client.get("/").data
    page = client.get(f"/job/{job.slug}").data
    assert b"Confirm the date." in page and b"Example County Sheriff" in page
    assert client.get(f"/job/{job.slug}/file/{outputs[0].name}").status_code == 200
    assert client.get(f"/job/{job.slug}/file/job.json").status_code == 404
    r = client.post(f"/job/{job.slug}/decide", data={"decision": "approve", "note": "checked"})
    assert r.status_code == 302
    assert load_job(job.slug).status == "approved"
    outbox = tmp_path / "data" / "outbox" / job.slug
    assert (outbox / "post.json").exists() and (outbox / outputs[0].name).exists()
