// espn.js
// Pulls live scores from ESPN's free, public (undocumented) scoreboard endpoints
// and normalizes every sport into one simple shape the rest of the app understands.
//
// These endpoints are the same ones espn.com calls in your browser. They're free,
// need no key, and return scores, game clock, and broadcast (where-to-watch) info.
// The tradeoff: there's no contract, so ESPN could change them. That's the accepted
// risk of a $0 feed — see the launch guide for paid alternatives.

const LEAGUES = {
  baseball:  { sport: "baseball",   path: "baseball/mlb",          label: "MLB" },
  basketball:{ sport: "basketball", path: "basketball/nba",        label: "NBA" },
  wnba:      { sport: "basketball", path: "basketball/wnba",       label: "WNBA" },
  hockey:    { sport: "hockey",     path: "hockey/nhl",            label: "NHL" },
  football:  { sport: "football",   path: "football/nfl",          label: "NFL" },
  soccer:    { sport: "soccer",     path: "soccer/fifa.world",     label: "WORLD CUP" },
};

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

// Fetch one league's scoreboard and return normalized games.
async function fetchLeague(key) {
  const lg = LEAGUES[key];
  if (!lg) return [];
  const url = `${BASE}/${lg.path}/scoreboard`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "clutch/1.0" } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map((ev) => normalize(ev, lg, key)).filter(Boolean);
  } catch (err) {
    console.error(`[espn] ${key} fetch failed:`, err.message);
    return [];
  }
}

// Turn one ESPN event into our clean game object.
function normalize(ev, lg, key) {
  const comp = ev.competitions && ev.competitions[0];
  if (!comp) return null;
  const competitors = comp.competitors || [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const status = ev.status || {};
  const type = status.type || {};
  const state = type.state; // "pre" | "in" | "post"

  // Where to watch: ESPN gives broadcast names in a few possible spots.
  const nets = [];
  (comp.broadcasts || []).forEach((b) => (b.names || []).forEach((n) => nets.push(n)));
  (comp.geoBroadcasts || []).forEach((b) => {
    if (b.media && b.media.shortName) nets.push(b.media.shortName);
  });
  const where = [...new Set(nets)].slice(0, 4);

  return {
    id: ev.id,
    leagueKey: key,
    lg: lg.label,
    sport: lg.sport,
    state, // pre / in / post
    a: away.team.abbreviation,
    an: away.team.shortDisplayName || away.team.name,
    h: home.team.abbreviation,
    hn: home.team.shortDisplayName || home.team.name,
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
  if (sport === "soccer") return ["FS1", "Telemundo"];
  return ["Check listings"];
}

// Fetch several leagues at once.
export async function fetchGames(leagueKeys) {
  const results = await Promise.all(leagueKeys.map(fetchLeague));
  return results.flat();
}

export { LEAGUES };
