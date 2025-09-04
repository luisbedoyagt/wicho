// js/app.js
// Lógica principal de la aplicación: fetch, normalización, UI, cálculo y combinación de pronósticos.
// Importa constantes de ligas desde js/ligas.js
import { leagueNames, leagueCodeToName, leagueRegions } from './ligas.js';

// ----------------------
// UTILIDADES
// ----------------------
const $ = id => document.getElementById(id);
const formatPct = x => (100 * (isFinite(x) ? x : 0)).toFixed(1) + '%';
const formatDec = x => (isFinite(x) ? x.toFixed(2) : '0.00');

function parseNumberString(val) {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim().replace(/\s+/g, '');
  // thousand and decimal heuristics
  if ((s.match(/\./g) || []).length > 0 && (s.match(/,/g) || []).length > 0) {
    return Number(s.replace(/,/g, '')) || 0;
  }
  if ((s.match(/,/g) || []).length > 0 && (s.match(/\./g) || []).length === 0) {
    return Number(s.replace(/,/g, '.')) || 0;
  }
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function normalizeStr(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

function escapeRegex(s) {
  if (!s) return '';
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ----------------------
// POISSON & MATH HELPERS
// ----------------------
function factorial(n) {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function poissonProbability(lambda, k) {
  if (!isFinite(lambda) || lambda <= 0) return k === 0 ? 1 : 0;
  if (k < 0) return 0;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

// ----------------------
// NORMALIZACIÓN DE EQUIPOS
// ----------------------
function normalizeTeam(raw) {
  if (!raw) return null;
  const r = {};
  r.name = raw.name || raw.team_name || raw.team || raw.club || '';
  if (!r.name) return null;
  r.pos = parseNumberString(raw.rank ?? raw.position ?? raw.pos ?? 0);
  r.gf = parseNumberString(raw.goalsFor ?? raw.goals_for ?? raw.gf ?? 0);
  r.ga = parseNumberString(raw.goalsAgainst ?? raw.goals_against ?? raw.ga ?? 0);
  r.pj = parseNumberString(raw.gamesPlayed ?? raw.played ?? raw.pj ?? 0);
  r.g = parseNumberString(raw.wins ?? raw.win ?? raw.g ?? 0);
  r.e = parseNumberString(raw.ties ?? raw.draws ?? raw.d ?? raw.e ?? 0);
  r.p = parseNumberString(raw.losses ?? raw.lose ?? raw.l ?? 0);
  r.points = parseNumberString(raw.points ?? raw.pts ?? (r.g * 3 + r.e));
  r.gfHome = parseNumberString(raw.goalsForHome ?? raw.goals_for_home ?? raw.gfHome ?? 0);
  r.gfAway = parseNumberString(raw.goalsForAway ?? raw.goals_for_away ?? raw.gfAway ?? 0);
  r.gaHome = parseNumberString(raw.goalsAgainstHome ?? raw.goals_against_home ?? raw.gaHome ?? 0);
  r.gaAway = parseNumberString(raw.goalsAgainstAway ?? raw.goals_against_away ?? raw.gaAway ?? 0);
  r.pjHome = parseNumberString(raw.gamesPlayedHome ?? raw.played_home ?? raw.pjHome ?? 0);
  r.pjAway = parseNumberString(raw.gamesPlayedAway ?? raw.played_away ?? raw.pjAway ?? 0);
  r.winsHome = parseNumberString(raw.winsHome ?? raw.win_home ?? raw.home_wins ?? 0);
  r.winsAway = parseNumberString(raw.winsAway ?? raw.win_away ?? raw.away_wins ?? 0);
  r.logoUrl = raw.logoUrl || raw.logo || raw.badge || raw.team_logo || '';
  return r;
}

// ----------------------
// PARSEO DE TEXTO (IA) - flexible
// ----------------------
function parsePlainText(text, matchData = { local: '', visitante: '' }) {
  text = String(text || '');
  const aiProbs = { home: null, draw: null, away: null };
  const aiJust = { home: 'Sin justificación detallada.', draw: 'Sin justificación detallada.', away: 'Sin justificación detallada.' };

  // Try capture probability blocks
  const probPatterns = [
    /Probabilidades(?:\s*1X2)?\s*:\s*([\s\S]*?)(?:BTTS|Análisis|$)/i,
    /1X2\s*[:\-]\s*([\s\S]*?)(?:BTTS|Análisis|$)/i,
    /Prob\s*1X2\s*[:\-]?\s*([\s\S]*?)(?:BTTS|Análisis|$)/i
  ];
  let probsText = null;
  for (const p of probPatterns) {
    const m = text.match(p);
    if (m && m[1]) { probsText = m[1]; break; }
  }

  if (probsText) {
    const perc = (probsText.match(/(\d+(?:\.\d+)?)%/g) || []).map(x => parseFloat(x.replace('%','')));
    if (perc.length >= 3) {
      aiProbs.home = perc[0] / 100;
      aiProbs.draw = perc[1] / 100;
      aiProbs.away = perc[2] / 100;
    } else {
      // labeled extraction fallback
      const labeled = probsText.match(/(?:Local|Casa|1)[:\s]*?(\d+(?:\.\d+)?)%[\s\S]*?(?:Empate|X)[:\s]*?(\d+(?:\.\d+)?)%[\s\S]*?(?:Visitante|2|Fuera)[:\s]*?(\d+(?:\.\d+)?)%/i);
      if (labeled) {
        aiProbs.home = parseFloat(labeled[1]) / 100;
        aiProbs.draw = parseFloat(labeled[2]) / 100;
        aiProbs.away = parseFloat(labeled[3]) / 100;
      }
    }
  } else {
    // global fallback: any three consecutive percentages
    const allPerc = (text.match(/(\d+(?:\.\d+)?)%/g) || []).map(x => parseFloat(x.replace('%','')));
    if (allPerc.length >= 3) {
      aiProbs.home = allPerc[0] / 100;
      aiProbs.draw = allPerc[1] / 100;
      aiProbs.away = allPerc[2] / 100;
    }
  }

  // Justifications: try to capture "Análisis" block and split by labels
  const analysisMatch = text.match(/Análisis(?: del Partido)?:\s*([\s\S]*?)(?:Probabilidades|$)/i) || text.match(/Análisis:\s*([\s\S]*?)(?:Probabilidades|$)/i);
  if (analysisMatch && analysisMatch[1]) {
    const a = analysisMatch[1];
    const localRegex = new RegExp(`${escapeRegex(matchData.local || '')}[:\\-\\s]*([\\s\\S]*?)(?:Empate[:\\-\\s]|${escapeRegex(matchData.visitante || '')}[:\\-\\s]|$)`, 'i');
    const drawRegex = /Empate[:\-\s]*([\s\S]*?)(?:(?:[^:]+:)|$)/i;
    const awayRegex = new RegExp(`${escapeRegex(matchData.visitante || '')}[:\\-\\s]*([\\s\\S]*?)(?:Probabilidades|$)`, 'i');
    const localJ = a.match(localRegex);
    const drawJ = a.match(drawRegex);
    const awayJ = a.match(awayRegex);
    if (localJ && localJ[1]) aiJust.home = localJ[1].trim();
    if (drawJ && drawJ[1]) aiJust.draw = drawJ[1].trim();
    if (awayJ && awayJ[1]) aiJust.away = awayJ[1].trim();
  }

  // BTTS and Over/Under
  const bttsYes = text.match(/BTTS\s*(?:[:\-])?\s*(?:Si|Sí|Yes|S)[:\s]*(\d+(?:\.\d+)?)%/i) || text.match(/Both\s*Teams\s*To\s*Score\s*(?:[:\-])?\s*(\d+(?:\.\d+)?)%/i);
  const bttsNo = text.match(/BTTS\s*(?:[:\-])?\s*(?:No)[:\s]*(\d+(?:\.\d+)?)%/i);
  const over25 = text.match(/(?:Más|Mas|Over)\s*2\.?5\s*(?:[:\-])?\s*(\d+(?:\.\d+)?)%/i) || text.match(/(\d+(?:\.\d+)?)%\s*(?:over|más|mas)\s*2\.?5/i);
  const under25 = text.match(/(?:Menos|Under)\s*2\.?5\s*(?:[:\-])?\s*(\d+(?:\.\d+)?)%/i) || text.match(/(\d+(?:\.\d+)?)%\s*(?:under|menos)\s*2\.?5/i);

  const result = {
    "1X2": {
      victoria_local: { probabilidad: aiProbs.home !== null ? (aiProbs.home * 100).toFixed(0) + '%' : 'N/D', justificacion: aiJust.home },
      empate: { probabilidad: aiProbs.draw !== null ? (aiProbs.draw * 100).toFixed(0) + '%' : 'N/D', justificacion: aiJust.draw },
      victoria_visitante: { probabilidad: aiProbs.away !== null ? (aiProbs.away * 100).toFixed(0) + '%' : 'N/D', justificacion: aiJust.away }
    },
    "BTTS": {
      si: { probabilidad: bttsYes ? (parseFloat(bttsYes[1]).toFixed(0) + '%') : 'N/D', justificacion: '' },
      no: { probabilidad: bttsNo ? (parseFloat(bttsNo[1]).toFixed(0) + '%') : 'N/D', justificacion: '' }
    },
    "Goles": {
      mas_2_5: { probabilidad: over25 ? (parseFloat(over25[1]).toFixed(0) + '%') : 'N/D', justificacion: '' },
      menos_2_5: { probabilidad: under25 ? (parseFloat(under25[1]).toFixed(0) + '%') : 'N/D', justificacion: '' }
    }
  };

  return result;
}

// ----------------------
// FETCH DATOS COMPLETOS (WEBAPP)
// ----------------------
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzcrFrU34kJS0cjAq0YfUTU1XTfGUuEnBfohYJaljkcxRqlfa879ALvWsYHy7E8UVp0/exec';
let teamsByLeague = {};
let allData = {};
let eventInterval = null;

async function fetchAllData() {
  const leagueSelect = $('leagueSelect');
  if (leagueSelect) {
    leagueSelect.innerHTML = '<option value="">Cargando datos...</option>';
    leagueSelect.style.display = 'block';
  }
  try {
    console.log('[fetchAllData] solicitando datos a', WEBAPP_URL);
    const res = await fetch(`${WEBAPP_URL}?tipo=todo&update=false`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${res.statusText} ${text}`);
    }
    allData = await res.json();
    if (!allData) throw new Error('Respuesta vacía');
    // Build teamsByLeague robustly
    teamsByLeague = {};
    const srcLigas = allData.ligas || {};
    for (const key in srcLigas) {
      const arr = Array.isArray(srcLigas[key]) ? srcLigas[key] : [];
      teamsByLeague[key] = arr.map(normalizeTeam).filter(Boolean);
    }
    // Map known codes
    for (const code in leagueCodeToName) {
      const name = leagueCodeToName[code];
      if (teamsByLeague[code] && teamsByLeague[code].length) continue;
      if (teamsByLeague[name] && teamsByLeague[name].length) { teamsByLeague[code] = teamsByLeague[name]; continue; }
      if (allData.ligas && allData.ligas[name] && Array.isArray(allData.ligas[name])) {
        teamsByLeague[code] = allData.ligas[name].map(normalizeTeam).filter(Boolean);
        continue;
      }
      teamsByLeague[code] = teamsByLeague[code] || [];
    }
    try { localStorage.setItem('allData', JSON.stringify(allData)); } catch (e) { /* ignore */ }
    return allData;
  } catch (err) {
    console.error('[fetchAllData] error', err);
    const details = $('details');
    if (details) details.innerHTML = `<div class="error"><strong>Error:</strong> ${err.message}</div>`;
    if (leagueSelect) leagueSelect.innerHTML = '<option value="">Error al cargar ligas</option>';
    return {};
  }
}

// ----------------------
// DISPLAY EVENTS (UI)
// ----------------------
function displaySelectedLeagueEvents(leagueCode) {
  const selectedEventsList = $('selected-league-events');
  if (!selectedEventsList) return;
  if (eventInterval) { clearInterval(eventInterval); eventInterval = null; }
  selectedEventsList.innerHTML = '';

  if (!leagueCode || !allData.calendario) {
    selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>Selecciona una liga para ver eventos próximos.</span></div>';
    return;
  }

  const ligaName = leagueCodeToName[leagueCode] || leagueCode;
  const events = allData.calendario[ligaName] || allData.calendario[leagueCode] || [];

  if (!Array.isArray(events) || events.length === 0) {
    selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos para esta liga.</span></div>';
    return;
  }

  // sanitize & parse event dates
  const sanitized = events.map(ev => {
    try { if (ev.pronostico_json && typeof ev.pronostico_json === 'string') ev.pronostico_json = JSON.parse(ev.pronostico_json); } catch(e){}
    return ev;
  }).filter(ev => ev && (ev.local || ev.home || ev.team_home) && (ev.visitante || ev.away || ev.team_away));

  if (sanitized.length === 0) {
    selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos con datos válidos.</span></div>';
    return;
  }

  const eventsPerPage = 3;
  let page = 0;
  const totalPages = Math.ceil(sanitized.length / eventsPerPage);

  function parseEventDateString(dateStr) {
    if (!dateStr) return null;
    let s = String(dateStr).trim();
    if (s.includes('T') || s.endsWith('Z') || s.includes('+')) {
      const d = new Date(s);
      if (!isNaN(d)) return d;
    }
    if (/\d{4}[-\/]\d{2}[-\/]\d{2}/.test(s) && /\d{1,2}:\d{2}/.test(s)) {
      s = s.replace(' ', 'T');
      if (!s.toLowerCase().includes('z') && !/[+-]\d{2}:?\d{2}/.test(s)) s += 'Z';
      const d = new Date(s);
      if (!isNaN(d)) return d;
    }
    const parts = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2})/);
    if (parts) {
      const iso = `${parts[3]}-${String(parts[2]).padStart(2,'0')}-${String(parts[1]).padStart(2,'0')}T${parts[4]}Z`;
      const d = new Date(iso);
      if (!isNaN(d)) return d;
    }
    const fallback = new Date(s);
    if (!isNaN(fallback)) return fallback;
    return null;
  }

  function showPage() {
    selectedEventsList.innerHTML = '';
    const start = page * eventsPerPage;
    const toShow = sanitized.slice(start, start + eventsPerPage);
    toShow.forEach((ev, idx) => {
      const localName = ev.local || ev.home || ev.team_home || 'Local';
      const awayName = ev.visitante || ev.away || ev.team_away || 'Visitante';
      const div = document.createElement('div');
      div.className = 'event-item';
      div.dataset.home = localName;
      div.dataset.away = awayName;
      let dateText = ev.fecha || ev.date || ev.datetime || 'Fecha no disponible';
      try {
        const d = parseEventDateString(ev.fecha || ev.date || ev.datetime || '');
        if (d) {
          const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Guatemala' };
          const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guatemala' };
          dateText = `${d.toLocaleDateString('es-ES', dateOptions)} ${d.toLocaleTimeString('es-ES', timeOptions)} (GT)`;
        }
      } catch(e){}
      div.innerHTML = `<strong>${localName} vs. ${awayName}</strong><span>${ev.estadio || ev.stadium || 'Estadio: Por confirmar'}</span><span>${dateText}</span>`;
      div.addEventListener('click', () => {
        if (div.classList.contains('in-progress')) return;
        selectEvent(localName, awayName);
      });
      selectedEventsList.appendChild(div);
    });
    page = (page + 1) % totalPages;
  }

  showPage();
  if (totalPages > 1) eventInterval = setInterval(showPage, 10000);
}

// ----------------------
// UI: Seleccionar evento -> rellenar selects
// ----------------------
function selectEvent(homeTeamName, awayTeamName) {
  const teamHomeSelect = $('teamHome');
  const teamAwaySelect = $('teamAway');

  // try find exact option or partial normalized match
  const findOption = (select, name) => {
    const norm = normalizeStr(name);
    let opt = Array.from(select.options).find(o => normalizeStr(o.text) === norm);
    if (!opt) opt = Array.from(select.options).find(o => normalizeStr(o.text).includes(norm) || norm.includes(normalizeStr(o.text)));
    return opt;
  };

  const homeOpt = findOption(teamHomeSelect, homeTeamName);
  const awayOpt = findOption(teamAwaySelect, awayTeamName);

  if (homeOpt) teamHomeSelect.value = homeOpt.value;
  if (awayOpt) teamAwaySelect.value = awayOpt.value;

  if (teamHomeSelect.value && teamAwaySelect.value) {
    fillTeamData(teamHomeSelect.value, $('leagueSelect').value, 'Home');
    fillTeamData(teamAwaySelect.value, $('leagueSelect').value, 'Away');
    calculateAll();
  } else {
    const details = $('details');
    if (details) details.innerHTML = `<div class="error"><strong>Error:</strong> No se pudo encontrar uno o ambos equipos en la lista de la liga.</div>`;
  }
}

// ----------------------
// VALIDACIONES UI
// ----------------------
function restrictSameTeam() {
  const teamHome = $('teamHome').value;
  const teamAway = $('teamAway').value;
  if (teamHome && teamAway && teamHome === teamAway) {
    const details = $('details');
    if (details) details.innerHTML = '<div class="error"><strong>Error:</strong> No puedes seleccionar el mismo equipo para local y visitante.</div>';
    if (document.activeElement === $('teamHome')) {
      $('teamHome').value = '';
      clearTeamData('Home');
    } else {
      $('teamAway').value = '';
      clearTeamData('Away');
    }
    return false;
  }
  return true;
}

function clearTeamData(type) {
  const elPos = $(`pos${type}`); if (elPos) elPos.textContent = '--';
  const elGf = $(`gf${type}`); if (elGf) elGf.textContent = '--';
  const elGa = $(`ga${type}`); if (elGa) elGa.textContent = '--';
  const elWin = $(`winRate${type}`); if (elWin) elWin.textContent = '--';

  const box = $(`form${type}Box`);
  if (box) {
    box.innerHTML = `
      <div class="team-details">
        <div class="stat-section">
          <span class="section-title">General</span>
          <div class="stat-metrics"><span>PJ: 0</span><span>Puntos: 0</span><span>DG: 0</span></div>
        </div>
        <div class="stat-section">
          <span class="section-title">Local</span>
          <div class="stat-metrics"><span>PJ: 0</span><span>PG: 0</span><span>DG: 0</span></div>
        </div>
        <div class="stat-section">
          <span class="section-title">Visitante</span>
          <div class="stat-metrics"><span>PJ: 0</span><span>PG: 0</span><span>DG: 0</span></div>
        </div>
      </div>`;
  }

  const cardHeader = $(`card-${type.toLowerCase()}`)?.querySelector('.card-header');
  const logoImg = cardHeader ? cardHeader.querySelector('.team-logo') : null;
  if (logoImg) logoImg.remove();
}

function clearAll() {
  document.querySelectorAll('.stat-value').forEach(el => el.textContent = '--');
  document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
  ['pHome','pDraw','pAway','pBTTS','pO25'].forEach(id => { const el = $(id); if (el) el.textContent = '--'; });
  const detailedPrediction = $('detailed-prediction'); if (detailedPrediction) detailedPrediction.innerHTML = '<p>Esperando pronóstico detallado...</p>';
  const details = $('details'); if (details) details.innerHTML = 'Detalles del Pronóstico';
  const suggestion = $('suggestion'); if (suggestion) suggestion.innerHTML = '<p>Esperando datos...</p>';
  const combined = $('combined-prediction'); if (combined) combined.innerHTML = '<p>Esperando pronóstico combinado...</p>';
  clearTeamData('Home'); clearTeamData('Away');
  displaySelectedLeagueEvents('');
}

// ----------------------
// BÚSQUEDA Y LLENADO DE EQUIPO
// ----------------------
function findTeam(leagueCode, teamName) {
  if (!teamsByLeague[leagueCode]) return null;
  const normalizedName = normalizeStr(teamName);
  let found = teamsByLeague[leagueCode].find(t => normalizeStr(t.name) === normalizedName);
  if (!found) found = teamsByLeague[leagueCode].find(t => normalizeStr(t.name).includes(normalizedName) || normalizedName.includes(normalizeStr(t.name)));
  return found || null;
}

function fillTeamData(teamName, leagueCode, type) {
  const t = findTeam(leagueCode, teamName);
  if (!t) {
    const details = $('details'); if (details) details.innerHTML = `<div class="error"><strong>Error:</strong> Equipo ${teamName} no encontrado en la liga seleccionada.</div>`;
    return;
  }
  $(`pos${type}`).textContent = t.pos || '--';
  $(`gf${type}`).textContent = formatDec((t.gf || 0) / (t.pj || 1));
  $(`ga${type}`).textContent = formatDec((t.ga || 0) / (t.pj || 1));
  $(`winRate${type}`).textContent = formatPct(t.pj ? (t.g || 0) / (t.pj || 1) : 0);

  const dg = (t.gf || 0) - (t.ga || 0);
  const dgHome = (t.gfHome || 0) - (t.gaHome || 0);
  const dgAway = (t.gfAway || 0) - (t.gaAway || 0);

  const box = $(`form${type}Box`);
  if (box) {
    box.innerHTML = `
      <div class="team-details">
        <div class="stat-section">
          <span class="section-title">General</span>
          <div class="stat-metrics"><span>PJ: ${t.pj || 0}</span><span>Puntos: ${t.points || 0}</span><span>DG: ${dg >= 0 ? '+'+dg : dg || 0}</span></div>
        </div>
        <div class="stat-section">
          <span class="section-title">Local</span>
          <div class="stat-metrics"><span>PJ: ${t.pjHome || 0}</span><span>PG: ${t.winsHome || 0}</span><span>DG: ${dgHome >=0 ? '+'+dgHome : dgHome || 0}</span></div>
        </div>
        <div class="stat-section">
          <span class="section-title">Visitante</span>
          <div class="stat-metrics"><span>PJ: ${t.pjAway || 0}</span><span>PG: ${t.winsAway || 0}</span><span>DG: ${dgAway >=0 ? '+'+dgAway : dgAway || 0}</span></div>
        </div>
      </div>`;
  }

  const cardHeader = $(`card-${type.toLowerCase()}`)?.querySelector('.card-header');
  if (cardHeader) {
    let logoImg = cardHeader.querySelector('.team-logo');
    if (!logoImg) {
      logoImg = document.createElement('img');
      logoImg.className = 'team-logo';
      logoImg.alt = `Logo de ${t.name}`;
      const h3 = cardHeader.querySelector('h3');
      if (h3) h3.insertAdjacentElement('beforebegin', logoImg);
    }
    logoImg.src = t.logoUrl || '';
    logoImg.style.display = t.logoUrl ? 'inline-block' : 'none';
  }
}

// ----------------------
// DIXON-COLES (simplified but robust) + shrinkage
// ----------------------
function dixonColesProbabilities(tH, tA, league) {
  const rho = -0.11;
  const shrinkageFactor = 1.0;
  const teams = teamsByLeague[league] || [];
  let totalGames = 0, totalGfHome = 0, totalGaHome = 0, totalGfAway = 0, totalGaAway = 0;
  teams.forEach(t => { totalGames += t.pj || 0; totalGfHome += t.gfHome || 0; totalGaHome += t.gaHome || 0; totalGfAway += t.gfAway || 0; totalGaAway += t.gaAway || 0; });

  const denom = totalGames || 1;
  const leagueAvgGfHome = totalGfHome / denom || 1;
  const leagueAvgGaAway = totalGaAway / denom || 1;
  const leagueAvgGfAway = totalGfAway / denom || 1;
  const leagueAvgGaHome = totalGaHome / denom || 1;

  const safeDiv = (a,b) => b ? a/b : 0;
  const homeAttackRaw = safeDiv(tH.gfHome || 0, tH.pjHome || 1);
  const homeDefenseRaw = safeDiv(tH.gaHome || 0, tH.pjHome || 1);
  const awayAttackRaw = safeDiv(tA.gfAway || 0, tA.pjAway || 1);
  const awayDefenseRaw = safeDiv(tA.gaAway || 0, tA.pjAway || 1);

  const homeAttack = (homeAttackRaw / leagueAvgGfHome) * shrinkageFactor;
  const homeDefense = (homeDefenseRaw / leagueAvgGaHome) * shrinkageFactor;
  const awayAttack = (awayAttackRaw / leagueAvgGfAway) * shrinkageFactor;
  const awayDefense = (awayDefenseRaw / leagueAvgGaAway) * shrinkageFactor;

  const expectedHomeGoals = homeAttack * awayDefense * leagueAvgGfHome;
  const expectedAwayGoals = awayAttack * homeDefense * leagueAvgGfAway;

  let homeWin = 0, draw = 0, awayWin = 0;
  for (let i=0;i<=10;i++){
    for (let j=0;j<=10;j++){
      const prob = poissonProbability(expectedHomeGoals, i) * poissonProbability(expectedAwayGoals, j);
      if (i>j) homeWin += prob;
      else if (i===j) draw += prob;
      else awayWin += prob;
    }
  }

  const tau = (h,a) => {
    if (h===0 && a===0) return 1 - (homeAttack * awayDefense * rho);
    if (h===0 && a===1) return 1 + (homeAttack * rho);
    if (h===1 && a===0) return 1 + (awayDefense * rho);
    if (h===1 && a===1) return 1 - rho;
    return 1;
  };

  let adjustedDraw = 0;
  for (let i=0;i<=10;i++) adjustedDraw += poissonProbability(expectedHomeGoals, i) * poissonProbability(expectedAwayGoals, i) * tau(i,i);

  // normalize
  const total = homeWin + draw + awayWin;
  if (total > 0) {
    const s = 1 / total; homeWin *= s; draw *= s; awayWin *= s;
  } else { homeWin = draw = awayWin = 1/3; }

  const adjustedTotal = homeWin + adjustedDraw + awayWin;
  if (adjustedTotal > 0) {
    const s = 1 / adjustedTotal; homeWin *= s; adjustedDraw *= s; awayWin *= s;
  }

  const p0H = poissonProbability(expectedHomeGoals, 0);
  const p0A = poissonProbability(expectedAwayGoals, 0);
  const pBTTSH = 1 - p0H - p0A + p0H * p0A;

  const sumUpTo2H = poissonProbability(expectedHomeGoals,0)+poissonProbability(expectedHomeGoals,1)+poissonProbability(expectedHomeGoals,2);
  const sumUpTo2A = poissonProbability(expectedAwayGoals,0)+poissonProbability(expectedAwayGoals,1)+poissonProbability(expectedAwayGoals,2);
  const pO25H = 1 - (sumUpTo2H * sumUpTo2A);

  return { finalHome: homeWin, finalDraw: adjustedDraw, finalAway: awayWin, pBTTSH, pO25H };
}

// ----------------------
// COMBINAR PRONÓSTICOS
// ----------------------
function safeParseProbability(p) {
  if (!p && p !== 0) return 0;
  if (typeof p === 'number') return p;
  let s = String(p).trim().replace('%','').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n/100 : 0;
}

function getCombinedPrediction(stats, event, matchData) {
  const combined = {};
  let ai = null;
  try {
    if (event && event.pronostico_json) {
      ai = typeof event.pronostico_json === 'string' ? JSON.parse(event.pronostico_json) : event.pronostico_json;
    } else if (event && event.pronostico) {
      ai = parsePlainText(event.pronostico || '', matchData);
    }
  } catch(e){ console.warn('ai parse error', e); }

  if (!ai || !ai["1X2"] || Object.values(ai["1X2"]).every(p => !p?.probabilidad)) {
    combined.header = "Análisis Estadístico Principal";
    combined.body = `<p>No se encontró un pronóstico de IA válido. El análisis se basa únicamente en datos estadísticos.</p>`;
    return combined;
  }

  const aiProbs = {
    home: safeParseProbability(ai["1X2"].victoria_local?.probabilidad),
    draw: safeParseProbability(ai["1X2"].empate?.probabilidad),
    away: safeParseProbability(ai["1X2"].victoria_visitante?.probabilidad)
  };
  const statProbs = { home: stats.finalHome, draw: stats.finalDraw, away: stats.finalAway };
  const statMax = Math.max(statProbs.home, statProbs.draw, statProbs.away);
  const aiMax = Math.max(aiProbs.home, aiProbs.draw, aiProbs.away);
  const statBest = Object.keys(statProbs).find(k => statProbs[k] === statMax);
  const aiBest = Object.keys(aiProbs).find(k => aiProbs[k] === aiMax);

  let header = "Pronóstico Combinado (Estadística + IA)";
  let body = `<p><strong>Modelo Estadístico:</strong> Victoria Local: ${formatPct(statProbs.home)}, Empate: ${formatPct(statProbs.draw)}, Visitante: ${formatPct(statProbs.away)}.</p>
              <p><strong>Modelo IA:</strong> Local: ${formatPct(aiProbs.home)}, Empate: ${formatPct(aiProbs.draw)}, Visitante: ${formatPct(aiProbs.away)}.</p>`;

  if (statBest === aiBest) {
    const resultText = statBest === 'home' ? `Victoria ${matchData.local}` : statBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
    const reason = ai["1X2"][statBest === 'home' ? 'victoria_local' : statBest === 'draw' ? 'empate' : 'victoria_visitante']?.justificacion || 'Sin justificación.';
    header = `¡Consenso! Apuesta Fuerte en la ${resultText} ⭐`;
    body += `<p>Ambos modelos coinciden: <strong>${resultText}</strong>.</p><p><strong>Justificación IA:</strong> ${reason}</p>`;
  } else {
    const statResult = statBest === 'home' ? `Victoria ${matchData.local}` : statBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
    const aiResult = aiBest === 'home' ? `Victoria ${matchData.local}` : aiBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
    header = "Discrepancia en Pronósticos ⚠️";
    body += `<p>El modelo estadístico (${formatPct(statMax)}) favorece <strong>${statResult}</strong>, mientras que la IA (${formatPct(aiMax)}) favorece <strong>${aiResult}</strong>.</p>
             <p><strong>Justificación IA:</strong> ${ai["1X2"][aiBest === 'home' ? 'victoria_local' : aiBest === 'draw' ? 'empate' : 'victoria_visitante']?.justificacion || 'Sin justificación.'}</p>`;
  }

  combined.header = header; combined.body = body;
  return combined;
}

// ----------------------
// CALCULO PRINCIPAL
// ----------------------
function calculateAll() {
  const leagueCode = $('leagueSelect')?.value;
  const teamHome = $('teamHome')?.value;
  const teamAway = $('teamAway')?.value;
  if (!leagueCode || !teamHome || !teamAway) {
    const details = $('details'); if (details) details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> Selecciona liga y ambos equipos.</div>';
    return;
  }

  const tH = findTeam(leagueCode, teamHome);
  const tA = findTeam(leagueCode, teamAway);
  if (!tH || !tA) {
    const details = $('details'); if (details) details.innerHTML = `<div class="error"><strong>Error:</strong> Uno o ambos equipos no encontrados.</div>`;
    return;
  }

  const stats = dixonColesProbabilities(tH, tA, leagueCode);
  const ligaName = leagueCodeToName[leagueCode];
  const eventList = allData.calendario || {};
  const possible = eventList[ligaName] || eventList[leagueCode] || [];
  const event = Array.isArray(possible) ? possible.find(e => normalizeStr(e.local || e.home || '') === normalizeStr(teamHome) && normalizeStr(e.visitante || e.away || '') === normalizeStr(teamAway)) : null;
  const matchData = { local: teamHome, visitante: teamAway };

  const probabilities = [
    { label: 'Local', value: stats.finalHome, id: 'pHome', type: 'Resultado' },
    { label: 'Empate', value: stats.finalDraw, id: 'pDraw', type: 'Resultado' },
    { label: 'Visitante', value: stats.finalAway, id: 'pAway', type: 'Resultado' },
    { label: 'Ambos Anotan', value: event?.pronostico_json ? safeParseProbability(event.pronostico_json?.BTTS?.si?.probabilidad) : stats.pBTTSH, id: 'pBTTS', type: 'Mercado' },
    { label: 'Más de 2.5 goles', value: event?.pronostico_json ? safeParseProbability(event.pronostico_json?.Goles?.mas_2_5?.probabilidad) : stats.pO25H, id: 'pO25', type: 'Mercado' }
  ];

  probabilities.forEach(p => { const el = $(p.id); if (el) el.textContent = formatPct(p.value); });

  const recommendations = probabilities.filter(p => p.value >= 0.3).sort((a,b)=>b.value-a.value).slice(0,3);
  const suggestion = $('suggestion');
  let suggestionText = '<h3>Recomendaciones de Apuesta</h3><ul>';
  if (recommendations.length===0) suggestionText += '<li>No hay recomendaciones fuertes (>=30%).</li>';
  else recommendations.forEach(r => suggestionText += `<li><strong>${r.label} (${formatPct(r.value)})</strong> - ${r.type}</li>`);
  suggestionText += '</ul>'; if (suggestion) suggestion.innerHTML = suggestionText;

  const detailedPredictionBox = $('detailed-prediction');
  if (event && (event.pronostico_json || event.pronostico)) {
    if (event.pronostico_json) {
      const json = typeof event.pronostico_json === 'string' ? (()=>{try{return JSON.parse(event.pronostico_json);}catch(e){return event.pronostico_json;}})() : event.pronostico_json;
      let html = `<h3>Análisis de la IA</h3><div class="ia-prediction"><h4>${teamHome} vs ${teamAway}</h4>`;
      const one = json["1X2"] || json["1x2"] || {};
      html += `<p><strong>${teamHome}:</strong> ${one.victoria_local?.justificacion || one.home?.justificacion || 'Sin justificación.'} (Prob: ${one.victoria_local?.probabilidad || one.home?.probabilidad || 'N/D'})</p>`;
      html += `<p><strong>Empate:</strong> ${one.empate?.justificacion || one.draw?.justificacion || 'Sin justificación.'} (Prob: ${one.empate?.probabilidad || one.draw?.probabilidad || 'N/D'})</p>`;
      html += `<p><strong>${teamAway}:</strong> ${one.victoria_visitante?.justificacion || one.away?.justificacion || 'Sin justificación.'} (Prob: ${one.victoria_visitante?.probabilidad || one.away?.probabilidad || 'N/D'})</p>`;
      const btts = json.BTTS || json.btts || {};
      html += `<h4>BTTS:</h4><p>Sí: ${btts.si?.probabilidad || btts.yes?.probabilidad || 'N/D'}</p><p>No: ${btts.no?.probabilidad || 'N/D'}</p>`;
      const goles = json.Goles || json.goles || {};
      html += `<h4>Goles:</h4><p>Más de 2.5: ${goles.mas_2_5?.probabilidad || goles.over?.probabilidad || 'N/D'}</p><p>Menos de 2.5: ${goles.menos_2_5?.probabilidad || goles.under?.probabilidad || 'N/D'}</p>`;
      html += '</div>';
      if (detailedPredictionBox) detailedPredictionBox.innerHTML = html;
    } else {
      if (detailedPredictionBox) detailedPredictionBox.innerHTML = `<h3>Análisis de la IA</h3><div class="ia-prediction">${String(event.pronostico).replace(/\n/g,'<br>')}</div>`;
    }
  } else if (detailedPredictionBox) {
    detailedPredictionBox.innerHTML = '<p>No hay un pronóstico de la IA disponible para este partido.</p>';
  }

  const combined = getCombinedPrediction(stats, event || {}, matchData);
  const combinedPrediction = $('combined-prediction');
  if (combinedPrediction) combinedPrediction.innerHTML = `<h3>${combined.header}</h3>${combined.body}`;
}

// ----------------------
// INIT
// ----------------------
async function init() {
  console.log('[init] starting app', new Date().toLocaleString('es-ES', { timeZone: 'America/Guatemala' }));
  clearAll();
  const leagueSelect = $('leagueSelect');
  const teamHomeSelect = $('teamHome');
  const teamAwaySelect = $('teamAway');
  if (!leagueSelect || !teamHomeSelect || !teamAwaySelect) {
    const details = $('details'); if (details) details.innerHTML = '<div class="error"><strong>Error:</strong> Elementos select faltantes en HTML.</div>';
    return;
  }
  leagueSelect.style.display = 'block';
  leagueSelect.innerHTML = '<option value="">Cargando ligas...</option>';
  await fetchAllData();

  // Fill league select grouped by region
  leagueSelect.innerHTML = '<option value="">-- Selecciona liga --</option>';
  // Create map region -> codes
  const regionsMap = {};
  Object.keys(leagueCodeToName).forEach(code => {
    const region = leagueRegions[code] || 'Otras Ligas';
    if (!regionsMap[region]) regionsMap[region] = [];
    regionsMap[region].push(code);
  });
  const order = ["Europa","Sudamérica","Norteamérica","Centroamérica","Asia","Copas Internacionales","Eliminatorias Mundiales","Otras Ligas"];
  const sortedRegions = Object.keys(regionsMap).sort((a,b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  sortedRegions.forEach(region => {
    const optgroup = document.createElement('optgroup'); optgroup.label = region;
    regionsMap[region].sort((a,b) => (leagueNames[a]||a).localeCompare(leagueNames[b]||b)).forEach(code => {
      const opt = document.createElement('option'); opt.value = code; opt.textContent = leagueNames[code] || code;
      optgroup.appendChild(opt);
    });
    if (optgroup.children.length) leagueSelect.appendChild(optgroup);
  });

  leagueSelect.addEventListener('change', onLeagueChange);
  teamHomeSelect.addEventListener('change', () => { if (restrictSameTeam()) { fillTeamData($('teamHome').value, $('leagueSelect').value, 'Home'); calculateAll(); }});
  teamAwaySelect.addEventListener('change', () => { if (restrictSameTeam()) { fillTeamData($('teamAway').value, $('leagueSelect').value, 'Away'); calculateAll(); }});
  const resetButton = $('reset'); if (resetButton) resetButton.addEventListener('click', clearAll);

  console.log('[init] ready');
}
document.addEventListener('DOMContentLoaded', init);

// ----------------------
// EVENT: On league change handler
// ----------------------
function onLeagueChange() {
  const code = $('leagueSelect').value;
  const teamHomeSelect = $('teamHome'); const teamAwaySelect = $('teamAway');
  if (!teamHomeSelect || !teamAwaySelect) return;

  teamHomeSelect.innerHTML = '<option value="">Cargando equipos...</option>';
  teamAwaySelect.innerHTML = '<option value="">Cargando equipos...</option>';

  if (!code || !teamsByLeague[code] || teamsByLeague[code].length === 0) {
    clearTeamData('Home'); clearTeamData('Away');
    const details = $('details'); if (details) details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No hay datos disponibles para esta liga.</div>';
    displaySelectedLeagueEvents('');
    return;
  }

  const teams = teamsByLeague[code].slice().sort((a,b)=>a.name.localeCompare(b.name));
  const fragHome = document.createDocumentFragment();
  const defaultOptH = document.createElement('option'); defaultOptH.value=''; defaultOptH.textContent='-- Selecciona equipo --'; fragHome.appendChild(defaultOptH);
  const fragAway = document.createDocumentFragment();
  const defaultOptA = document.createElement('option'); defaultOptA.value=''; defaultOptA.textContent='-- Selecciona equipo --'; fragAway.appendChild(defaultOptA);

  teams.forEach(t => {
    const o1 = document.createElement('option'); o1.value = t.name; o1.textContent = t.name; fragHome.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = t.name; o2.textContent = t.name; fragAway.appendChild(o2);
  });

  $('teamHome').innerHTML = ''; $('teamAway').innerHTML = '';
  $('teamHome').appendChild(fragHome); $('teamAway').appendChild(fragAway);

  clearTeamData('Home'); clearTeamData('Away');
  calculateAll();
  displaySelectedLeagueEvents(code);
}
