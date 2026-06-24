// server.js
import express from "express";
import webpush from "web-push";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchGames, fetchTeams } from "./espn.js";
import { clutchScore, isMustWatch, situationText } from "./clutch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const POLL_MS = Number(process.env.POLL_MS || 20000);
const LEAGUES = (process.env.LEAGUES || "nba,wnba,ncaab,nfl,ncaaf,mlb,nhl,worldcup,epl,mls").split(",");

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const PUSH_ENABLED = PUBLIC_KEY && PRIVATE_KEY;
if (PUSH_ENABLED) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:you@example.com", PUBLIC_KEY, PRIVATE_KEY);
} else {
  console.warn("[push] VAPID keys not set — alerts disabled.");
}

const SUBS_FILE = path.join(__dirname, "subscriptions.json");
let subs = [];
try { subs = JSON.parse(fs.readFileSync(SUBS_FILE, "utf8")); } catch { subs = []; }
function saveSubs() { try { fs.writeFileSync(SUBS_FILE, JSON.stringify(subs)); } catch {} }

const DEFAULT_SETTINGS = {
  leagues: { nba:true, wnba:true, ncaab:true, nfl:true, ncaaf:true, mlb:true, nhl:true, worldcup:true, epl:true, mls:true },
  teamMode: "all", teams: {},
  margin: { baseball: 1, basketball: 6, hockey: 1, football: 8, soccer: 1 },
  late:   { baseballInning: 8, basketballSec: 300, hockeySec: 300, footballSec: 300, soccerMin: 70 },
};

let cache = { updated: null, games: [] };
const alerted = new Set();

let teamsCache = { updated: null, teams: {} };
async function refreshTeams() {
  try { teamsCache = { updated: new Date().toISOString(), teams: await fetchTeams(LEAGUES) }; }
  catch (e) { console.error("[teams] refresh failed:", e.message); }
}

function involvesFollowedTeam(g, settings) {
  if (settings.teamMode !== "mine") return true;
  const t = settings.teams || {};
  return !!(t[`${g.leagueKey}:${g.a}`] || t[`${g.leagueKey}:${g.h}`]);
}

function scoreAll(games) {
  return games.map((g) => ({ ...g, score: clutchScore(g), situation: situationText(g) }));
}

async function poll() {
  try {
    const raw = await fetchGames(LEAGUES);
    const scored = scoreAll(raw).sort((a, b) => b.score - a.score);
    cache = { updated: new Date().toISOString(), games: scored };
    const live = scored.filter((g) => g.state === "in");
    for (const entry of subs) {
      const settings = entry.settings || DEFAULT_SETTINGS;
      const endpoint = entry.subscription && entry.subscription.endpoint;
      if (!endpoint) continue;
      for (const g of live) {
        const key = endpoint + "::" + g.id;
        if (isMustWatch(g, settings) && involvesFollowedTeam(g, settings) && !alerted.has(key)) {
          alerted.add(key);
          await alertOne(entry.subscription, g);
        }
      }
    }
    const liveIds = new Set(live.map((g) => g.id));
    for (const key of alerted) {
      const gid = key.split("::")[1];
      if (!liveIds.has(gid)) alerted.delete(key);
    }
  } catch (err) {
    console.error("[poll] error:", err.message);
  }
}

async function alertOne(subscription, g) {
  console.log(`[ALERT] -> ${g.a} @ ${g.h} — ${situationText(g)} (clutch ${clutchScore(g)})`);
  if (!PUSH_ENABLED) return;
  const payload = JSON.stringify({
    title: `⚡ Turn it on — ${g.a} @ ${g.h}`,
    body: `${situationText(g)} · ${g.where.join(" / ")}`,
    tag: g.id,
    url: "/",
  });
  try {
    await webpush.sendNotification(subscription, payload);
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      subs = subs.filter((s) => s.subscription.endpoint !== subscription.endpoint);
      saveSubs();
    }
  }
}

app.get("/api/games", (req, res) => res.json(cache));
app.get("/api/teams", (req, res) => res.json(teamsCache));
app.get("/api/vapidPublicKey", (req, res) => res.json({ key: PUBLIC_KEY }));

app.get("/api/debug", (req, res) => {
  const byLeague = {};
  for (const g of cache.games) {
    if (!byLeague[g.lg]) byLeague[g.lg] = { total: 0, live: 0, sample: null };
    byLeague[g.lg].total++;
    if (g.state === "in") byLeague[g.lg].live++;
    if (!byLeague[g.lg].sample) byLeague[g.lg].sample = `${g.a} @ ${g.h} (${g.state}, ${g.startISO})`;
  }
  res.json({ updated: cache.updated, leaguesPolled: LEAGUES, totalGames: cache.games.length, teams: Object.keys(teamsCache.teams).length, byLeague });
});

app.post("/api/subscribe", (req, res) => {
  const { subscription, settings } = req.body || {};
  if (!subscription || !subscription.endpoint) return res.status(400).json({ ok: false });
  const existing = subs.find((s) => s.subscription.endpoint === subscription.endpoint);
  if (existing) { existing.subscription = subscription; if (settings) existing.settings = settings; }
  else { subs.push({ subscription, settings: settings || DEFAULT_SETTINGS }); }
  saveSubs();
  res.json({ ok: true });
});

app.post("/api/settings", (req, res) => {
  const { endpoint, settings } = req.body || {};
  if (!endpoint || !settings) return res.status(400).json({ ok: false });
  const entry = subs.find((s) => s.subscription.endpoint === endpoint);
  if (entry) { entry.settings = settings; saveSubs(); return res.json({ ok: true }); }
  res.json({ ok: false, reason: "not subscribed yet" });
});

app.post("/api/test-alert", async (req, res) => {
  if (!PUSH_ENABLED) return res.json({ ok: false, reason: "push disabled" });
  const payload = JSON.stringify({ title: "⚡ CLUTCH test", body: "Alerts are working.", url: "/" });
  await Promise.all(subs.map((s) => webpush.sendNotification(s.subscription, payload).catch(() => {})));
  res.json({ ok: true, sent: subs.length });
});

app.listen(PORT, () => {
  console.log(`CLUTCH running on http://localhost:${PORT}`);
  console.log(`Leagues: ${LEAGUES.join(", ")} · polling every ${POLL_MS / 1000}s`);
  poll();
  setInterval(poll, POLL_MS);
  refreshTeams();
  setInterval(refreshTeams, 24 * 3600 * 1000);
});
