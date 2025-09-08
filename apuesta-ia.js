// UTILIDADES Y CONSTANTES
const getDomElement = id => {
    const element = document.getElementById(id);
    if (!element) console.warn(`[DOM] Elemento con ID "${id}" no encontrado.`);
    return element;
};

const formatPct = x => (100 * (isFinite(x) ? x : 0)).toFixed(1) + '%';
const formatDec = x => (isFinite(x) ? x.toFixed(2) : '0.00');
const parseNumberString = val => {
    const n = Number(String(val).replace(/,/g, '.').trim());
    if (!isFinite(n) || n < 0) {
        console.warn(`[parseNumberString] Valor no válido: "${val}" -> 0`);
        return 0;
    }
    return n;
};

const poissonProbability = (lambda, k) => (lambda <= 0 || k < 0) ? 0 : (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
const factorial = n => n <= 1 ? 1 : Array.from({ length: n }, (_, i) => i + 1).reduce((a, b) => a * b, 1);

const normalizeName = name => name ? name.trim().toLowerCase().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

// CENTRALIZAR SELECTORES DEL DOM
const dom = {
    leagueSelect: getDomElement('leagueSelect'),
    teamHomeSelect: getDomElement('teamHome'),
    teamAwaySelect: getDomElement('teamAway'),
    details: getDomElement('details'),
    selectedLeagueEvents: getDomElement('selected-league-events'),
    resetButton: getDomElement('reset'),
    pHome: getDomElement('pHome'),
    pDraw: getDomElement('pDraw'),
    pAway: getDomElement('pAway'),
    pBTTS: getDomElement('pBTTS'),
    pO25: getDomElement('pO25'),
    suggestion: getDomElement('suggestion'),
    detailedPrediction: getDomElement('detailed-prediction'),
    combinedPrediction: getDomElement('combined-prediction'),
    formHomeBox: getDomElement('formHomeBox'),
    formAwayBox: getDomElement('formAwayBox'),
    cardHome: getDomElement('card-home'),
    cardAway: getDomElement('card-away'),
};

// VARIABLES GLOBALES
let teamsByLeague = {}, allData = {}, eventInterval;

// NORMALIZACIÓN DE DATOS
const teamFields = {
    home: ['gamesPlayedHome', 'matchesPlayedHome', 'homeGamesPlayed', 'homeMatches', 'playedHome', 'homePlayed', 'gamesHome', 'matchesHome'],
    away: ['gamesPlayedAway', 'matchesPlayedAway', 'awayGamesPlayed', 'awayMatches', 'playedAway', 'awayPlayed', 'gamesAway', 'matchesAway']
};

function normalizeTeam(raw) {
    if (!raw?.name?.trim()) {
        console.warn(`[normalizeTeam] Nombre de equipo inválido:`, raw?.name);
        return null;
    }
    console.log('[normalizeTeam] Normalizando:', JSON.stringify(raw, null, 2));
    const r = {
        name: raw.name.trim(),
        pos: parseNumberString(raw.rank),
        gf: parseNumberString(raw.goalsFor),
        ga: parseNumberString(raw.goalsAgainst),
        pj: parseNumberString(raw.gamesPlayed),
        g: parseNumberString(raw.wins),
        e: parseNumberString(raw.ties),
        p: parseNumberString(raw.losses),
        points: parseNumberString(raw.points || (raw.wins * 3 + raw.ties)),
        gfHome: parseNumberString(raw.goalsForHome),
        gfAway: parseNumberString(raw.goalsForAway),
        gaHome: parseNumberString(raw.goalsAgainstHome),
        gaAway: parseNumberString(raw.goalsAgainstAway),
        pjHome: teamFields.home.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        pjAway: teamFields.away.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        winsHome: parseNumberString(raw.winsHome),
        winsAway: parseNumberString(raw.winsAway),
        tiesHome: parseNumberString(raw.tiesHome),
        tiesAway: parseNumberString(raw.tiesAway),
        lossesHome: parseNumberString(raw.lossesHome),
        lossesAway: parseNumberString(raw.lossesAway),
        logoUrl: raw.logoUrl || '',
        form: raw.form || '' // Nueva columna para la forma reciente
    };
    if (r.pjHome === 0 && r.pjAway === 0) {
        console.warn(`[normalizeTeam] Equipo ${r.name} tiene pjHome=0 y pjAway=0:`, { rawFields: Object.keys(raw) });
    }
    return r;
}

// BÚSQUEDA DE EQUIPO
function findTeam(leagueCode, teamName) {
    if (!teamsByLeague[leagueCode]) {
        console.warn('[findTeam] Liga no encontrada:', leagueCode);
        return { name: teamName, pjHome: 0, pjAway: 0, gfHome: 0, gaHome: 0, gfAway: 0, gaAway: 0, pos: 0, form: '' };
    }
    const team = teamsByLeague[leagueCode].find(t => normalizeName(t.name) === normalizeName(teamName));
    if (!team) {
        console.warn('[findTeam] Equipo no encontrado:', teamName, 'en liga:', leagueCode);
        return { name: teamName, pjHome: 0, pjAway: 0, gfHome: 0, gaHome: 0, gfAway: 0, gaAway: 0, pos: 0, form: '' };
    }
    return team;
}

// FETCH DATOS COMPLETOS
async function fetchAllData() {
    if (dom.leagueSelect) {
        dom.leagueSelect.innerHTML = '<option value="">Cargando datos...</option>';
        dom.leagueSelect.disabled = true;
        dom.leagueSelect.style.display = 'block';
    }
    try {
        const res = await fetch(`${WEBAPP_URL}?tipo=todo&update=false`);
        if (!res.ok) throw new Error(`Error HTTP ${res.status}: ${await res.text()}`);
        allData = await res.json();
        console.log('[fetchAllData] Datos recibidos:', JSON.stringify(allData, null, 2));
        if (!allData?.calendario || !allData.ligas || !Object.keys(allData.ligas).length) {
            throw new Error('Datos inválidos: falta "calendario", "ligas" o ligas vacías.');
        }
        teamsByLeague = Object.fromEntries(
            Object.entries(allData.ligas).map(([key, value]) => {
                value.forEach(team => {
                    if (!teamFields.home.some(field => team[field] != null) || !teamFields.away.some(field => team[field] != null)) {
                        console.warn(`[fetchAllData] Equipo ${team.name} en liga ${key} sin datos de partidos:`, team);
                    }
                });
                return [key, value.map(normalizeTeam).filter(t => t && t.name)];
            })
        );
        localStorage.setItem('allData', JSON.stringify(allData));
        return allData;
    } catch (err) {
        console.error('[fetchAllData] Error:', err);
        if (dom.details) dom.details.innerHTML = `<div class="error"><strong>Error:</strong> No se pudieron cargar datos. Detalle: ${err.message}</div>`;
        if (dom.leagueSelect) dom.leagueSelect.innerHTML = '<option value="">Error al cargar ligas</option>';
        return {};
    } finally {
        if (dom.leagueSelect) dom.leagueSelect.disabled = false;
    }
}

// MUESTRA DE EVENTOS DE LA LIGA SELECCIONADA
function renderEvent(event, index, leagueCode) {
    const div = document.createElement('div');
    div.className = 'event-item slide-in';
    div.style.animationDelay = `${index * 0.1}s`;
    const eventLeagueCode = event.leagueCode || leagueCode;
    div.dataset.homeTeam = event.local.trim();
    div.dataset.awayTeam = event.visitante.trim();
    div.dataset.leagueCode = eventLeagueCode;
    const homeTeam = findTeam(eventLeagueCode, event.local.trim());
    const awayTeam = findTeam(eventLeagueCode, event.visitante.trim());
    const homeLogo = homeTeam?.logoUrl || '';
    const awayLogo = awayTeam?.logoUrl || '';
    let eventDateTime = 'Fecha no disponible';
    let isInProgress = false;
    try {
        const parsedDate = new Date(event.fecha);
        if (isFinite(parsedDate)) {
            const now = new Date();
            isInProgress = now >= parsedDate && now < new Date(parsedDate.getTime() + 120 * 60 * 1000);
            const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Guatemala' };
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guatemala' };
            eventDateTime = `${parsedDate.toLocaleDateString('es-ES', dateOptions)} ${parsedDate.toLocaleTimeString('es-ES', timeOptions)} (GT)`;
        }
    } catch (err) {
        console.error('Error al parsear fecha:', err);
    }
    div.innerHTML = `
        <div class="event-content">
            <div class="team-logo-container">
                <span class="team-name">${event.local.trim()}</span>
                <img src="${homeLogo}" class="team-logo home-logo ${!homeLogo ? 'hidden' : ''}" alt="Logo de ${event.local.trim()}">
                <span class="vs">vs.</span>
                <img src="${awayLogo}" class="team-logo away-logo ${!awayLogo ? 'hidden' : ''}" alt="Logo de ${event.visitante.trim()}">
                <span class="team-name">${event.visitante.trim()}</span>
            </div>
            <span class="event-details">${eventDateTime}${isInProgress ? ' - Evento en Juego' : ''}</span>
            <span class="event-details">Estadio: ${event.estadio || 'Por confirmar'}</span>
        </div>
    `;
    if (!isInProgress) div.addEventListener('click', () => selectEvent(event.local.trim(), event.visitante.trim()));
    else div.classList.add('in-progress');
    return div;
}

function displaySelectedLeagueEvents(leagueCode) {
    if (!dom.selectedLeagueEvents) return;
    if (eventInterval) clearInterval(eventInterval);
    dom.selectedLeagueEvents.innerHTML = allData.calendario ? '' : '<div class="event-item placeholder"><span>Selecciona una liga para ver eventos.</span></div>';
    if (!allData.calendario) return;
    let events = [];
    if (leagueCode) {
        events = allData.calendario[leagueCodeToName[leagueCode]] || [];
    } else {
        Object.entries(allData.calendario).forEach(([code, evts]) => {
            const originalCode = Object.keys(leagueCodeToName).find(key => leagueCodeToName[key] === code);
            if (originalCode) evts.forEach(event => events.push({ ...event, leagueCode: originalCode }));
        });
    }
    if (!events.length) {
        dom.selectedLeagueEvents.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos.</span></div>';
        return;
    }
    const eventsPerPage = 1, totalPages = Math.ceil(events.length / eventsPerPage);
    let currentPage = 0;
    const showCurrentPage = () => {
        const startIndex = currentPage * eventsPerPage;
        dom.selectedLeagueEvents.innerHTML = '';
        events.slice(startIndex, startIndex + eventsPerPage).forEach((event, index) => {
            dom.selectedLeagueEvents.appendChild(renderEvent(event, index, leagueCode));
        });
        currentPage = (currentPage + 1) % totalPages;
    };
    showCurrentPage();
    if (totalPages > 1) eventInterval = setInterval(showCurrentPage, 10000);
}

// CAMBIO DE LIGA
function onLeagueChange() {
    const code = dom.leagueSelect.value;
    if (!dom.teamHomeSelect || !dom.teamAwaySelect) return;
    dom.teamHomeSelect.disabled = !code;
    dom.teamAwaySelect.disabled = !code;
    dom.teamHomeSelect.innerHTML = dom.teamAwaySelect.innerHTML = '<option value="">Cargando equipos...</option>';
    if (!code || !teamsByLeague[code]?.length) {
        clearTeamData('Home');
        clearTeamData('Away');
        if (dom.details) dom.details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No hay datos disponibles para esta liga.</div>';
        displaySelectedLeagueEvents('');
        return;
    }
    const teams = teamsByLeague[code].sort((a, b) => (a.pos || 0) - (b.pos || 0));
    const createOptions = () => {
        const fragment = document.createDocumentFragment();
        fragment.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '-- Selecciona equipo --' }));
        teams.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.textContent = `${t.pos || ''} - ${t.name}`;
            fragment.appendChild(opt);
        });
        return fragment;
    };
    dom.teamHomeSelect.innerHTML = dom.teamAwaySelect.innerHTML = '';
    dom.teamHomeSelect.appendChild(createOptions());
    dom.teamAwaySelect.appendChild(createOptions());
    clearTeamData('Home');
    clearTeamData('Away');
    displaySelectedLeagueEvents(code);
    clearProbabilities();
}

// SELECCIÓN DE EVENTO
function selectEvent(homeTeamName, awayTeamName) {
    const ligaName = Object.keys(allData.calendario).find(liga =>
        allData.calendario[liga]?.some(e => normalizeName(e.local) === normalizeName(homeTeamName) && normalizeName(e.visitante) === normalizeName(awayTeamName))
    );
    const eventLeagueCode = ligaName ? Object.keys(leagueCodeToName).find(key => leagueCodeToName[key] === ligaName) || '' : '';
    if (dom.leagueSelect) dom.leagueSelect.value = eventLeagueCode;
    onLeagueChange();
    setTimeout(() => {
        const findOption = (select, name) => Array.from(select.options).find(opt => {
            const textParts = opt.text.split(' - ');
            return textParts.length > 1 && normalizeName(textParts[1]) === normalizeName(name);
        });
        const homeOption = findOption(dom.teamHomeSelect, homeTeamName);
        const awayOption = findOption(dom.teamAwaySelect, awayTeamName);
        if (homeOption) dom.teamHomeSelect.value = homeOption.value;
        if (awayOption) dom.teamAwaySelect.value = awayOption.value;
        onTeamChange();
    }, 500);
}

// INICIALIZACIÓN
async function init() {
    console.log('[init] Iniciando a las', new Date().toLocaleString('es-ES', { timeZone: 'America/Guatemala' }));
    clearAll();
    if (!dom.leagueSelect || !dom.teamHomeSelect || !dom.teamAwaySelect) {
        if (dom.details) dom.details.innerHTML = '<div class="error"><strong>Error:</strong> Problema con la interfaz HTML.</div>';
        return;
    }
    dom.leagueSelect.style.display = 'block';
    dom.leagueSelect.innerHTML = '<option value="">Cargando ligas...</option>';
    if (dom.details) dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
    await fetchAllData();
    if (!allData.ligas || !Object.keys(allData.ligas).length) {
        dom.leagueSelect.innerHTML = '<option value="">No hay ligas disponibles</option>';
        if (dom.details) dom.details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No se encontraron ligas. Verifica la API.</div>';
        return;
    }
    dom.leagueSelect.innerHTML = '<option value="">-- Selecciona liga --</option>';
    const regionsMap = {};
    Object.keys(allData.ligas).forEach(code => {
        const region = leagueRegions[code] || 'Otras Ligas';
        if (!regionsMap[region]) regionsMap[region] = [];
        regionsMap[region].push(code);
    });
    const customOrder = ["Europa", "Sudamérica", "Norteamérica", "Centroamérica", "Asia", "Copas Internacionales", "Eliminatorias Mundiales", "Otras Ligas"];
    const sortedRegions = Object.keys(regionsMap).sort((a, b) => {
        const aIndex = customOrder.indexOf(a), bIndex = customOrder.indexOf(b);
        return aIndex === -1 && bIndex === -1 ? a.localeCompare(b) : aIndex === -1 ? 1 : bIndex === -1 ? -1 : aIndex - bIndex;
    });
    sortedRegions.forEach(regionName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = regionName;
        regionsMap[regionName].sort().forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = leagueNames[code] || code;
            optgroup.appendChild(opt);
        });
        if (optgroup.children.length) dom.leagueSelect.appendChild(optgroup);
    });
    if (dom.leagueSelect.children.length <= 1) {
        dom.leagueSelect.innerHTML = '<option value="">No hay ligas disponibles</option>';
        if (dom.details) dom.details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No se encontraron ligas. Verifica la API.</div>';
    }
    dom.leagueSelect.addEventListener('change', onLeagueChange);
    dom.teamHomeSelect.addEventListener('change', onTeamChange);
    dom.teamAwaySelect.addEventListener('change', onTeamChange);
    if (dom.resetButton) dom.resetButton.addEventListener('click', clearAll);
    displaySelectedLeagueEvents('');
}

// ONTEAMCHANGE
function onTeamChange(event) {
    const leagueCode = dom.leagueSelect.value, teamHome = dom.teamHomeSelect.value, teamAway = dom.teamAwaySelect.value;
    console.log('[onTeamChange] Selección:', { leagueCode, teamHome, teamAway });
    if (!leagueCode) {
        clearProbabilities();
        clearTeamData('Home');
        clearTeamData('Away');
        return;
    }
    if (event) {
        const isHome = event.target.id === 'teamHome';
        const teamData = findTeam(leagueCode, event.target.value);
        isHome ? (event.target.value ? fillTeamData(teamData, 'Home') : clearTeamData('Home')) : (event.target.value ? fillTeamData(teamData, 'Away') : clearTeamData('Away'));
    } else {
        fillTeamData(findTeam(leagueCode, teamHome), 'Home');
        fillTeamData(findTeam(leagueCode, teamAway), 'Away');
    }
    if (teamHome && teamAway && teamHome !== teamAway) {
        const tH = findTeam(leagueCode, teamHome), tA = findTeam(leagueCode, teamAway);
        tH.name && tA.name ? calculateAll() : dom.details && (dom.details.innerHTML = `<div class="error"><strong>Error:</strong> Equipos no encontrados.</div>`);
    } else {
        clearProbabilities();
        if (teamHome && teamAway && teamHome === teamAway) {
            dom.details.innerHTML = '<div class="error"><strong>Error:</strong> No puedes seleccionar el mismo equipo.</div>';
            setTimeout(() => dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante.</div>', 5000);
        }
    }
}

// FUNCIÓN PARA LIMPIAR SOLO LAS PROBABILIDADES
function clearProbabilities() {
    ['pHome', 'pDraw', 'pAway', 'pBTTS', 'pO25'].forEach(id => dom[id] && (dom[id].textContent = '--'));
    if (dom.suggestion) dom.suggestion.innerHTML = '<p>Esperando datos...</p>';
    if (dom.detailedPrediction) dom.detailedPrediction.innerHTML = '<p>Esperando pronóstico detallado...</p>';
    if (dom.combinedPrediction) dom.combinedPrediction.innerHTML = '<p>Esperando pronóstico combinado...</p>';
}

// GENERAR HTML PARA DATOS DE EQUIPO
function generateTeamHtml(team = {}) {
    const dgTotal = (team.gf || 0) - (team.ga || 0), dgHome = (team.gfHome || 0) - (team.gaHome || 0), dgAway = (team.gfAway || 0) - (team.gaAway || 0);
    const winPct = team.pj ? ((team.g / team.pj) * 100).toFixed(1) : '0.0';
    const winPctHome = team.pjHome ? ((team.winsHome / team.pjHome) * 100).toFixed(1) : '0.0';
    const winPctAway = team.pjAway ? ((team.winsAway / team.pjAway) * 100).toFixed(1) : '0.0';
    return `
        <div class="team-details">
            <div class="stat-section">
                <span class="section-title">General</span>
                <div class="stat-metrics">
                    <span>PJ: ${team.pj || 0}</span>
                    <span>V: ${team.g || 0}</span>
                    <span>E: ${team.e || 0}</span>
                    <span>D: ${team.p || 0}</span>
                    <span>GF: ${team.gf || 0}</span>
                    <span>GC: ${team.ga || 0}</span>
                    <span>DG: ${dgTotal >= 0 ? '+' + dgTotal : dgTotal || 0}</span>
                </div>
            </div>
            <div class="stat-section">
                <span class="section-title">Local</span>
                <div class="stat-metrics">
                    <span>PJ: ${team.pjHome || 0}</span>
                    <span>V: ${team.winsHome || 0}</span>
                    <span>E: ${team.tiesHome || 0}</span>
                    <span>D: ${team.lossesHome || 0}</span>
                    <span>GF: ${team.gfHome || 0}</span>
                    <span>GC: ${team.gaHome || 0}</span>
                    <span>DG: ${dgHome >= 0 ? '+' + dgHome : dgHome || 0}</span>
                    <span>% V: ${winPctHome}%</span>
                </div>
            </div>
            <div class="stat-section">
                <span class="section-title">Visitante</span>
                <div class="stat-metrics">
                    <span>PJ: ${team.pjAway || 0}</span>
                    <span>V: ${team.winsAway || 0}</span>
                    <span>E: ${team.tiesAway || 0}</span>
                    <span>D: ${team.lossesAway || 0}</span>
                    <span>GF: ${team.gfAway || 0}</span>
                    <span>GC: ${team.gaAway || 0}</span>
                    <span>DG: ${dgAway >= 0 ? '+' + dgAway : dgAway || 0}</span>
                    <span>% V: ${winPctAway}%</span>
                </div>
            </div>
            <div class="stat-section">
                <span class="section-title">Datos</span>
                <div class="stat-metrics">
                    <span>Puntos: ${team.points || 0}</span>
                    <span>Ranking: ${team.pos || ''}</span>
                    <span>% Victorias: ${winPct}%</span>
                    <span>Forma: ${team.form || '-'}</span>
                </div>
            </div>
        </div>
    `;
}

// LIMPIAR DATOS DE EQUIPO
function clearTeamData(type) {
    const cardHeader = dom[`card${type}`]?.querySelector('.card-header');
    if (cardHeader) {
        const logoImg = cardHeader.querySelector('.team-logo');
        if (logoImg) logoImg.remove();
    }
    if (dom[`form${type}Box`]) dom[`form${type}Box`].innerHTML = generateTeamHtml();
}

// LLENAR DATOS DE EQUIPO
function fillTeamData(team, type) {
    if (!team?.name) {
        console.warn(`[fillTeamData] Equipo no válido para ${type}`);
        clearTeamData(type);
        return;
    }
    const cardHeader = dom[`card${type}`]?.querySelector('.card-header');
    if (cardHeader) {
        let logoImg = cardHeader.querySelector('.team-logo');
        if (!logoImg) {
            logoImg = document.createElement('img');
            logoImg.className = 'team-logo';
            logoImg.alt = `Logo de ${team.name}`;
            const h3 = cardHeader.querySelector('h3');
            if (h3) h3.insertAdjacentElement('beforebegin', logoImg);
        }
        logoImg.src = team.logoUrl || '';
        logoImg.style.display = team.logoUrl ? 'inline-block' : 'none';
    }
    if (dom[`form${type}Box`]) dom[`form${type}Box`].innerHTML = generateTeamHtml(team);
}

// LIMPIAR TODO
function clearAll() {
    if (dom.leagueSelect) dom.leagueSelect.selectedIndex = 0;
    if (dom.teamHomeSelect) dom.teamHomeSelect.selectedIndex = 0;
    if (dom.teamAwaySelect) dom.teamAwaySelect.selectedIndex = 0;
    clearProbabilities();
    clearTeamData('Home');
    clearTeamData('Away');
    displaySelectedLeagueEvents('');
    if (dom.details) dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante.</div>';
}

// PARSEO DE PRONÓSTICO DE TEXTO PLANO
function parsePlainText(text, matchData) {
    console.log(`[parsePlainText] Procesando texto para ${matchData.local} vs ${matchData.visitante}`);
    if (!text?.trim()) {
        console.warn('[parsePlainText] Texto inválido, usando valores predeterminados');
        return {
            "1X2": {
                victoria_local: { probabilidad: '33.3%', justificacion: "Sin justificación." },
                empate: { probabilidad: '33.3%', justificacion: "Sin justificación." },
                victoria_visitante: { probabilidad: '33.3%', justificacion: "Sin justificación." }
            },
            "BTTS": { si: { probabilidad: '50.0%', justificacion: "" }, no: { probabilidad: '50.0%', justificacion: "" } },
            "Goles": { mas_2_5: { probabilidad: '50.0%', justificacion: "" }, menos_2_5: { probabilidad: '50.0%', justificacion: "" } }
        };
    }
    const aiProbs = {};
    const aiJustification = { home: "Sin justificación.", draw: "Sin justificación.", away: "Sin justificación." };
    const probsMatch = text.match(/Probabilidades\s*[:|-]?\s*(.*?)(?:Ambos\s*Anotan|$)/is);
    if (probsMatch?.[1]) {
        const percentages = probsMatch[1].match(/(\d+\.?\d*)%/g) || [];
        aiProbs.home = percentages[0] ? parseFloat(percentages[0]) / 100 : 1/3;
        aiProbs.draw = percentages[1] ? parseFloat(percentages[1]) / 100 : 1/3;
        aiProbs.away = percentages[2] ? parseFloat(percentages[2]) / 100 : 1/3;
        const sum = aiProbs.home + aiProbs.draw + aiProbs.away;
        if (sum < 0.95 || sum > 1.05) {
            console.warn('[parsePlainText] Probabilidades 1X2 no suman ~100%:', aiProbs);
            const scale = sum > 0 ? 1 / sum : 1/3;
            aiProbs.home *= scale; aiProbs.draw *= scale; aiProbs.away *= scale;
        }
    } else {
        aiProbs.home = aiProbs.draw = aiProbs.away = 1/3;
    }
    const bttsSi = text.match(/BTTS.*Sí\s*[:|-]?\s*(\d+\.?\d*)%/is)?.[1] ? parseFloat(text.match(/BTTS.*Sí\s*[:|-]?\s*(\d+\.?\d*)%/is)[1]) : 50;
    const bttsNo = text.match(/BTTS.*No\s*[:|-]?\s*(\d+\.?\d*)%/is)?.[1] ? parseFloat(text.match(/BTTS.*No\s*[:|-]?\s*(\d+\.?\d*)%/is)[1]) : 50;
    const over25 = text.match(/Más\s*de\s*2\.5\s*[:|-]?\s*(\d+\.?\d*)%/is)?.[1] ? parseFloat(text.match(/Más\s*de\s*2\.5\s*[:|-]?\s*(\d+\.?\d*)%/is)[1]) : 50;
    const under25 = text.match(/Menos\s*de\s*2\.5\s*[:|-]?\s*(\d+\.?\d*)%/is)?.[1] ? parseFloat(text.match(/Menos\s*de\s*2\.5\s*[:|-]?\s*(\d+\.?\d*)%/is)[1]) : 50;
    const bttsSum = bttsSi + bttsNo, goalsSum = over25 + under25;
    const normalizedBTTS = bttsSum < 95 || bttsSum > 105 ? { si: 50, no: 50 } : { si: bttsSi * (100 / bttsSum), no: bttsNo * (100 / bttsSum) };
    const normalizedGoals = goalsSum < 95 || goalsSum > 105 ? { over: 50, under: 50 } : { over: over25 * (100 / goalsSum), under: under25 * (100 / goalsSum) };
    const analysisMatch = text.match(/Análisis\s*del\s*Partido\s*[:|-]?\s*(.*?)(?:Probabilidades\s*[:|-]?|$)/is);
    if (analysisMatch?.[1]) {
        const analysisText = analysisMatch[1];
        aiJustification.home = analysisText.match(new RegExp(`${matchData.local}\\s*[:|-]?\s*(.*?)(?:Empate\s*[:|-]?|$|${matchData.visitante}\\s*[:|-]?)`, 'is'))?.[1].trim() || aiJustification.home;
        aiJustification.draw = analysisText.match(/Empate\s*[:|-]?\s*(.*?)(?:(?:[^:]+[:|-]?)|$)/is)?.[1].trim() || aiJustification.draw;
        aiJustification.away = analysisText.match(new RegExp(`${matchData.visitante}\\s*[:|-]?\s*(.*?)(?:Probabilidades\s*[:|-]?|$)`, 'is'))?.[1].trim() || aiJustification.away;
    }
    return {
        "1X2": {
            victoria_local: { probabilidad: (aiProbs.home * 100).toFixed(1) + '%', justificacion: aiJustification.home },
            empate: { probabilidad: (aiProbs.draw * 100).toFixed(1) + '%', justificacion: aiJustification.draw },
            victoria_visitante: { probabilidad: (aiProbs.away * 100).toFixed(1) + '%', justificacion: aiJustification.away }
        },
        "BTTS": { si: { probabilidad: normalizedBTTS.si.toFixed(1) + '%', justificacion: "" }, no: { probabilidad: normalizedBTTS.no.toFixed(1) + '%', justificacion: "" } },
        "Goles": { mas_2_5: { probabilidad: normalizedGoals.over.toFixed(1) + '%', justificacion: "" }, menos_2_5: { probabilidad: normalizedGoals.under.toFixed(1) + '%', justificacion: "" } }
    };
}

// COMPARACIÓN DE PRONÓSTICOS
function getCombinedPrediction(stats, event, matchData) {
    const ai = event?.pronostico_json || parsePlainText(event?.pronostico || '', matchData);
    const statProbs = { home: stats.finalHome, draw: stats.finalDraw, away: stats.finalAway, btts: stats.pBTTSH, over25: stats.pO25H };
    const aiProbs = {
        home: parseFloat(ai["1X2"]?.victoria_local?.probabilidad || '33.3') / 100,
        draw: parseFloat(ai["1X2"]?.empate?.probabilidad || '33.3') / 100,
        away: parseFloat(ai["1X2"]?.victoria_visitante?.probabilidad || '33.3') / 100,
        btts: parseFloat(ai.BTTS?.si?.probabilidad || '50.0') / 100,
        over25: parseFloat(ai.Goles?.mas_2_5?.probabilidad || '50.0') / 100
    };
    const statBest = Object.keys(statProbs).reduce((a, b) => statProbs[a] > statProbs[b] ? a : b);
    const aiBest = Object.keys(aiProbs).reduce((a, b) => aiProbs[a] > aiProbs[b] ? a : b);
    let header = "Comparación de Pronósticos";
    let body = `
        <h4>Modelo Estadístico (Dixon-Coles):</h4>
        <p>Local: ${formatPct(statProbs.home)}, Empate: ${formatPct(statProbs.draw)}, Visitante: ${formatPct(statProbs.away)}</p>
        <p>Ambos Anotan: ${formatPct(statProbs.btts)}, Más de 2.5 Goles: ${formatPct(statProbs.over25)}</p>
        <h4>Modelo de IA (API):</h4>
        <p>Local: ${formatPct(aiProbs.home)}, Empate: ${formatPct(aiProbs.draw)}, Visitante: ${formatPct(aiProbs.away)}</p>
        <p>Ambos Anotan: ${formatPct(aiProbs.btts)}, Más de 2.5 Goles: ${formatPct(aiProbs.over25)}</p>
    `;
    if (statBest === aiBest) {
        const resultText = statBest === 'home' ? `Victoria ${matchData.local}` : statBest === 'draw' ? 'Empate' : statBest === 'away' ? `Victoria ${matchData.visitante}` : statBest === 'btts' ? 'Ambos Anotan' : 'Más de 2.5 Goles';
        header = `Consenso en ${resultText} ⭐`;
        body += `<p><strong>Ambos modelos coinciden en ${resultText}.</strong></p>`;
        if (ai["1X2"] && statBest !== 'btts' && statBest !== 'over25') {
            body += `<p><strong>Justificación de la IA:</strong> ${ai["1X2"][statBest === 'home' ? 'victoria_local' : statBest === 'draw' ? 'empate' : 'victoria_visitante']?.justificacion || "Sin justificación."}</p>`;
        }
    } else {
        const statResult = statBest === 'home' ? `Victoria ${matchData.local}` : statBest === 'draw' ? 'Empate' : statBest === 'away' ? `Victoria ${matchData.visitante}` : statBest === 'btts' ? 'Ambos Anotan' : 'Más de 2.5 Goles';
        const aiResult = aiBest === 'home' ? `Victoria ${matchData.local}` : aiBest === 'draw' ? 'Empate' : aiBest === 'away' ? `Victoria ${matchData.visitante}` : aiBest === 'btts' ? 'Ambos Anotan' : 'Más de 2.5 Goles';
        header = "Discrepancia en Pronósticos ⚠️";
        body += `<p><strong>Estadístico:</strong> Favorece ${statResult} (${formatPct(statProbs[statBest])}).</p>`;
        body += `<p><strong>IA:</strong> Favorece ${aiResult} (${formatPct(aiProbs[aiBest])}).</p>`;
        if (ai["1X2"] && aiBest !== 'btts' && aiBest !== 'over25') {
            body += `<p><strong>Justificación de la IA:</strong> ${ai["1X2"][aiBest === 'home' ? 'victoria_local' : aiBest === 'draw' ? 'empate' : 'victoria_visitante']?.justificacion || "Sin justificación."}</p>`;
        }
        body += `<p>Se recomienda revisar ambos modelos antes de decidir.</p>`;
    }
    return { header, body };
}

// FUNCIÓN AUXILIAR PARA VALIDAR PROBABILIDADES
function validateProbability(value, defaultValue) {
    return isFinite(value) && value >= 0 && value <= 1 ? value : defaultValue;
}

// CÁLCULO COMPLETO
function calculateAll() {
    const leagueCode = dom.leagueSelect.value, teamHome = dom.teamHomeSelect.value, teamAway = dom.teamAwaySelect.value;
    if (!leagueCode || !teamHome || !teamAway) {
        if (dom.details) dom.details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> Selecciona liga y equipos.</div>';
        clearProbabilities();
        return;
    }
    const tH = findTeam(leagueCode, teamHome), tA = findTeam(leagueCode, teamAway);
    if (!tH.name || !tA.name) {
        if (dom.details) dom.details.innerHTML = `<div class="error"><strong>Error:</strong> Equipos no encontrados.</div>`;
        clearProbabilities();
        return;
    }
    // Calcular probabilidades solo con Dixon-Coles
    const stats = dixonColesProbabilities(tH, tA, leagueCode);
    const isLimitedData = tH.pjHome < 3 || tA.pjAway < 3; // Reduje minGames a 3
    const probabilities = [
        { label: 'Local', value: stats.finalHome, id: 'pHome', type: 'Resultado' },
        { label: 'Empate', value: stats.finalDraw, id: 'pDraw', type: 'Resultado' },
        { label: 'Visitante', value: stats.finalAway, id: 'pAway', type: 'Resultado' },
        { label: 'Ambos Anotan', value: stats.pBTTSH, id: 'pBTTS', type: 'Mercado' },
        { label: 'Más de 2.5 goles', value: stats.pO25H, id: 'pO25', type: 'Mercado' }
    ];
    // Normalizar probabilidades 1X2
    const sum1X2 = probabilities[0].value + probabilities[1].value + probabilities[2].value;
    if (sum1X2 > 0 && (sum1X2 < 0.95 || sum1X2 > 1.05)) {
        const scale = 1 / sum1X2;
        probabilities[0].value *= scale;
        probabilities[1].value *= scale;
        probabilities[2].value *= scale;
    }
    // Actualizar DOM con probabilidades
    probabilities.forEach(p => {
        p.value = validateProbability(p.value, p.type === 'Resultado' ? 1/3 : 0.5);
        if (dom[p.id]) dom[p.id].textContent = formatPct(p.value);
        else console.warn(`[calculateAll] Elemento ${p.id} no encontrado`);
    });
    // Generar recomendaciones
    const recommendations = probabilities.filter(p => p.value >= 0.3).sort((a, b) => b.value - a.value).slice(0, 3);
    if (dom.suggestion) dom.suggestion.innerHTML = `<h3>Recomendaciones de Apuesta</h3><ul>${recommendations.map(r => `<li><strong>${r.label} (${formatPct(r.value)})</strong> - ${r.type}</li>`).join('')}</ul>`;
    
    // Mostrar análisis de la IA
    const ligaName = leagueCodeToName[leagueCode];
    const event = allData.calendario[ligaName]?.find(e => normalizeName(e.local) === normalizeName(teamHome) && normalizeName(e.visitante) === normalizeName(teamAway));
    if (dom.detailedPrediction) {
        if (event?.pronostico_json) {
            const json = event.pronostico_json;
            dom.detailedPrediction.innerHTML = `
                <h3>Análisis de la IA</h3><div class="ia-prediction">
                <h4>Análisis: ${teamHome} vs. ${teamAway}</h4>
                <p><strong>${teamHome}:</strong> ${json["1X2"].victoria_local.justificacion} (Prob: ${json["1X2"].victoria_local.probabilidad})</p>
                <p><strong>Empate:</strong> ${json["1X2"].empate.justificacion} (Prob: ${json["1X2"].empate.probabilidad})</p>
                <p><strong>${teamAway}:</strong> ${json["1X2"].victoria_visitante.justificacion} (Prob: ${json["1X2"].victoria_visitante.probabilidad})</p>
                <h4>Ambos Anotan (BTTS):</h4>
                <p><strong>Sí:</strong> ${json.BTTS.si.probabilidad} ${json.BTTS.si.justificacion || ''}</p>
                <p><strong>No:</strong> ${json.BTTS.no.probabilidad} ${json.BTTS.no.justificacion || ''}</p>
                <h4>Goles Totales (Más/Menos 2.5):</h4>
                <p><strong>Más de 2.5:</strong> ${json.Goles.mas_2_5.probabilidad} ${json.Goles.mas_2_5.justificacion || ''}</p>
                <p><strong>Menos de 2.5:</strong> ${json.Goles.menos_2_5.probabilidad} ${json.Goles.menos_2_5.justificacion || ''}</p>
                </div>`;
        } else if (event?.pronostico) {
            dom.detailedPrediction.innerHTML = `<h3>Análisis de la IA</h3><div class="ia-prediction">${event.pronostico.replace(/\n/g, '<br>').replace(/###\s*(.*)/g, '<h4>$1</h4>')}</div>`;
        } else {
            dom.detailedPrediction.innerHTML = `<p>No hay pronóstico de IA disponible.</p>`;
        }
    }
    // Mostrar comparación de pronósticos
    const matchData = { local: teamHome, visitante: teamAway };
    const combined = getCombinedPrediction(stats, event || {}, matchData);
    if (dom.combinedPrediction) dom.combinedPrediction.innerHTML = `<h3>${combined.header}</h3>${combined.body}`;
    
    // Manejar datos limitados
    if (isLimitedData && dom.details) {
        dom.details.innerHTML = `<div class="warning"><strong>Advertencia:</strong> Datos limitados (PJ Home: ${tH.pjHome || 0}, PJ Away: ${tA.pjAway || 0}).</div>`;
        setTimeout(() => dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante.</div>', 5000);
    } else if (dom.details) {
        dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante.</div>';
    }
}

// CÁLCULO DE LA FORMA RECIENTE
function calculateFormFactor(form) {
    if (!form || typeof form !== 'string') return 1.0;
    const recentMatches = form.trim().split('').slice(0, 5); // Últimos 5 partidos
    const points = recentMatches.reduce((acc, result) => {
        if (result.toUpperCase() === 'V') return acc + 3;
        if (result.toUpperCase() === 'E') return acc + 1;
        if (result.toUpperCase() === 'D') return acc + 0;
        return acc;
    }, 0);
    // Normalizar puntos (máximo 15 puntos por 5 victorias)
    const formFactor = 0.8 + (points / 15) * 0.4; // Rango: 0.8 (mala forma) a 1.2 (buena forma)
    return isFinite(formFactor) ? formFactor : 1.0;
}

// CÁLCULO DE PROBABILIDADES CON DIXON-COLES (MEJORADO)
function dixonColesProbabilities(tH, tA, league) {
    if (!tH?.name || !tA?.name || !teamsByLeague[league]?.length) {
        console.warn('[dixonColesProbabilities] Datos insuficientes:', { tH, tA, league });
        return { finalHome: 1/3, finalDraw: 1/3, finalAway: 1/3, pBTTSH: 0.5, pO25H: 0.5 };
    }
    const rho = -0.15, shrinkageFactor = 0.9; // Reduje shrinkageFactor para menos peso en datos crudos
    const minGames = 3; // Reduje a 3 para mayor sensibilidad a datos iniciales
    const teams = teamsByLeague[league];

    // Calcular promedios de la liga
    const totals = teams.reduce((acc, t) => ({
        games: acc.games + (t.pj || 0) / 2,
        gfHome: acc.gfHome + (t.gfHome || 0),
        gaHome: acc.gaHome + (t.gaHome || 0),
        gfAway: acc.gfAway + (t.gfAway || 0),
        gaAway: acc.gaAway + (t.gaAway || 0),
        gd: acc.gd + ((t.gf || 0) - (t.ga || 0))
    }), { games: 0, gfHome: 0, gaHome: 0, gfAway: 0, gaAway: 0, gd: 0 });
    const leagueAvg = {
        gfHome: totals.gfHome / (totals.games || 1),
        gaHome: totals.gaHome / (totals.games || 1),
        gfAway: totals.gfAway / (totals.games || 1),
        gaAway: totals.gaAway / (totals.games || 1),
        gd: totals.gd / (totals.games || 1)
    };
    if (Object.values(leagueAvg).some(v => !isFinite(v))) {
        console.warn('[dixonColesProbabilities] Promedios de liga no válidos:', leagueAvg);
        return { finalHome: 1/3, finalDraw: 1/3, finalAway: 1/3, pBTTSH: 0.5, pO25H: 0.5 };
    }

    // Ajuste por forma reciente
    const formFactorHome = calculateFormFactor(tH.form);
    const formFactorAway = calculateFormFactor(tA.form);

    // Ajuste por ranking
    const rankFactorHome = tH.pos ? 1 + (1 - tH.pos / teams.length) * 0.2 : 1.0; // Top rank = 1.2, último = 1.0
    const rankFactorAway = tA.pos ? 1 + (1 - tA.pos / teams.length) * 0.2 : 1.0;

    // Ajuste por diferencia de goles
    const gdFactorHome = (tH.gf - tH.ga) / (leagueAvg.gd || 1);
    const gdFactorAway = (tA.gf - tA.ga) / (leagueAvg.gd || 1);
    const gdAdjustmentHome = 1 + Math.min(Math.max(gdFactorHome * 0.1, -0.1), 0.1); // Límite ±10%
    const gdAdjustmentAway = 1 + Math.min(Math.max(gdFactorAway * 0.1, -0.1), 0.1);

    // Calcular tasas de ataque y defensa
    const homeAttackRaw = (tH.gfHome || 0) / Math.max(tH.pjHome || 0, minGames) / (leagueAvg.gfHome || 1);
    const homeDefenseRaw = Math.max((tH.gaHome || 0) / Math.max(tH.pjHome || 0, minGames), 0.1) / (leagueAvg.gaHome || 1);
    const awayAttackRaw = (tA.gfAway || 0) / Math.max(tA.pjAway || 0, minGames) / (leagueAvg.gfAway || 1);
    const awayDefenseRaw = Math.max((tA.gaAway || 0) / Math.max(tA.pjAway || 0, minGames), 0.1) / (leagueAvg.gaHome || 1);

    // Mezclar con promedios de liga si hay pocos partidos
    const weight = Math.min(Math.max((tH.pjHome + tA.pjAway) / (2 * minGames), 0), 1); // Peso basado en partidos jugados
    const homeAttack = (weight * homeAttackRaw + (1 - weight) * 1.0) * formFactorHome * rankFactorHome * gdAdjustmentHome * shrinkageFactor;
    const homeDefense = (weight * homeDefenseRaw + (1 - weight) * 1.0) * formFactorHome * rankFactorHome * gdAdjustmentHome * shrinkageFactor;
    const awayAttack = (weight * awayAttackRaw + (1 - weight) * 1.0) * formFactorAway * rankFactorAway * gdAdjustmentAway * shrinkageFactor * 1.2; // Ventaja de local
    const awayDefense = (weight * awayDefenseRaw + (1 - weight) * 1.0) * formFactorAway * rankFactorAway * gdAdjustmentAway * shrinkageFactor;

    if ([homeAttack, homeDefense, awayAttack, awayDefense].some(v => !isFinite(v))) {
        console.warn('[dixonColesProbabilities] Tasas no válidas:', { homeAttack, homeDefense, awayAttack, awayDefense });
        return { finalHome: 1/3, finalDraw: 1/3, finalAway: 1/3, pBTTSH: 0.5, pO25H: 0.5 };
    }

    // Calcular goles esperados
    let expectedHomeGoals = homeAttack * awayDefense * leagueAvg.gfHome;
    let expectedAwayGoals = awayAttack * homeDefense * leagueAvg.gaAway;
    if (!isFinite(expectedHomeGoals) || !isFinite(expectedAwayGoals)) {
        console.warn('[dixonColesProbabilities] Goles esperados no válidos:', { expectedHomeGoals, expectedAwayGoals });
        return { finalHome: 1/3, finalDraw: 1/3, finalAway: 1/3, pBTTSH: 0.5, pO25H: 0.5 };
    }

    // Calcular probabilidades
    let homeWin = 0, draw = 0, awayWin = 0;
    for (let i = 0; i <= 10; i++) {
        for (let j = 0; j <= 10; j++) {
            const prob = poissonProbability(expectedHomeGoals, i) * poissonProbability(expectedAwayGoals, j);
            if (i > j) homeWin += prob;
            else if (i === j) draw += prob;
            else awayWin += prob;
        }
    }

    // Ajuste Dixon-Coles para correlación
    const tau = (scoreH, scoreA) => {
        if (scoreH === 0 && scoreA === 0) return 1 - (homeAttack * awayDefense * rho);
        if (scoreH === 0 && scoreA === 1) return 1 + (homeAttack * rho);
        if (scoreH === 1 && scoreA === 1) return 1 - rho;
        return 1;
    };
    let adjustedDraw = Array.from({ length: 11 }, (_, i) => poissonProbability(expectedHomeGoals, i) * poissonProbability(expectedAwayGoals, i) * tau(i, i)).reduce((a, b) => a + b, 0);
    const total = homeWin + draw + awayWin;
    if (total > 0) {
        const scale = 1 / total;
        homeWin *= scale; draw *= scale; awayWin *= scale;
    }
    const adjustedTotal = homeWin + adjustedDraw + awayWin;
    if (adjustedTotal > 0) {
        const scale = 1 / adjustedTotal;
        homeWin *= scale; adjustedDraw *= scale; awayWin *= scale;
    }
    if (homeWin > 0.63) {
        const excess = homeWin - 0.63;
        homeWin = 0.63;
        adjustedDraw += excess * 0.3;
        awayWin += excess * 0.7;
        const newTotal = homeWin + adjustedDraw + awayWin;
        if (newTotal > 0) {
            const scale = 1 / newTotal;
            homeWin *= scale; adjustedDraw *= scale; awayWin *= scale;
        }
    }
    let pO25H = 0;
    for (let i = 0; i <= 10; i++) {
        for (let j = 0; j <= 10; j++) {
            if (i + j >= 3) pO25H += poissonProbability(expectedHomeGoals, i) * poissonProbability(expectedAwayGoals, j);
        }
    }
    return {
        finalHome: validateProbability(homeWin, 1/3),
        finalDraw: validateProbability(adjustedDraw, 1/3),
        finalAway: validateProbability(awayWin, 1/3),
        pBTTSH: validateProbability((1 - (poissonProbability(expectedHomeGoals, 0) + poissonProbability(expectedAwayGoals, 0) - poissonProbability(expectedHomeGoals, 0) * poissonProbability(expectedAwayGoals, 0))) * 1.3, 0.5),
        pO25H: validateProbability(pO25H * 1.4, 0.5)
    };
}

// EVENTOS DEL DOM
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        alert('Herramientas de desarrollo deshabilitadas.');
    }
});
document.addEventListener('DOMContentLoaded', init);
