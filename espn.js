// espn.js
const LEAGUES = {
  nba:       { sport: "basketball", path: "basketball/nba",                    label: "NBA" },
  wnba:      { sport: "basketball", path: "basketball/wnba",                   label: "WNBA" },
  ncaab:     { sport: "basketball", path: "basketball/mens-college-basketball",label: "CBB" },
  nfl:       { sport: "football",   path: "football/nfl",                      label: "NFL" },
  ncaaf:     { sport: "football",   path: "football/college-football",         label: "CFB" },
  mlb:       { sport: "baseball",   path: "baseball/mlb",                      label: "MLB" },
  nhl:       { sport: "hockey",     path: "hockey/nhl",                        label: "NHL" },
  worldcup:  { sport: "soccer",     path: "soccer/fifa.world",                 label: "WORLD CUP" },
  epl:       { sport: "soccer",     path: "soccer/eng.1",                      label: "EPL" },
  mls:       { sport: "soccer",     path: "soccer/usa.1",                      label: "MLS" },
};

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

function dateWindow() {
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const now = new Date();
  const y = new Date(now); y.setUTCDate(now.getUTCDate() - 1);
  const t = new Date(now); t.setUTCDate(now.getUTCDate() + 1);
  return `${fmt(y)}-${fmt(t)}`;
}

async function fetchLeague(key) {
  const lg = LEAGUES[key];
  if (!lg) return [];
  const url = `${BASE}/${lg.path}/scoreboard?dates=${dateWindow()}&limit=100`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "clutch/1.0", "Cache-Control": "no-cache" } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map((ev) => normalize(ev, lg, key)).filter(Boolean);
  } catch (err) {
    console.error(`[espn] ${key} fetch failed:`, err.message);
    return [];
  }
}

function normalize(ev, lg, key) {
  const comp = ev.competitions && ev.competitions[0];
  if (!comp) return null;
  const competitors = comp.competitors || [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away || !home.team || !away.team) return null;

  const status = ev.status || {};
  const type = status.type || {};
  const state = type.state;

  const nets = [];
  (comp.broadcasts || []).forEach((b) => (b.names || []).forEach((n) => nets.push(n)));
  (comp.geoBroadcasts || []).forEach((b) => { if (b.media && b.media.shortName) nets.push(b.media.shortName); });
  const where = [...new Set(nets)].slice(0, 4);

  return {
    id: ev.id,
    leagueKey: key,
    lg: lg.label,
    sport: lg.sport,
    state,
    a: away.team.abbreviation || away.team.shortDisplayName || "—",
    an: away.team.shortDisplayName || away.team.name || "",
    h: home.team.abbreviation || home.team.shortDisplayName || "—",
    hn: home.team.shortDisplayName || home.team.name || "",
    as: numOr(away.score, 0),
    hs: numOr(home.score, 0),
    period: status.period || 0,
    clock: status.displayClock || "",
    detail: type.shortDetail || type.description || "",
    startISO: ev.date,
    where: where.length ? where : whereFallback(lg.sport),
  };
}

function numOr(v, d) { const n = parseInt(v, 10); return isNaN(n) ? d : n; }
function whereFallback(sport) {
  if (sport === "baseball") return ["MLB.TV", "Local RSN"];
  return ["Check listings"];
}

export async function fetchGames(leagueKeys) {
  const results = await Promise.all(leagueKeys.map(fetchLeague));
  return results.flat();
}

export { LEAGUES };
