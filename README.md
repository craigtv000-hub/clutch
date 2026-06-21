# CLUTCH ⚡

Get pinged the moment a live game gets good — and where to watch it.

CLUTCH watches every live game across MLB, NBA, WNBA, NHL, NFL, and World Cup soccer, scores each
one for how *close* and how *late* it is, and alerts you the instant a game crosses into
must-watch territory — with the networks to find it on.

## 👉 New here? Open **LAUNCH-GUIDE.md** and follow it top to bottom.

It assumes zero coding background and takes you from these files to a live web app with phone
alerts, step by step.

## Quick start (if you've done this before)
```bash
npm install
npm run keys          # generate VAPID keys, put them in .env (copy .env.example)
npm start             # http://localhost:3000
```

## How it works
- `espn.js` pulls live scores from ESPN's free public endpoints (server-side, no key).
- `clutch.js` scores each game 0–100 on closeness + lateness and decides "must-watch."
- `server.js` polls every 20s, serves the app, and sends web-push alerts when a game crosses the line.
- `public/` is the installable web app (PWA) with lock-screen notifications.

No Apple/Google account needed for the web-app version. See the guide for the app-store path.
