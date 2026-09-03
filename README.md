# Order Of Service

A simple, TV-friendly app for planning and presenting your church's order of
service — notes, songs with lyrics, pictures, and music, arranged into a
slideshow you can display on the church's TVs and drive from a phone.

## How it works

- **Dashboard** (`/`) — a header reading "Order Of Service" with a tile grid.
  A dashed **+** tile creates a new service; every saved service becomes its
  own tile showing its title, the date it was created, and icons for what it
  contains. Hover a tile for quick actions: present, edit, remote control, or
  delete.
- **Builder** (`/service/new`, `/service/[id]/edit`) — add items to the
  service one at a time: **Notes** (plain text, e.g. announcements or
  prayers), **Picture** (upload an image), **Ambient Music** (an audio file,
  with an optional loop for background music), **Song**, **Countdown**
  (a pre-service timer with a message when it ends), or **Scripture**
  (type a reference and look up the verse text automatically). Reorder items
  with the up/down arrows, then give the whole thing a title and save — the
  date is recorded automatically. A **Duplicate** button on each dashboard
  tile clones a past service as a starting point for next time.
- **Songs** are built as a sequence of slides — one per verse, chorus, etc.
  — each with its own lyrics and an optional picture. Because each section
  is its own slide in the running order, a worship leader can repeat any
  verse or chorus mid-service just by clicking back to it, rather than
  following a fixed timeline. Songs are saved to a shared library and can be
  reused from a dropdown in the Song editor instead of retyping lyrics for
  every service. The editor also has an **Import from audio + lyrics**
  tool: upload an optional practice track, paste the full lyrics, and it
  splits them into slides at blank lines (a line like "Verse 1" or "Chorus"
  on its own is picked up as that slide's label).
- **Presenter** (`/service/[id]/present`) — a fullscreen, click-through
  slideshow meant to be opened in the browser on the church's TV (or cast to
  it). Advance with a click, the arrow keys, or spacebar; audio/backing
  tracks play automatically when their slide comes up. Song slides show only
  the lyrics — no clutter from internal labels.
- **Remote Control** (`/service/[id]/control`) — open this on a phone or
  tablet on the same network to drive the Presenter page from the sound
  booth: tap any item to jump to it, or use the prev/next buttons, with a
  preview of what's coming up next. It syncs with the TV a couple of times a
  second, so whichever device changes the slide, the other one follows.
- **Settings** (`/settings`) — set your church's name, upload a logo, and
  pick an accent color. Both show up on the Presenter screen.

### A note on team editing

Two people can safely open the same service to edit at once: if someone
else saves changes while you're still editing, your Save is refused with a
warning instead of silently overwriting their work, so you can reload and
redo anything you still need. This app doesn't yet do live, simultaneous
co-editing (like a shared doc) — that would need a more involved real-time
sync layer — but it does stop the two most common accidents: two people
editing the same plan and one save quietly erasing the other's.

## Connecting to the church's TVs

This app doesn't need special hardware — any TV with a browser (a smart TV,
a Fire TV/Chromecast/Roku with a browser app, or a mini PC/laptop plugged
into the TV over HDMI) can just open the Presenter URL for a service and tap
**Start Presentation**. Run the app on a computer on the church's network
(see below) and browse to it from the TV using that computer's local IP
address, e.g. `http://192.168.1.20:3000`.

## Getting started

```bash
npm install        # installs dependencies and generates the Prisma client
cp .env.example .env
npm run db:push     # creates the local SQLite database
npm run dev          # starts the app at http://localhost:3000
```

Open `http://localhost:3000` (or `http://<your-computer's-IP>:3000` from
another device on the same network) in a browser.

For a permanent installation, build and run in production mode on a
always-on machine on the church's network:

```bash
npm run build
npm start
```

## Tech stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma** + **SQLite** for storing services and their items
- Uploaded pictures/audio are saved to `public/uploads` and served directly

## Data model

- `Service` — a saved order of service: title, date, and its items.
- `ServiceItem` — one slide: type (`notes` | `image` | `audio` | `song` |
  `countdown` | `scripture`), title, text body (notes/lyrics/verse text, or
  JSON countdown config), and/or an uploaded media URL. A song's
  verses/chorus are stored as multiple `song` items in sequence.
- `Song` — a reusable library entry: title, its slides (label, lyrics,
  optional picture), and an optional practice track, offered in the Song
  editor's "Start from" dropdown.
- `PlaybackState` — the current slide index for a service, used to keep the
  Presenter (TV) and Control (phone) pages in sync.
- `Settings` — a single row holding the church name, logo, and accent color
  shown on the Presenter screen.

## Scripture lookup

The Scripture item's "Look Up" button calls the free, keyless
[bible-api.com](https://bible-api.com) from the server, so it needs outbound
internet access from wherever you run this app. If that's not available (or
the reference isn't found), you can always type the verse text in by hand —
the lookup is a convenience, not a requirement.
