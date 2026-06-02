const el = {
  apiStatus: document.getElementById("apiStatus"),
  generatedAt: document.getElementById("generatedAt"),
  refreshBtn: document.getElementById("refreshBtn"),
  weekSelect: document.getElementById("weekSelect"),
  weekBoards: document.getElementById("weekBoards"),
};

const state = {
  board: null,
  selectedWeek: null,
};

function fmtDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtNum(n) {
  return Number(n || 0).toFixed(1);
}

function fmtGameDays(gameDates = []) {
  const list = Array.isArray(gameDates) ? gameDates.filter(Boolean) : [];
  if (!list.length) return "Days unavailable";
  return list
    .map((date) => {
      const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return String(date).slice(0, 10);
      return parsed.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    })
    .join(", ");
}

function setStatus(text, level = "") {
  el.apiStatus.textContent = text;
  el.apiStatus.className = `status ${level}`.trim();
}

function playerRow(p) {
  const rankClass = !p.isIR && p.rank <= 3 ? `rank-${p.rank}` : "";
  const starter = p.isStarter ? '<span class="chip starter">Starter</span>' : "";
  const injury = p.isIR ? `<span class="chip injury">${p.injuryLabel || "Injured"}</span>` : "";
  const gameDays = fmtGameDays(p.gameDates);

  return `
    <tr class="${rankClass}">
      <td>${p.rank}</td>
      <td>
        <div class="max-name">${p.name}</div>
        <div class="max-meta">${starter}${injury}</div>
        <div class="tiny game-days" title="${gameDays}">${gameDays}</div>
      </td>
      <td>${fmtNum(p.avg)}</td>
      <td title="${gameDays}">${p.games}</td>
      <td>${fmtNum(p.weekValue)}</td>
    </tr>
  `;
}

function teamTable(team) {
  return `
    <article class="max-team-card">
      <div class="max-team-head">
        <h4>${team.name}</h4>
        <p>Best feasible lineup total: <strong>${fmtNum(team.total)}</strong></p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Avg</th>
              <th>Gms</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            ${team.players.map(playerRow).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderWeekOptions(weeks, preferredWeek) {
  const list = Array.isArray(weeks) ? weeks : [];
  if (!list.length) {
    el.weekSelect.innerHTML = "";
    state.selectedWeek = null;
    return;
  }

  const exists = list.some((w) => Number(w.week) === Number(preferredWeek));
  state.selectedWeek = exists ? Number(preferredWeek) : Number(list[0].week);
  el.weekSelect.innerHTML = list
    .map((w) => `<option value="${w.week}" ${Number(w.week) === state.selectedWeek ? "selected" : ""}>Week ${w.week} (${w.start.slice(5)} to ${w.end.slice(5)})</option>`)
    .join("");
}

function renderSelectedWeek() {
  const weeks = state.board?.weeks || [];
  const selected = weeks.find((w) => Number(w.week) === Number(state.selectedWeek)) || weeks[0] || null;
  if (!selected) {
    el.weekBoards.innerHTML = '<section class="card"><p class="tiny">No matchup data available.</p></section>';
    return;
  }

  el.weekBoards.innerHTML = `
      <section class="card max-week-card">
        <div class="max-week-head">
          <h3>Week ${selected.week} <span class="tiny">(${selected.start} to ${selected.end})</span></h3>
          ${selected.focusCode ? `<span class="pill">Focus: ${selected.focusCode}</span>` : ""}
        </div>
        <div class="max-team-grid">
          ${teamTable(selected.spy)}
          ${teamTable(selected.cmo)}
        </div>
      </section>
    `;
}

function renderBoard(data, preferredWeek) {
  state.board = data;
  el.generatedAt.textContent = fmtDateTime(data.generatedAt);
  renderWeekOptions(data.weeks || [], preferredWeek);
  renderSelectedWeek();
}

async function init() {
  try {
    const currentSelection = Number(el.weekSelect.value || state.selectedWeek || 0);
    const [status, bootstrap, board] = await Promise.all([
      fetch("/api/status", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/bootstrap", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/weekly-max", { cache: "no-store" }).then((r) => r.json()),
    ]);

    setStatus(status.authenticated ? "Connected to ESPN." : "Using fallback data until cookies work.", status.authenticated ? "good" : "warn");
    const preferredWeek = currentSelection || Number(bootstrap.currentWeek || 0) || Number(board.weeks?.[0]?.week || 0);
    renderBoard(board, preferredWeek);
  } catch (err) {
    setStatus(`Error: ${err.message}`, "bad");
  }
}

function handleWeekChange() {
  state.selectedWeek = Number(el.weekSelect.value || 0);
  renderSelectedWeek();
}

el.refreshBtn.addEventListener("click", init);
el.weekSelect.addEventListener("change", handleWeekChange);

init();
