import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import ESPNWNBAFantasyAPI from "espn-fantasy-wnba-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEAGUE_ID = process.env.LEAGUE_ID || "1240842204";
const CURRENT_YEAR = new Date().getFullYear();

const WEEK_META = [
  { week: 1, start: "2026-05-08", end: "2026-05-17" },
  { week: 2, start: "2026-05-18", end: "2026-05-24" },
  { week: 3, start: "2026-05-25", end: "2026-05-31" },
  { week: 4, start: "2026-06-01", end: "2026-06-07", focus: "SPY" },
  { week: 5, start: "2026-06-08", end: "2026-06-14" },
  { week: 6, start: "2026-06-15", end: "2026-06-21", focus: "SPY" },
  { week: 7, start: "2026-06-22", end: "2026-06-28", focus: "CMO" },
  { week: 8, start: "2026-06-29", end: "2026-07-05", focus: "CMO" },
  { week: 9, start: "2026-07-06", end: "2026-07-12", focus: "SPY" },
  { week: 10, start: "2026-07-13", end: "2026-07-19" },
  { week: 11, start: "2026-07-20", end: "2026-08-02", focus: "SPY" },
  { week: 12, start: "2026-08-03", end: "2026-08-09", focus: "CMO" },
];

const GAMES_BY_WEEK = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 2, 6: 3, 7: 3, 8: 2, 9: 3, 10: 2, 11: 3, 12: 2 };

const SEED_TEAMS = [
  {
    code: "SPY",
    name: "SPY",
    roster: [
      { id: "1", name: "Skylar Diggins", avg: 35.2, pos: 1, slot: "G", lineupSlotId: 1, isIR: false },
      { id: "2", name: "Chennedy Carter", avg: 30.1, pos: 1, slot: "G", lineupSlotId: 1, isIR: false },
      { id: "3", name: "Alyssa Thomas", avg: 41.8, pos: 2, slot: "F/C", lineupSlotId: 4, isIR: false },
      { id: "4", name: "Jessica Shepard", avg: 36.0, pos: 2, slot: "F/C", lineupSlotId: 4, isIR: false },
      { id: "5", name: "Natasha Mack", avg: 29.3, pos: 2, slot: "F/C", lineupSlotId: 4, isIR: false },
      { id: "6", name: "Brittney Sykes", avg: 32.4, pos: 1, slot: "UTIL", lineupSlotId: 5, isIR: false },
      { id: "7", name: "Chelsea Gray", avg: 33.8, pos: 1, slot: "Bench", lineupSlotId: 6, isIR: false },
      { id: "8", name: "Gabby Williams", avg: 28.9, pos: 2, slot: "Bench", lineupSlotId: 6, isIR: false },
      { id: "9", name: "Veronica Burton", avg: 27.5, pos: 1, slot: "Bench", lineupSlotId: 6, isIR: false },
    ],
  },
  {
    code: "CMO",
    name: "Warren's Bays",
    roster: [
      { id: "10", name: "Sonia Citron", avg: 28.7, pos: 1, slot: "G", lineupSlotId: 1, isIR: false },
      { id: "11", name: "Jordin Canada", avg: 35.7, pos: 1, slot: "G", lineupSlotId: 1, isIR: false },
      { id: "12", name: "Kiki Iriafen", avg: 30.3, pos: 2, slot: "F/C", lineupSlotId: 4, isIR: false },
      { id: "13", name: "Cameron Brink", avg: 18.7, pos: 2, slot: "F/C", lineupSlotId: 4, isIR: false },
      { id: "14", name: "Carla Leite", avg: 22.0, pos: 1, slot: "UTIL", lineupSlotId: 5, isIR: false },
      { id: "15", name: "A'ja Wilson", avg: 44.9, pos: 2, slot: "Bench", lineupSlotId: 6, isIR: false },
      { id: "16", name: "Arike Ogunbowale", avg: 18.3, pos: 1, slot: "Bench", lineupSlotId: 6, isIR: false },
      { id: "17", name: "Flau'jae Johnson", avg: 23.1, pos: 1, slot: "Bench", lineupSlotId: 6, isIR: false },
      { id: "18", name: "Natisha Hiedeman", avg: 21.0, pos: 1, slot: "Bench", lineupSlotId: 6, isIR: false },
    ],
  },
];

const app = express();
app.use(express.json());
app.use(
  express.static(__dirname, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".css") || filePath.endsWith(".js") || filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  }),
);

function safeNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function createApi(season) {
  const resolved = safeNum(season || process.env.SEASON || CURRENT_YEAR, CURRENT_YEAR);
  const espnS2 = process.env.ESPN_S2;
  const swid = process.env.SWID;
  if (espnS2 && swid) return new ESPNWNBAFantasyAPI({ espnS2, swid, season: resolved });
  return new ESPNWNBAFantasyAPI({ season: resolved });
}

async function withSeasonRetry(task) {
  const set = [safeNum(process.env.SEASON, 0), CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR + 1]
    .filter((v) => v >= 2020)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  let lastErr = null;
  for (const season of set) {
    try {
      const api = createApi(season);
      const value = await task(api, season);
      return { value, season };
    } catch (err) {
      lastErr = err;
      if (!String(err?.message || "").includes("404")) throw err;
    }
  }
  throw lastErr || new Error("No usable season found");
}

function teamCodeFromText(text) {
  const t = String(text || "").toLowerCase();
  if (t.includes("spy") || t.includes("advay")) return "SPY";
  if (t.includes("warren") || t.includes("kash") || t.includes("cmo")) return "CMO";
  return "";
}

function normalizeHeadshot(playerId) {
  const id = String(playerId || "");
  return id ? `https://a.espncdn.com/combiner/i?img=/i/headshots/wnba/players/full/${id}.png&w=96&h=96` : "";
}

function positionLabel(posId) {
  const n = safeNum(posId, 0);
  if (n === 1) return "G";
  if (n === 2) return "F";
  if (n === 3) return "C";
  return "-";
}

function slotLabel(lineupSlotId) {
  const n = safeNum(lineupSlotId, 0);
  if (n === 1) return "G";
  if (n === 4) return "F/C";
  if (n === 5) return "UTIL";
  if (n === 6) return "Bench";
  if (n === 7) return "IR";
  return "Bench";
}

function normalizeTeamCode(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return text && text !== "BYE" ? text : "";
}

function parseDateKey(value) {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);

  if (typeof value === "number" && Number.isFinite(value)) {
    const asDate = new Date(value > 1e12 ? value : value * 1000);
    if (!Number.isNaN(asDate.getTime())) return asDate.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function proTeamCode(team = {}) {
  const candidates = [
    team.abbrev,
    team.abbreviation,
    team.shortName,
    team.location,
    team.name,
    team.team,
    team.displayName,
  ];
  for (const candidate of candidates) {
    const code = normalizeTeamCode(candidate);
    if (code && code.length <= 4) return code;
  }
  return "";
}

function flattenScheduleGames(proTeams = []) {
  const teamMap = new Map();
  for (const team of proTeams) {
    teamMap.set(safeNum(team?.id, 0), proTeamCode(team));
  }

  const out = [];
  const seen = new Set();
  for (const team of proTeams) {
    const periods = team?.proGamesByScoringPeriod || {};
    for (const [period, games] of Object.entries(periods)) {
      if (!Array.isArray(games)) continue;
      for (const game of games) {
        if (!game || typeof game !== "object") continue;
        const homeId = safeNum(game.homeProTeamId || game.homeTeamId || game.home || 0, 0);
        const awayId = safeNum(game.awayProTeamId || game.awayTeamId || game.away || 0, 0);
        const home = normalizeTeamCode(game.homeAbbrev || game.homeTeam || game.home_team) || teamMap.get(homeId) || "";
        const away = normalizeTeamCode(game.awayAbbrev || game.awayTeam || game.away_team) || teamMap.get(awayId) || "";
        const date =
          parseDateKey(game.date) ||
          parseDateKey(game.startDate) ||
          parseDateKey(game.startTime) ||
          parseDateKey(game.dateUTC) ||
          parseDateKey(game.gameDate);
        if (!date || (!home && !away)) continue;
        const dedupe = `${period}|${date}|${home}|${away}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        out.push({
          period: safeNum(period, 0),
          date,
          home,
          away,
        });
      }
    }
  }
  return out;
}

function weekDateRange(week) {
  const meta = weekMeta(week);
  return {
    start: parseDateKey(meta?.start),
    end: parseDateKey(meta?.end),
  };
}

function gameDatesForTeamWeek(teamCode, week, scheduleGames = []) {
  const code = normalizeTeamCode(teamCode);
  if (!code) return [];
  const range = weekDateRange(week);
  if (!range.start || !range.end) return [];

  const dates = scheduleGames
    .filter((game) => game.date && game.date >= range.start && game.date <= range.end)
    .filter((game) => game.home === code || game.away === code)
    .map((game) => game.date)
    .filter(Boolean);

  return [...new Set(dates)].sort();
}

function playerAverageFromStats(player) {
  const season = safeNum(process.env.SEASON, CURRENT_YEAR);
  const stats = Array.isArray(player?.stats) ? player.stats : [];
  const seasonActual = stats.find(
    (s) => safeNum(s?.seasonId, 0) === season && safeNum(s?.statSourceId, 0) === 0 && safeNum(s?.statSplitTypeId, 0) === 0,
  );
  if (seasonActual && Number.isFinite(Number(seasonActual.appliedAverage))) {
    return Number(seasonActual.appliedAverage);
  }
  const anyActual = stats.find((s) => safeNum(s?.statSourceId, 0) === 0 && safeNum(s?.statSplitTypeId, 0) === 0);
  if (anyActual && Number.isFinite(Number(anyActual.appliedAverage))) {
    return Number(anyActual.appliedAverage);
  }
  return 0;
}

function normalizeLiveTeams(rawLeague) {
  const teams = Array.isArray(rawLeague?.teams) ? rawLeague.teams : [];
  const members = Array.isArray(rawLeague?.members) ? rawLeague.members : [];
  const memberMap = new Map();
  for (const m of members) {
    memberMap.set(String(m.id || ""), `${m.firstName || ""} ${m.lastName || ""}`.trim());
  }

  const temp = { SPY: null, CMO: null };
  for (const t of teams) {
    const name = String(t.name || "");
    const abbrev = String(t.abbrev || "");
    const ownerId = String(t.primaryOwner || "");
    const manager = memberMap.get(ownerId) || "";
    const byAbbrev = teamCodeFromText(abbrev);
    const code = byAbbrev || teamCodeFromText(`${name} ${manager}`);
    if (!code || temp[code]) continue;

    const rosterEntries = Array.isArray(t?.roster?.entries) ? t.roster.entries : [];
    const roster = rosterEntries.map((entry, idx) => {
      const player = entry?.playerPoolEntry?.player || {};
      const playerId = String(player.id || entry.playerId || "");
      const avg = playerAverageFromStats(player);
      const injuryStatus = String(entry?.injuryStatus || player?.injuryStatus || "NORMAL");
      const lineupSlotId = safeNum(entry?.lineupSlotId, 6);
      const isIR = lineupSlotId === 7 || injuryStatus !== "NORMAL";
      return {
        id: playerId,
        name: player.fullName || "Unknown Player",
        avg,
        pos: safeNum(player.defaultPositionId, 0),
        position: positionLabel(player.defaultPositionId),
        proTeamId: safeNum(player.proTeamId, 0),
        proTeamAbbrev: normalizeTeamCode(player.proTeamAbbreviation || player.proTeam),
        lineupSlotId,
        slot: slotLabel(lineupSlotId),
        isIR,
        injuryStatus,
        sourceIndex: idx,
      };
    });
    temp[code] = { code, name: code === "SPY" ? "SPY" : "Warren's Bays", roster };
  }
  if (!temp.SPY || !temp.CMO) return null;
  if (!temp.SPY.roster.length || !temp.CMO.roster.length) return null;
  return [temp.SPY, temp.CMO];
}

async function loadTeams(week) {
  try {
    const { value } = await withSeasonRetry(async (api) => {
      const [rawRosters, leagueSettings, proSchedules] = await Promise.all([
        api.getLeagueRosters(LEAGUE_ID),
        api.getLeagueSettings(LEAGUE_ID),
        api.getProTeamSchedules(),
      ]);
      const normalized = normalizeLiveTeams(rawRosters);
      if (!normalized) throw new Error("Could not identify SPY/CMO teams from live data.");
      return {
        teams: normalized,
        matchupPeriods: leagueSettings?.settings?.scheduleSettings?.matchupPeriods || {},
        proTeams: proSchedules?.settings?.proTeams || [],
        scheduleGames: flattenScheduleGames(proSchedules?.settings?.proTeams || []),
        source: "live",
      };
    });
    return value;
  } catch {
    return {
      teams: SEED_TEAMS,
      matchupPeriods: {},
      proTeams: [],
      scheduleGames: [],
      source: "seed",
    };
  }
}

function weekMeta(week) {
  return WEEK_META.find((w) => w.week === week) || WEEK_META[0];
}

function localIsoDate(input = new Date()) {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentWeekFromDate(input = new Date()) {
  const today = localIsoDate(input);
  const first = WEEK_META[0];
  const last = WEEK_META[WEEK_META.length - 1];

  if (!first || !last) return 1;
  if (today <= first.start) return first.week;
  if (today >= last.end) return last.week;

  const exact = WEEK_META.find((w) => today >= w.start && today <= w.end);
  if (exact) return exact.week;

  const next = WEEK_META.find((w) => today < w.start);
  return next?.week || last.week;
}

function clampWeek(value) {
  const firstWeek = WEEK_META[0]?.week || 1;
  const lastWeek = WEEK_META[WEEK_META.length - 1]?.week || 12;
  return Math.max(firstWeek, Math.min(lastWeek, value));
}

function gamesForPlayerWeek(player, week, matchupPeriods, proTeams) {
  const fallback = GAMES_BY_WEEK[week] || 3;
  const proTeamId = safeNum(player.proTeamId, 0);
  if (!proTeamId) return fallback;
  const scoringPeriods = Array.isArray(matchupPeriods?.[String(week)])
    ? matchupPeriods[String(week)]
    : Array.isArray(matchupPeriods?.[week])
      ? matchupPeriods[week]
      : [week];

  const pro = (proTeams || []).find((t) => safeNum(t?.id, 0) === proTeamId);
  if (!pro?.proGamesByScoringPeriod) return fallback;

  let total = 0;
  for (const sp of scoringPeriods) {
    const games = pro.proGamesByScoringPeriod?.[String(sp)] || pro.proGamesByScoringPeriod?.[sp] || [];
    total += Array.isArray(games) ? games.length : 0;
  }
  return total || fallback;
}

function buildWeekPlayers(roster, week, matchupPeriods, proTeams, scheduleGames = []) {
  return roster
    .map((p, idx) => {
      const teamCode = normalizeTeamCode(p.proTeamAbbrev || p.proTeam || p.proTeamCode);
      const weekDates = gameDatesForTeamWeek(teamCode, week, scheduleGames);
      const games = weekDates.length || gamesForPlayerWeek(p, week, matchupPeriods, proTeams);
      return {
        id: String(p.id || ""),
        name: p.name,
        avg: safeNum(p.avg, 0),
        pos: safeNum(p.pos, 0),
        position: p.position || positionLabel(p.pos),
        slot: p.slot || slotLabel(p.lineupSlotId),
        isIR: Boolean(p.isIR),
        injuryStatus: p.injuryStatus || "NORMAL",
        sourceIndex: safeNum(p.sourceIndex, idx),
        games,
        gameDates: weekDates,
        weekValue: safeNum(p.avg, 0) * games,
        proTeam: teamCode,
        headshot: normalizeHeadshot(p.id),
      };
    });
}

const STARTING_SLOTS = ["G", "G", "F/C", "F/C", "UTIL", "UTIL"];

function isEligibleForSlot(player, slot) {
  if (slot === "UTIL") return true;
  const pos = safeNum(player?.pos, 0);
  if (slot === "G") return pos === 1;
  if (slot === "F/C") return pos === 2 || pos === 3;
  return false;
}

function bestLineup(players) {
  const active = players.filter((p) => !p.isIR && p.slot !== "IR");
  if (active.length < STARTING_SLOTS.length) {
    return { feasible: false, total: 0, playerIds: [] };
  }

  let best = -Infinity;
  let bestIds = [];
  const used = new Set();
  const path = [];

  function dfs(slotIdx, total) {
    if (slotIdx >= STARTING_SLOTS.length) {
      if (total > best) {
        best = total;
        bestIds = path.slice();
      }
      return;
    }

    const slot = STARTING_SLOTS[slotIdx];
    for (let i = 0; i < active.length; i += 1) {
      const p = active[i];
      const id = String(p.id || i);
      if (used.has(id)) continue;
      if (!isEligibleForSlot(p, slot)) continue;
      used.add(id);
      path.push(id);
      dfs(slotIdx + 1, total + safeNum(p.weekValue, 0));
      path.pop();
      used.delete(id);
    }
  }

  dfs(0, 0);
  if (best === -Infinity) {
    return { feasible: false, total: 0, playerIds: [] };
  }

  return { feasible: true, total: best, playerIds: bestIds };
}

function projectedTotal(players) {
  return bestLineup(players).total;
}

function evaluateBestTrade(spyPlayers, cmoPlayers, focusCode) {
  const tradableSpy = spyPlayers.filter((p) => !p.isIR && p.slot !== "IR");
  const tradableCmo = cmoPlayers.filter((p) => !p.isIR && p.slot !== "IR");
  const baseSpyLineup = bestLineup(spyPlayers);
  const baseCmoLineup = bestLineup(cmoPlayers);
  const baseSpy = baseSpyLineup.total;
  const baseCmo = baseCmoLineup.total;
  const options = [];
  for (const spyOut of tradableSpy) {
    for (const cmoOut of tradableCmo) {
      const newSpy = spyPlayers.map((p) => (p.id === spyOut.id ? cmoOut : p));
      const newCmo = cmoPlayers.map((p) => (p.id === cmoOut.id ? spyOut : p));
      const nextSpyLineup = bestLineup(newSpy);
      const nextCmoLineup = bestLineup(newCmo);
      if (!nextSpyLineup.feasible || !nextCmoLineup.feasible) continue;

      const gainSpy = nextSpyLineup.total - baseSpy;
      const gainCmo = nextCmoLineup.total - baseCmo;
      const focusGain = focusCode === "SPY" ? gainSpy : gainCmo;
      const otherGain = focusCode === "SPY" ? gainCmo : gainSpy;
      if (focusGain <= 0) continue;
      const score = focusGain * 1.5 - Math.max(0, -otherGain) * 0.35;
      options.push({
        fromSpy: spyOut,
        fromCmo: cmoOut,
        gainSpy,
        gainCmo,
        score,
        focusGain,
      });
    }
  }

  if (!options.length) {
    return {
      baseSpy,
      baseCmo,
      best: null,
      alternatives: [],
    };
  }

  options.sort((a, b) => {
    if (b.focusGain !== a.focusGain) return b.focusGain - a.focusGain;
    if (b.score !== a.score) return b.score - a.score;
    return (b.gainSpy + b.gainCmo) - (a.gainSpy + a.gainCmo);
  });
  const best = options[0] || null;

  const distinct = [];
  const usedSpy = new Set();
  const usedCmo = new Set();
  for (const opt of options) {
    const s = String(opt.fromSpy?.id || "");
    const c = String(opt.fromCmo?.id || "");
    if (!s || !c) continue;
    if (usedSpy.has(s) || usedCmo.has(c)) continue;
    distinct.push(opt);
    usedSpy.add(s);
    usedCmo.add(c);
    if (distinct.length >= 3) break;
  }

  if (distinct.length < 3) {
    for (const opt of options) {
      const already = distinct.some(
        (d) => String(d.fromSpy?.id || "") === String(opt.fromSpy?.id || "") && String(d.fromCmo?.id || "") === String(opt.fromCmo?.id || ""),
      );
      if (already) continue;
      distinct.push(opt);
      if (distinct.length >= 3) break;
    }
  }

  return {
    baseSpy,
    baseCmo,
    best: distinct[0] || best,
    alternatives: distinct.slice(1),
  };
}

function sortForWeeklyMax(players, starterIds) {
  const starterSet = new Set(starterIds.map((id) => String(id)));
  return players
    .map((p) => ({
      ...p,
      isStarter: starterSet.has(String(p.id || "")),
      injuryLabel: p.isIR || p.slot === "IR" ? p.injuryStatus || "Injured" : "",
    }))
    .sort((a, b) => {
      const aUnavailable = a.isIR || a.slot === "IR";
      const bUnavailable = b.isIR || b.slot === "IR";
      if (aUnavailable !== bUnavailable) return aUnavailable ? 1 : -1;
      if (b.weekValue !== a.weekValue) return b.weekValue - a.weekValue;
      if (b.games !== a.games) return b.games - a.games;
      return b.avg - a.avg;
    })
    .map((p, idx) => ({
      id: p.id,
      name: p.name,
      avg: p.avg,
      games: p.games,
      weekValue: p.weekValue,
      slot: p.slot,
      isIR: p.isIR,
      injuryStatus: p.injuryStatus,
      injuryLabel: p.injuryLabel,
      isStarter: p.isStarter,
      rank: idx + 1,
    }));
}

app.get("/api/status", async (_req, res) => {
  try {
    const { season } = await withSeasonRetry(async (api) => {
      await api.getGameState();
      return true;
    });
    res.json({ ok: true, authenticated: Boolean(process.env.ESPN_S2 && process.env.SWID), leagueId: LEAGUE_ID, season });
  } catch (err) {
    res.json({ ok: true, authenticated: false, leagueId: LEAGUE_ID, season: CURRENT_YEAR, note: err.message });
  }
});

app.get("/api/bootstrap", async (_req, res) => {
  const { teams } = await loadTeams(1);
  const currentWeek = currentWeekFromDate();
  const options = WEEK_META.map((w) => ({
    week: w.week,
    label: `Week ${w.week} (${w.start.slice(5)} to ${w.end.slice(5)})`,
    start: w.start,
    end: w.end,
    focus: w.focus || "",
  }));

  res.json({
    leagueId: LEAGUE_ID,
    teams: teams.map((t) => ({ code: t.code, name: t.name })),
    weekOptions: options,
    currentWeek,
  });
});

app.get("/api/planner", async (req, res) => {
  const sendWeek = clampWeek(safeNum(req.query.week, currentWeekFromDate()));
  const targetWeek = Math.min(WEEK_META[WEEK_META.length - 1]?.week || 12, sendWeek + 1);
  const meta = weekMeta(targetWeek);
  const sendMeta = weekMeta(sendWeek);
  const data = await loadTeams(targetWeek);
  const teams = data.teams;
  const spy = teams.find((t) => t.code === "SPY") || SEED_TEAMS[0];
  const cmo = teams.find((t) => t.code === "CMO") || SEED_TEAMS[1];

  const spyPlayers = buildWeekPlayers(spy.roster, targetWeek, data.matchupPeriods, data.proTeams, data.scheduleGames);
  const cmoPlayers = buildWeekPlayers(cmo.roster, targetWeek, data.matchupPeriods, data.proTeams, data.scheduleGames);
  const focusCode = meta.focus || (projectedTotal(spyPlayers) < projectedTotal(cmoPlayers) ? "SPY" : "CMO");
  const trade = evaluateBestTrade(spyPlayers, cmoPlayers, focusCode);

  const submitBy = new Date(`${sendMeta.start}T00:00:00Z`);
  const weekStart = new Date(`${meta.start}T00:00:00Z`);

  res.json({
    generatedAt: new Date().toISOString(),
    sendWeek,
    targetWeek,
    sendWeekStart: sendMeta.start,
    sendWeekEnd: sendMeta.end,
    weekStart: meta.start,
    weekEnd: meta.end,
    focusCode,
    focusTeamName: focusCode === "SPY" ? "SPY" : "Warren's Bays",
    timing: {
      today: new Date().toISOString(),
      weekStart: weekStart.toISOString(),
      submitBy: submitBy.toISOString(),
    },
    spy: {
      code: spy.code,
      name: spy.name,
      players: spyPlayers,
      base: trade.baseSpy,
      after: trade.baseSpy + (trade.best?.gainSpy || 0),
      delta: trade.best?.gainSpy || 0,
    },
    cmo: {
      code: cmo.code,
      name: cmo.name,
      players: cmoPlayers,
      base: trade.baseCmo,
      after: trade.baseCmo + (trade.best?.gainCmo || 0),
      delta: trade.best?.gainCmo || 0,
    },
    bestTrade: trade.best,
    alternatives: trade.alternatives,
  });
});

app.get("/api/matchups", async (req, res) => {
  const weeksRaw = String(req.query.weeks || req.query.week || "").trim();
  const teamsRaw = String(req.query.teams || "").trim();

  const weeks = (weeksRaw ? weeksRaw.split(",") : [])
    .map((value) => clampWeek(safeNum(value, 0)))
    .filter((value) => value > 0);
  const selectedWeeks = weeks.length ? [...new Set(weeks)] : [clampWeek(currentWeekFromDate())];

  const requestedTeams = teamsRaw
    ? teamsRaw
        .split(",")
        .map((value) => normalizeTeamCode(value))
        .filter(Boolean)
    : [];

  const weekMetaPayload = selectedWeeks.map((week) => {
    const meta = weekMeta(week);
    return {
      week,
      startDate: meta?.start || "",
      endDate: meta?.end || "",
      focus: meta?.focus || "",
    };
  });

  try {
    const matchups = [];
    let source = "seed";
    for (const week of selectedWeeks) {
      const data = await loadTeams(week);
      source = data.source || source;
      const teams = Array.isArray(data.teams) ? data.teams : [];
      const codeSet = new Set(teams.map((team) => normalizeTeamCode(team.code)).filter(Boolean));
      const teamFilter = requestedTeams.length ? requestedTeams.filter((code) => codeSet.has(code)) : [...codeSet];
      const normalizedFilter = teamFilter.length ? teamFilter : [...codeSet];

      for (const teamCode of normalizedFilter) {
        const team = teams.find((entry) => normalizeTeamCode(entry.code) === teamCode);
        if (!team) continue;
        const oppTeam = teams.find((entry) => normalizeTeamCode(entry.code) !== teamCode) || teams[0];
        const teamPlayers = buildWeekPlayers(team.roster || [], week, data.matchupPeriods, data.proTeams, data.scheduleGames);
        const oppPlayers = buildWeekPlayers(oppTeam?.roster || [], week, data.matchupPeriods, data.proTeams, data.scheduleGames);
        matchups.push({
          week,
          team: teamCode,
          opp: normalizeTeamCode(oppTeam?.code) || "N/A",
          actual: 0,
          reason: "",
          teams: {
            [teamCode]: teamPlayers,
            [normalizeTeamCode(oppTeam?.code) || "N/A"]: oppPlayers,
          },
        });
      }
    }

    res.json({
      source,
      weekMeta: weekMetaPayload,
      matchups,
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to load matchups" });
  }
});

app.get("/api/schedule", async (_req, res) => {
  try {
    const { value } = await withSeasonRetry(async (api) => {
      const schedules = await api.getProTeamSchedules();
      const proTeams = schedules?.settings?.proTeams || [];
      return {
        schedule: flattenScheduleGames(proTeams),
        weekMeta: WEEK_META,
      };
    });
    res.json(value);
  } catch {
    res.json({
      schedule: [],
      weekMeta: WEEK_META,
    });
  }
});

app.get("/api/weekly-max", async (_req, res) => {
  const weekPlans = [];

  for (const w of WEEK_META) {
    const data = await loadTeams(w.week);
    const teams = data.teams;
    const spy = teams.find((t) => t.code === "SPY") || SEED_TEAMS[0];
    const cmo = teams.find((t) => t.code === "CMO") || SEED_TEAMS[1];

    const spyPlayers = buildWeekPlayers(spy.roster, w.week, data.matchupPeriods, data.proTeams, data.scheduleGames);
    const cmoPlayers = buildWeekPlayers(cmo.roster, w.week, data.matchupPeriods, data.proTeams, data.scheduleGames);

    const spyLineup = bestLineup(spyPlayers);
    const cmoLineup = bestLineup(cmoPlayers);

    weekPlans.push({
      week: w.week,
      start: w.start,
      end: w.end,
      focusCode: w.focus || "",
      spy: {
        code: spy.code,
        name: spy.name,
        total: spyLineup.total,
        players: sortForWeeklyMax(spyPlayers, spyLineup.playerIds),
      },
      cmo: {
        code: cmo.code,
        name: cmo.name,
        total: cmoLineup.total,
        players: sortForWeeklyMax(cmoPlayers, cmoLineup.playerIds),
      },
    });
  }

  res.json({
    generatedAt: new Date().toISOString(),
    weeks: weekPlans,
  });
});

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/weekly-max", (_req, res) => res.sendFile(path.join(__dirname, "weekly-max.html")));
app.get("/weekly-max.html", (_req, res) => res.sendFile(path.join(__dirname, "weekly-max.html")));

if (process.env.VERCEL !== "1") {
  const port = safeNum(process.env.PORT, 8787);
  app.listen(port, () => {
    console.log(`WNBA planner running on http://localhost:${port}`);
  });
}

export default app;
