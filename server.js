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
      };
    });
    return value;
  } catch {
    return {
      teams: SEED_TEAMS,
      matchupPeriods: {},
      proTeams: [],
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

function buildWeekPlayers(roster, week, matchupPeriods, proTeams) {
  return roster
    .map((p, idx) => ({
      id: String(p.id || ""),
      name: p.name,
      avg: safeNum(p.avg, 0),
      pos: safeNum(p.pos, 0),
      position: p.position || positionLabel(p.pos),
      slot: p.slot || slotLabel(p.lineupSlotId),
      isIR: Boolean(p.isIR),
      injuryStatus: p.injuryStatus || "NORMAL",
      sourceIndex: safeNum(p.sourceIndex, idx),
      games: gamesForPlayerWeek(p, week, matchupPeriods, proTeams),
      weekValue: safeNum(p.avg, 0) * gamesForPlayerWeek(p, week, matchupPeriods, proTeams),
      headshot: normalizeHeadshot(p.id),
    }));
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
    return { feasible: false, total: 0 };
  }

  let best = -Infinity;
  const used = new Set();

  function dfs(slotIdx, total) {
    if (slotIdx >= STARTING_SLOTS.length) {
      if (total > best) best = total;
      return;
    }

    const slot = STARTING_SLOTS[slotIdx];
    for (let i = 0; i < active.length; i += 1) {
      const p = active[i];
      const id = String(p.id || i);
      if (used.has(id)) continue;
      if (!isEligibleForSlot(p, slot)) continue;
      used.add(id);
      dfs(slotIdx + 1, total + safeNum(p.weekValue, 0));
      used.delete(id);
    }
  }

  dfs(0, 0);
  if (best === -Infinity) {
    return { feasible: false, total: 0 };
  }

  return { feasible: true, total: best };
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
      const score = focusGain * 1.5 - Math.max(0, -otherGain) * 0.35;
      options.push({
        fromSpy: spyOut,
        fromCmo: cmoOut,
        gainSpy,
        gainCmo,
        score,
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

  options.sort((a, b) => b.score - a.score);
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

  const spyPlayers = buildWeekPlayers(spy.roster, targetWeek, data.matchupPeriods, data.proTeams);
  const cmoPlayers = buildWeekPlayers(cmo.roster, targetWeek, data.matchupPeriods, data.proTeams);
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

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

const port = safeNum(process.env.PORT, 8787);
app.listen(port, () => {
  console.log(`WNBA planner running on http://localhost:${port}`);
});
