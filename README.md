# Foyer for Home Assistant

A wall dashboard for the iPad you already have: ten faces, glass tiles, one tap per device, tiles you arrange
on the screen, iPad-style Settings, an Apps screen (music on HomePods, reminders, timers, world clock, calendar
events, links to Apple's apps). Works on Android tablets too. It runs as a Home Assistant add-on (with a
standalone Docker variant) and talks only to your Home Assistant.

## Install in Home Assistant

[![Add the repository to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fvallez44%2Ffoyer-addons)

Or: **Settings → Apps → Install app → ⋮ → Repositories**, add `https://github.com/vallez44/foyer-addons`, then install **Foyer**, turn on **Show in sidebar** and start it. Full guide (French): [foyer/DOCS.md](foyer/DOCS.md).

```
foyer/              the add-on (config.yaml, Dockerfile, app/)
  app/server.js     HTTP server: pages, long-polling API, gateway to Home Assistant
  app/lib/          Home Assistant client, home model, policy, pairing, suggestions, photos, demo home
  app/public/       the iPad page (ES5, no build step): faces, tiles, sheets, edit mode, settings, apps
  app/test/         node --test suites (fake Home Assistant included)
standalone/         docker compose for Home Assistant Container / Core
```

## Run it locally (sample home)

```bash
cd foyer/app && npm run demo
```

Then open http://localhost:8110 (add `?face=weather` to open a given face).

## Tests

```bash
cd foyer/app && npm test
```

## How it fits together

```
iPad (Safari)  ──HTTP──>  Foyer add-on  ──WebSocket + REST──>  Home Assistant
   long-poll /api/poll        │  token from the Supervisor (never sent to the iPad)
   POST /api/action  ─────────┤  policy: only dashboard actions, checked fields
                              │  pairing: device cookies for the direct port (8110)
HA sidebar (ingress) ─────────┘  admin: setup sheets, paired screens, security
```

Licensed MIT. Icons: Material Design Icons (Apache-2.0). QR codes: qrcode-generator by Kazuhiko Arase (MIT).
