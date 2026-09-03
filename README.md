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
  prayers), **Song with Lyrics** (title + lyrics text for the display, with
  an optional backing track), **Picture** (upload an image), or **Audio /
  Music** (upload an audio file). Reorder items with the up/down arrows, then
  give the whole thing a title and save — the date is recorded automatically.
- **Presenter** (`/service/[id]/present`) — a fullscreen, click-through
  slideshow meant to be opened in the browser on the church's TV (or cast to
  it). Advance with a click, the arrow keys, or spacebar; audio/backing
  tracks play automatically when their slide comes up.
- **Remote Control** (`/service/[id]/control`) — open this on a phone or
  tablet on the same network to drive the Presenter page from the sound
  booth: tap any item to jump to it, or use the prev/next buttons. It syncs
  with the TV a couple of times a second, so whichever device changes the
  slide, the other one follows.

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
- `ServiceItem` — one slide: type (`notes` | `image` | `audio` | `song`),
  title, text body (notes/lyrics), and/or an uploaded media URL.
- `PlaybackState` — the current slide index for a service, used to keep the
  Presenter (TV) and Control (phone) pages in sync.
