# True Crime Studio (MVP)

Turns a case name into an original, narrated, captioned short video, then holds it in a
review queue until a person approves it.

```
studio run "The disappearance of ... (2021)"
   │
   ├─ 1. research   Claude searches the web → research/dossier.md + casefile.json
   │                (timeline, people, legal status, numbered sources, official media leads)
   ├─ 2. media      downloads official releases (bodycam, dashcam, 911 audio, interrogation,
   │                court video, photos) from allowlisted publishers, with provenance
   ├─ 3. script     Claude looks at the dossier + timestamped stills of every clip and writes
   │                an original script: narration, cited sources, and which clip/moment to show
   ├─ 4. render     voiceover, 9:16 and/or 16:9 video, captions, on-screen footage credits
   └─ 5. review     web UI: watch, check every line against its sources, approve → outbox
```

## Setup

```bash
cd truecrime-studio
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
export ANTHROPIC_API_KEY=...        # or `ant auth login`
cp studio/default_config.toml config.toml   # then edit
```

Requires `ffmpeg`/`ffprobe` on PATH.

## Use

```bash
studio run "Case name" --notes "angle, or sources to start from"   # everything up to review
studio review                                                       # http://127.0.0.1:8765
```

Or step by step:

```bash
studio new "Case name"            # prints the job slug
studio research <slug>
studio media list <slug>          # leads found by research, and their status
studio media fetch <slug>         # download the allowlisted ones
studio media approve <slug> m3,m5 # you checked these are official releases: download them
studio media add <slug> <url-or-file> --publisher "Phoenix Police Department"
studio script <slug>
studio render <slug>
studio list
```

Approved videos land in `data/outbox/<slug>/` with `post.json` (title, description,
hashtags, sources, media credits), ready for the posting step.

## Where media comes from

Only **official releases** are used: footage and photos that a police department,
sheriff, prosecutor, court or government agency published itself. Media is downloaded
automatically only when it comes from a publisher in `config.toml`:

```toml
[media]
allowed_domain_suffixes = [".gov", ".mil"]
allowed_domains = ["nypdnews.com"]
allowed_channels = ["@PhoenixPolice", "UCxxxxxxxxxxxxxxxxxxxxxx"]  # agency YouTube/Facebook channels
```

Everything else the research finds stays a *candidate* until you run
`studio media approve`. Every file records where it came from and how it was cleared,
and the video shows a "Footage: <agency>" credit while it is on screen.
Footage you got through a public records request can be added with `studio media add`.

Do not add other creators' reels or compilations. Their edits are their copyright, and
platforms down-rank or demonetise re-uploaded content.

## Voice

`[tts] backend = "edge"` uses Microsoft's free neural voices via `edge-tts` (voice list:
`edge-tts --list-voices`). `"silent"` is for testing without a voice.

## Tests

```bash
pytest   # offline: synthetic media, silent narration, renders both formats, exercises the review UI
```

## Not built yet

- Posting to YouTube / Facebook / Instagram / TikTok on a schedule from the outbox
- Feed watching to suggest which cases to cover
- Word-level caption timing (captions are currently timed by character count)
