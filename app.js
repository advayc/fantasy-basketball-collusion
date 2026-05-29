const el = {
  apiStatus: document.getElementById("apiStatus"),
  refreshBtn: document.getElementById("refreshBtn"),
  weekSelect: document.getElementById("weekSelect"),
  weekSummary: document.getElementById("weekSummary"),
  timingTable: document.getElementById("timingTable"),
  tradeCards: document.getElementById("tradeCards"),
  impactTable: document.getElementById("impactTable"),
  spyTitle: document.getElementById("spyTitle"),
  cmoTitle: document.getElementById("cmoTitle"),
  spyRoster: document.getElementById("spyRoster"),
  cmoRoster: document.getElementById("cmoRoster"),
};

const state = {
  weekOptions: [],
  currentWeek: 5,
  latestData: null,
  pointsSort: {
    SPY: "none",
    CMO: "none",
  },
};

function fmtDate(iso) {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtNum(n) {
  return Number(n || 0).toFixed(1);
}

function setStatus(text, level = "") {
  el.apiStatus.textContent = text;
  el.apiStatus.className = `status ${level}`.trim();
}

function gameToneClass(games, maxGames) {
  if (games >= maxGames) return "tone-good";
  if (games >= Math.max(1, maxGames - 1)) return "tone-mid";
  return "tone-bad";
}

function slotRank(slot) {
  if (slot === "G") return 1;
  if (slot === "F/C") return 2;
  if (slot === "UTIL") return 3;
  if (slot === "Bench") return 4;
  if (slot === "IR") return 5;
  return 4;
}

function sortPlayers(players, mode) {
  const ir = players.filter((p) => p.isIR || p.slot === "IR");
  const active = players.filter((p) => !p.isIR && p.slot !== "IR");
  const list = active.slice();

  if (mode === "asc") {
    list.sort((a, b) => a.weekValue - b.weekValue);
  } else if (mode === "desc") {
    list.sort((a, b) => b.weekValue - a.weekValue);
  } else {
    list.sort((a, b) => {
      const r = slotRank(a.slot) - slotRank(b.slot);
      if (r !== 0) return r;
      return (a.sourceIndex || 0) - (b.sourceIndex || 0);
    });
  }

  ir.sort((a, b) => (a.sourceIndex || 0) - (b.sourceIndex || 0));
  return list.concat(ir);
}

function nextSort(mode) {
  if (mode === "none") return "desc";
  if (mode === "desc") return "asc";
  return "none";
}

function pickDistinctOptions(bestTrade, alternatives, limit = 3) {
  const pool = [bestTrade, ...(alternatives || [])].filter(Boolean);
  const picked = [];
  const usedSpy = new Set();
  const usedCmo = new Set();

  for (const option of pool) {
    const spyId = String(option?.fromSpy?.id || "");
    const cmoId = String(option?.fromCmo?.id || "");
    if (!spyId || !cmoId) continue;
    if (usedSpy.has(spyId) || usedCmo.has(cmoId)) continue;
    picked.push(option);
    usedSpy.add(spyId);
    usedCmo.add(cmoId);
    if (picked.length >= limit) break;
  }

  return picked;
}

function renderTradeCard(title, trade, spyName, cmoName, extra = "") {
  if (!trade) {
    return `<article class="trade-card"><h4>${title}</h4><p class="tiny">No trade found.</p></article>`;
  }

  return `
    <article class="trade-card ${extra}">
      <h4>${title}</h4>
      <div class="swap-row">
        <div class="player-chip swap-out roomy">
          <div class="player-meta">
            <div class="name">${trade.fromSpy.name}</div>
            <div class="sub">From ${spyName} | Avg ${fmtNum(trade.fromSpy.avg)} | ${trade.fromSpy.games} games</div>
          </div>
        </div>
        <div class="arrow">for</div>
        <div class="player-chip swap-in roomy">
          <div class="player-meta">
            <div class="name">${trade.fromCmo.name}</div>
            <div class="sub">From ${cmoName} | Avg ${fmtNum(trade.fromCmo.avg)} | ${trade.fromCmo.games} games</div>
          </div>
        </div>
      </div>
      <p class="tiny">${spyName}: ${trade.gainSpy >= 0 ? "+" : ""}${fmtNum(trade.gainSpy)} | ${cmoName}: ${trade.gainCmo >= 0 ? "+" : ""}${fmtNum(trade.gainCmo)}</p>
    </article>
  `;
}

function rosterTable(team, teamCode, outgoingId, outgoingToName, incomingPlayer, incomingFromName, maxGames) {
  const mode = state.pointsSort[teamCode] || "none";
  const sorted = sortPlayers(team.players, mode);

  const rows = sorted
    .map((p) => {
      const isOutgoing = p.id === outgoingId;
      const tone = gameToneClass(p.games, maxGames);
      const tradedText = isOutgoing ? `<span class="trade-tag">Traded to ${outgoingToName}</span>` : "";
      const irText = p.isIR ? `<span class="ir-text">IR</span>` : "";
      return `
        <div class="roster-row ${isOutgoing ? "traded-row" : ""}">
          <div class="cell slot">${p.slot || "Bench"}</div>
          <div class="cell player">
            <div class="name">${p.name}</div>
            <div class="sub">${tradedText} ${irText}</div>
          </div>
          <div class="cell avg">${fmtNum(p.avg)}</div>
          <div class="cell games ${tone}">${p.games}</div>
          <div class="cell pts">${fmtNum(p.weekValue)}</div>
        </div>
      `;
    })
    .join("");

  const incoming = incomingPlayer
    ? `<div class="incoming-note">Incoming if accepted: <strong>${incomingPlayer.name}</strong> from ${incomingFromName}</div>`
    : "";

  return `
    ${incoming}
    <div class="roster-header">
      <div class="cell slot">Slot</div>
      <div class="cell player">Player</div>
      <div class="cell avg">Avg</div>
      <div class="cell games">Gms</div>
      <button class="cell pts points-toggle" data-team="${teamCode}">Points</button>
    </div>
    ${rows}
  `;
}

function render(data) {
  state.latestData = data;

  el.spyTitle.textContent = data.spy.name;
  el.cmoTitle.textContent = data.cmo.name;

  const focusLabel = data.focusCode === "SPY" ? data.spy.name : data.cmo.name;
  el.weekSummary.innerHTML = `
    <p><strong>Send In Week ${data.sendWeek}</strong> (${data.sendWeekStart} to ${data.sendWeekEnd})</p>
    <p><strong>Targets Matchup Week ${data.targetWeek}</strong> (${data.weekStart} to ${data.weekEnd})</p>
    <p>Focus team for target week: <span class="pill">${focusLabel}</span></p>
  `;

  const timingRows = [
    ["Today", fmtDate(data.timing.today)],
    ["Send Week Starts", fmtDate(data.timing.submitBy)],
    ["Target Matchup Starts", fmtDate(data.timing.weekStart)],
    ["Trade Should Be Sent", fmtDate(data.timing.submitBy)],
  ];
  el.timingTable.innerHTML = `
    <table>
      <thead><tr><th>Milestone</th><th>Date</th></tr></thead>
      <tbody>${timingRows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</tbody>
    </table>
  `;

  const options = pickDistinctOptions(data.bestTrade, data.alternatives, 3);
  el.tradeCards.innerHTML = [
    renderTradeCard("Option 1", options[0], data.spy.name, data.cmo.name, "option-1"),
    renderTradeCard("Option 2", options[1], data.spy.name, data.cmo.name),
    renderTradeCard("Option 3", options[2], data.spy.name, data.cmo.name),
  ].join("");

  el.impactTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Team</th>
          <th>Before</th>
          <th>After (Option 1)</th>
          <th>Delta</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${data.spy.name}</td>
          <td>${fmtNum(data.spy.base)}</td>
          <td>${fmtNum(data.spy.after)}</td>
          <td>${data.spy.delta >= 0 ? "+" : ""}${fmtNum(data.spy.delta)}</td>
        </tr>
        <tr>
          <td>${data.cmo.name}</td>
          <td>${fmtNum(data.cmo.base)}</td>
          <td>${fmtNum(data.cmo.after)}</td>
          <td>${data.cmo.delta >= 0 ? "+" : ""}${fmtNum(data.cmo.delta)}</td>
        </tr>
      </tbody>
    </table>
  `;

  const maxGames = Math.max(
    ...data.spy.players.map((p) => p.games || 0),
    ...data.cmo.players.map((p) => p.games || 0),
    1,
  );

  el.spyRoster.innerHTML = rosterTable(
    data.spy,
    "SPY",
    data.bestTrade?.fromSpy?.id || "",
    data.cmo.name,
    data.bestTrade?.fromCmo || null,
    data.cmo.name,
    maxGames,
  );

  el.cmoRoster.innerHTML = rosterTable(
    data.cmo,
    "CMO",
    data.bestTrade?.fromCmo?.id || "",
    data.spy.name,
    data.bestTrade?.fromSpy || null,
    data.spy.name,
    maxGames,
  );
}

async function loadPlanner() {
  const week = Number(el.weekSelect.value || state.currentWeek || 5);
  const res = await fetch(`/api/planner?week=${week}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to load planner." }));
    throw new Error(err.message || "Failed to load planner.");
  }
  render(await res.json());
}

function renderWeeks(options, currentWeek) {
  el.weekSelect.innerHTML = options
    .map((w) => `<option value="${w.week}" ${w.week === currentWeek ? "selected" : ""}>${w.label}</option>`)
    .join("");
}

function handleSortClick(e) {
  const btn = e.target.closest(".points-toggle");
  if (!btn) return;
  const team = btn.getAttribute("data-team");
  if (!team) return;
  state.pointsSort[team] = nextSort(state.pointsSort[team] || "none");
  if (state.latestData) render(state.latestData);
}

async function init() {
  try {
    const status = await fetch("/api/status").then((r) => r.json());
    setStatus(status.authenticated ? "Connected to ESPN." : "Using fallback data until cookies work.", status.authenticated ? "good" : "warn");

    const bootstrap = await fetch("/api/bootstrap").then((r) => r.json());
    state.weekOptions = bootstrap.weekOptions || [];
    state.currentWeek = bootstrap.currentWeek || 5;
    renderWeeks(state.weekOptions, state.currentWeek);
    await loadPlanner();
  } catch (err) {
    setStatus(`Error: ${err.message}`, "bad");
  }
}

el.weekSelect.addEventListener("change", () => {
  loadPlanner().catch((err) => setStatus(`Error: ${err.message}`, "bad"));
});

el.refreshBtn.addEventListener("click", () => {
  init();
});

el.spyRoster.addEventListener("click", handleSortClick);
el.cmoRoster.addEventListener("click", handleSortClick);

init();
