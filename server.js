// server.js
// The always-on backend. It does four things:
//   1) Serves the web app (the public/ folder).
//   2) GET /api/games  -> live games, clutch-scored (the page polls this).
//   3) POST /api/subscribe -> saves a phone/browser's push subscription.
//   4) Every POLL_MS, re-checks every live game and PUSHES an alert the moment
//      one newly crosses into must-watch territory.
//
// Subscriptions are stored in a simple JSON file so they survive restarts.
// (For real scale, swap this for a database — noted in the launch guide.)

import express from "express";
import webpush from "web-push";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchGames } from "./espn.js";
import { clutchScore, isMustWatch, situationText } from "./clutch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const POLL_MS = Number(process.env.POLL_MS || 20000); // every 20s
const LEAGUES = (process.env.LEAGUES || "baseball,basketball,wnba,hockey,football,soccer").split(",");

// ---- web-push setup (VAPID keys come from env; generate with `npm run keys`) ----
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const PUSH_ENABLED = PUBLIC_KEY && PRIVATE_KEY;
if (PUSH_ENABLED) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:you@example.com",
    PUBLIC_KEY,
    PRIVATE_KEY
  );
} else {
  console.warn("[push] VAPID keys not set — alerts disabled. Run `npm run keys` and set env vars.");
}

// ---- simple persistence ----
const SUBS_FILE = path.join(__dirname, "subscriptions.json");
let subs = [];
try { subs = JSON.parse(fs.readFileSync(SUBS_FILE, "utf8")); } catch { subs = []; }
function saveSubs() { try { fs.writeFileSync(SUBS_FILE, JSON.stringify(subs)); } catch {} }

// Default "must-watch" thresholds (a user could override these per device later).
const DEFAULT_SETTINGS = {
  sports: { baseball: true, basketball: true, hockey: true, football: true, soccer: true },
  margin: { baseball: 1, basketball: 6, hockey: 1, football: 8, soccer: 1 },
  late:   { baseballInning: 8, basketballSec: 300, hockeySec: 300, footballSec: 300, soccerMin: 70 },
};

// ---- live cache + alert tracking ----
let cache = { updated: null, games: [] };
const alreadyAlerted = new Set(); // game ids we've already pinged this run

function scoreAll(games, settings) {
  return games.map((g) => ({
    ...g,
    score: clutchScore(g),
    must: isMustWatch(g, settings),
    situation: situationText(g),
  }));
}

async function poll() {
  try {
    const raw = await fetchGames(LEAGUES);
    const scored = scoreAll(raw, DEFAULT_SETTINGS).sort((a, b) => b.score - a.score);
    cache = { updated: new Date().toISOString(), games: scored };

    // find games that JUST became must-watch and alert
    for (const g of scored) {
      if (g.must && !alreadyAlerted.has(g.id)) {
        alreadyAlerted.add(g.id);
        await alert(g);
      }
      // once a game ends, forget it so a future game with same id is fine
      if (g.state === "post") alreadyAlerted.delete(g.id);
    }
  } catch (err) {
    console.error("[poll] error:", err.message);
  }
}

async function alert(g) {
  console.log(`[ALERT] ${g.a} @ ${g.h} — ${g.situation} (clutch ${g.score})`);
  if (!PUSH_ENABLED || subs.length === 0) return;
  const payload = JSON.stringify({
    title: `⚡ Turn it on — ${g.a} @ ${g.h}`,
    body: `${g.situation} · ${g.where.join(" / ")}`,
    tag: g.id,
    url: "/",
  });
  const dead = [];
  await Promise.all(subs.map(async (s, i) => {
    try { await webpush.sendNotification(s, payload); }
    catch (e) { if (e.statusCode === 410 || e.statusCode === 404) dead.push(i); }
  }));
  // prune expired subscriptions
  if (dead.length) { subs = subs.filter((_, i) => !dead.includes(i)); saveSubs(); }
}

// ---- API ----
app.get("/api/games", (req, res) => res.json(cache));
app.get("/api/vapidPublicKey", (req, res) => res.json({ key: PUBLIC_KEY }));

app.post("/api/subscribe", (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ ok: false });
  if (!subs.find((s) => s.endpoint === sub.endpoint)) { subs.push(sub); saveSubs(); }
  res.json({ ok: true });
});

// Optional: let a device send a test push to itself
app.post("/api/test-alert", async (req, res) => {
  if (!PUSH_ENABLED) return res.json({ ok: false, reason: "push disabled" });
  const payload = JSON.stringify({ title: "⚡ CLUTCH test", body: "Alerts are working.", url: "/" });
  await Promise.all(subs.map((s) => webpush.sendNotification(s, payload).catch(() => {})));
  res.json({ ok: true, sent: subs.length });
});

app.listen(PORT, () => {
  console.log(`CLUTCH running on http://localhost:${PORT}`);
  console.log(`Leagues: ${LEAGUES.join(", ")} · polling every ${POLL_MS / 1000}s`);
  poll();
  setInterval(poll, POLL_MS);
});
