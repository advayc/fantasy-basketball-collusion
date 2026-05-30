const el = {
  apiStatus: document.getElementById("apiStatus"),
  generatedAt: document.getElementById("generatedAt"),
  refreshBtn: document.getElementById("refreshBtn"),
  weekBoards: document.getElementById("weekBoards"),
};

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtNum(n) {
  return Number(n || 0).toFixed(1);
}

function setStatus(text, level = "") {
  el.apiStatus.textContent = text;
  el.apiStatus.className = `status ${level}`.trim();
}

function playerRow(p) {
  const rankClass = !p.isIR && p.rank <= 3 ? `rank-${p.rank}` : "";
  const starter = p.isStarter ? '<span class="chip starter">Starter</span>' : "";
  const injury = p.isIR ? `<span class="chip injury">${p.injuryLabel || "Injured"}</span>` : "";

  return `
    <tr class="${rankClass}">
      <td>${p.rank}</td>
      <td>
        <div class="max-name">${p.name}</div>
        <div class="max-meta">${starter}${injury}</div>
      </td>
      <td>${fmtNum(p.avg)}</td>
      <td>${p.games}</td>
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

function renderBoard(data) {
  el.generatedAt.textContent = fmtDate(data.generatedAt);
  el.weekBoards.innerHTML = (data.weeks || [])
    .map(
      (w) => `
      <section class="card max-week-card">
        <div class="max-week-head">
          <h3>Week ${w.week} <span class="tiny">(${w.start} to ${w.end})</span></h3>
          ${w.focusCode ? `<span class="pill">Focus: ${w.focusCode}</span>` : ""}
        </div>
        <div class="max-team-grid">
          ${teamTable(w.spy)}
          ${teamTable(w.cmo)}
        </div>
      </section>
    `,
    )
    .join("");
}

async function init() {
  try {
    const [status, board] = await Promise.all([
      fetch("/api/status").then((r) => r.json()),
      fetch("/api/weekly-max").then((r) => r.json()),
    ]);

    setStatus(status.authenticated ? "Connected to ESPN." : "Using fallback data until cookies work.", status.authenticated ? "good" : "warn");
    renderBoard(board);
  } catch (err) {
    setStatus(`Error: ${err.message}`, "bad");
  }
}

el.refreshBtn.addEventListener("click", init);

init();
