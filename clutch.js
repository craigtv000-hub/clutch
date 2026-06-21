// clutch.js
// THE BRAIN. Given a normalized live game, decide how "must-watch" it is.
// Pure functions, no network — this is the same logic you saw working in the demo.

// --- how late is the game, 0..1 ---
export function lateness(g) {
  if (g.state !== "in") return 0;
  if (g.sport === "baseball") {
    // period == inning
    return clamp((g.period - 5) / 4);
  }
  if (g.sport === "basketball") {
    // 4 quarters; clock is "MM:SS" string. Treat OT (period>4) as max.
    if (g.period > 4) return 1;
    if (g.period < 4) return 0.3;
    const secs = clockToSeconds(g.clock);
    return clamp((720 - secs) / 720 * 0.7 + 0.3); // last 12 min of Q4 ramps up
  }
  if (g.sport === "hockey") {
    if (g.period > 3) return 1;
    if (g.period < 3) return 0.3;
    const secs = clockToSeconds(g.clock);
    return clamp((1200 - secs) / 1200 * 0.7 + 0.3);
  }
  if (g.sport === "football") {
    if (g.period > 4) return 1;
    if (g.period < 4) return 0.35;
    const secs = clockToSeconds(g.clock);
    return clamp((900 - secs) / 900 * 0.65 + 0.35);
  }
  if (g.sport === "soccer") {
    const minute = parseSoccerMinute(g.clock, g.detail, g.period);
    return clamp((minute - 45) / 45);
  }
  return 0;
}

// --- how close is the game, 0..1 ---
export function closeness(g) {
  const m = Math.abs(g.as - g.hs);
  if (g.sport === "baseball") return m === 0 ? 1 : m === 1 ? 0.8 : m === 2 ? 0.45 : 0.1;
  if (g.sport === "basketball") return m === 0 ? 1 : Math.max(0, 1 - m / 14);
  if (g.sport === "hockey") return m === 0 ? 1 : m === 1 ? 0.85 : m === 2 ? 0.45 : 0.1;
  if (g.sport === "football") return m === 0 ? 1 : Math.max(0, 1 - m / 17);
  if (g.sport === "soccer") return m === 0 ? 0.85 : m === 1 ? 0.9 : m === 2 ? 0.4 : 0.1;
  return 0;
}

// --- 0..100 score ---
export function clutchScore(g) {
  if (g.state !== "in") return 0;
  const base = (closeness(g) * 0.62 + lateness(g) * 0.38) * 100;
  return Math.min(100, Math.round(base));
}

// --- does this game cross the user's "must-watch" line? ---
// settings = { sports:{baseball:true,...}, margin:{baseball:1,basketball:6,...},
//              late:{ baseballInning:8, basketballSec:300, ... } }
export function isMustWatch(g, settings) {
  if (g.state !== "in") return false;
  // Gate by the specific league the user toggled (nba, nfl, epl, …).
  if (settings.leagues && settings.leagues[g.leagueKey] === false) return false;

  const m = Math.abs(g.as - g.hs);
  const marginLimit = (settings.margin && settings.margin[g.sport]) ?? defaultMargin(g.sport);
  const closeEnough = m <= marginLimit;

  let lateEnough = false;
  const L = settings.late || {};
  if (g.sport === "baseball")   lateEnough = g.period >= (L.baseballInning ?? 8);
  if (g.sport === "basketball") lateEnough = g.period > 4 || (g.period === 4 && clockToSeconds(g.clock) <= (L.basketballSec ?? 300));
  if (g.sport === "hockey")     lateEnough = g.period > 3 || (g.period === 3 && clockToSeconds(g.clock) <= (L.hockeySec ?? 300));
  if (g.sport === "football")   lateEnough = g.period > 4 || (g.period === 4 && clockToSeconds(g.clock) <= (L.footballSec ?? 300));
  if (g.sport === "soccer")     lateEnough = parseSoccerMinute(g.clock, g.detail, g.period) >= (L.soccerMin ?? 70);

  return closeEnough && lateEnough;
}

export function defaultMargin(sport) {
  return { baseball: 1, basketball: 6, hockey: 1, football: 8, soccer: 1 }[sport] ?? 99;
}

// Human-readable situation line, e.g. "Bot 9th · TIED" or "Q4 1:42 · 1-pt game"
export function situationText(g) {
  const m = Math.abs(g.as - g.hs);
  if (g.state === "pre") return "Scheduled";
  if (g.state === "post") return "Final";
  const margin = m === 0 ? "TIED"
    : (g.sport === "soccer" ? `${m}-goal` : g.sport === "baseball" ? `${m} run${m > 1 ? "s" : ""}` : `${m}-pt`);
  // ESPN's shortDetail is already nicely formatted ("Top 8th", "Q4 2:34", "78'")
  const base = g.detail || `P${g.period}`;
  return `${base} · ${margin}`;
}

// --- helpers ---
function clamp(x) { return Math.max(0, Math.min(1, x)); }
function clockToSeconds(s) {
  if (!s || typeof s !== "string" || !s.includes(":")) return 0;
  const [m, sec] = s.split(":").map((n) => parseInt(n, 10));
  return (m || 0) * 60 + (sec || 0);
}
function parseSoccerMinute(clock, detail, period) {
  // ESPN soccer clock looks like "78'". Fall back to half.
  const src = clock || detail || "";
  const match = String(src).match(/(\d+)/);
  if (match) return parseInt(match[1], 10);
  return period >= 2 ? 60 : 20;
}
