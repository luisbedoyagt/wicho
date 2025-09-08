// UTILIDADES Y CONSTANTES
const $ = id => {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`[Utilidad] Elemento con ID "${id}" no encontrado en el DOM.`);
    }
    return element;
};
const formatPct = x => (100 * (isFinite(x) ? x : 0)).toFixed(1) + '%';
const formatDec = x => (isFinite(x) ? x.toFixed(2) : '0.00');
const parseNumberString = val => {
    const s = String(val || '').replace(/,/g, '.').trim();
    const n = Number(s);
    if (!isFinite(n) || n < 0) {
        console.warn(`[parseNumberString] Valor no numérico o negativo: "${val}" -> 0`);
        return 0;
    }
    return n;
};
function poissonProbability(lambda, k) {
    if (lambda <= 0 || k < 0) return 0;
    return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}
function factorial(n) {
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

// CENTRALIZAR SELECTORES DEL DOM
const dom = {
    leagueSelect: $('leagueSelect'),
    teamHomeSelect: $('teamHome'),
    teamAwaySelect: $('teamAway'),
    details: $('details'),
    selectedLeagueEvents: $('selected-league-events'),
    resetButton: $('reset'),
    pHome: $('pHome'),
    pDraw: $('pDraw'),
    pAway: $('pAway'),
    pBTTS: $('pBTTS'),
    pO25: $('pO25'),
    suggestion: $('suggestion'),
    detailedPrediction: $('detailed-prediction'),
    combinedPrediction: $('combined-prediction'),
    formHomeBox: $('formHomeBox'),
    formAwayBox: $('formAwayBox'),
    cardHome: $('card-home'),
    cardAway: $('card-away'),
};

// VARIABLES GLOBALES
let teamsByLeague = {};
let allData = {};
let eventInterval;

// NORMALIZACIÓN DE DATOS
function normalizeTeam(raw) {
    if (!raw) {
        console.warn('[normalizeTeam] Datos crudos nulos o indefinidos');
        return null;
    }
    console.log('[normalizeTeam] Normalizando datos crudos:', raw);
    const r = {};
    r.name = (raw.name || '').trim();
    if (!r.name) {
        console.warn('[normalizeTeam] Nombre de equipo inválido:', raw.name);
        return null;
    }
    r.pos = parseNumberString(raw.rank || 0);
    r.gf = parseNumberString(raw.goalsFor || 0);
    r.ga = parseNumberString(raw.goalsAgainst || 0);
    r.pj = parseNumberString(raw.gamesPlayed || 0);
    r.g = parseNumberString(raw.wins || 0);
    r.e = parseNumberString(raw.ties || 0);
    r.p = parseNumberString(raw.losses || 0);
    r.points = parseNumberString(raw.points || (r.g * 3 + r.e) || 0);
    r.gfHome = parseNumberString(raw.goalsForHome || 0);
    r.gfAway = parseNumberString(raw.goalsForAway || 0);
    r.gaHome = parseNumberString(raw.goalsAgainstHome || 0);
    r.gaAway = parseNumberString(raw.goalsAgainstAway || 0);
    r.pjHome = parseNumberString(raw.gamesPlayedHome || raw.matchesPlayedHome || 0);
    r.pjAway = parseNumberString(raw.gamesPlayedAway || raw.matchesPlayedAway || 0);
    r.winsHome = parseNumberString(raw.winsHome || 0);
    r.winsAway = parseNumberString(raw.winsAway || 0);
    r.tiesHome = parseNumberString(raw.tiesHome || 0);
    r.tiesAway = parseNumberString(raw.tiesAway || 0);
    r.lossesHome = parseNumberString(raw.lossesHome || 0);
    r.lossesAway = parseNumberString(raw.lossesAway || 0);
    r.logoUrl = raw.logoUrl || '';
    console.log('[normalizeTeam] Equipo normalizado:', r);
    return r;
}

// BÚSQUEDA DE EQUIPO
function findTeam(leagueCode, teamName) {
    if (!teamsByLeague[leagueCode]) {
        console.warn('[findTeam] Liga no encontrada:', leagueCode);
        return null;
    }
    const normalizedTeamName = teamName.trim().toLowerCase().replace(/\s+/g, ' ');
    const team = teamsByLeague[leagueCode].find(t => t.name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedTeamName);
    if (!team) {
        console.warn('[findTeam] Equipo no encontrado:', teamName, 'en liga:', leagueCode);
        console.log('[findTeam] Nombres disponibles:', teamsByLeague[leagueCode].map(t => t.name));
    }
    return team || null;
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
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error HTTP ${res.status}: ${res.statusText}. Respuesta: ${errorText}`);
        }
        allData = await res.json();
        console.log('[fetchAllData] Datos recibidos:', allData);
        if (!allData || !allData.calendario || !allData.ligas) {
            throw new Error('Estructura de datos inválida: la respuesta está vacía o faltan "calendario" o "ligas".');
        }
        if (!Object.keys(allData.ligas).length) {
            throw new Error('No se encontraron ligas en los datos de la API.');
        }
        teamsByLeague = Object.fromEntries(
            Object.entries(allData.ligas).map(([key, value]) => {
                console.log(`[fetchAllData] Procesando liga ${key}:`, value);
                return [key, (value || []).map(normalizeTeam).filter(t => t && t.name)];
            })
        );
        console.log('[fetchAllData] teamsByLeague:', teamsByLeague);
        localStorage.setItem('allData', JSON.stringify(allData));
        return allData;
    } catch (err) {
        console.error('[fetchAllData] Error:', err);
        const errorMsg = `<div class="error"><strong>Error:</strong> No se pudieron cargar los datos de la API. Verifica la conexión a la hoja de Google Sheets o el endpoint de la API. Detalle: ${err.message}</div>`;
        if (dom.details) dom.details.innerHTML = errorMsg;
        if (dom.leagueSelect) {
            dom.leagueSelect.innerHTML = '<option value="">Error al cargar ligas</option>';
            dom.leagueSelect.disabled = true;
        }
        return {};
    } finally {
        if (dom.leagueSelect) dom.leagueSelect.disabled = false;
    }
}

// MUESTRA DE EVENTOS DE LA LIGA SELECCIONADA
function displaySelectedLeagueEvents(leagueCode) {
    if (!dom.selectedLeagueEvents) return;
    if (eventInterval) clearInterval(eventInterval);
    dom.selectedLeagueEvents.innerHTML = '';
    if (!allData.calendario) {
        dom.selectedLeagueEvents.innerHTML = '<div class="event-item placeholder"><span>Selecciona una liga para ver eventos próximos.</span></div>';
        return;
    }
    let events = [];
    if (leagueCode) {
        events = allData.calendario[leagueCodeToName[leagueCode]] || [];
    } else {
        for (const code in allData.calendario) {
            const originalCode = Object.keys(leagueCodeToName).find(key => leagueCodeToName[key] === code);
            if (originalCode) {
                allData.calendario[code].forEach(event => {
                    events.push({ ...event, leagueCode: originalCode });
                });
            }
        }
    }
    if (events.length === 0) {
        dom.selectedLeagueEvents.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos para esta liga.</span></div>';
        return;
    }
    const eventsPerPage = 1;
    const totalPages = Math.ceil(events.length / eventsPerPage);
    let currentPage = 0;
    function showCurrentPage() {
        const startIndex = currentPage * eventsPerPage;
        const eventsToShow = events.slice(startIndex, startIndex + eventsPerPage);
        dom.selectedLeagueEvents.innerHTML = '';
        eventsToShow.forEach((event, index) => {
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
                    const matchDuration = 120 * 60 * 1000;
                    isInProgress = now >= parsedDate && now < new Date(parsedDate.getTime() + matchDuration);
                    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Guatemala' };
                    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guatemala' };
                    const formattedDate = parsedDate.toLocaleDateString('es-ES', dateOptions);
                    const formattedTime = parsedDate.toLocaleTimeString('es-ES', timeOptions);
                    eventDateTime = `${formattedDate} ${formattedTime} (GT)`;
                }
            } catch (err) {
                console.error('Error al parsear fecha del evento:', err);
            }
            const statusText = isInProgress ? ' - Evento en Juego' : '';
            div.innerHTML = `
                <div class="event-content">
                    <div class="team-logo-container">
                        <span class="team-name">${event.local.trim()}</span>
                        <img src="${homeLogo}" class="team-logo home-logo ${!homeLogo ? 'hidden' : ''}" alt="Logo de ${event.local.trim()}">
                        <span class="vs">vs.</span>
                        <img src="${awayLogo}" class="team-logo away-logo ${!awayLogo ? 'hidden' : ''}" alt="Logo de ${event.visitante.trim()}">
                        <span class="team-name">${event.visitante.trim()}</span>
                    </div>
                    <span class="event-details">${eventDateTime}${statusText}</span>
                    <span class="event-details">Estadio: ${event.estadio || 'Por confirmar'}</span>
                </div>
            `;
            if (isInProgress) {
                div.classList.add('in-progress');
                div.style.cursor = 'not-allowed';
                div.title = 'Evento en curso, no seleccionable';
            } else {
                div.addEventListener('click', () => selectEvent(event.local.trim(), event.visitante.trim()));
            }
            dom.selectedLeagueEvents.appendChild(div);
        });
        currentPage = (currentPage + 1) % totalPages;
    }
    showCurrentPage();
    if (totalPages > 1) eventInterval = setInterval(showCurrentPage, 10000);
}

// CAMBIO DE LIGA
function onLeagueChange() {
    const code = dom.leagueSelect.value;
    if (!dom.teamHomeSelect || !dom.teamAwaySelect) return;
    dom.teamHomeSelect.disabled = !code;
    dom.teamAwaySelect.disabled = !code;
    dom.teamHomeSelect.innerHTML = '<option value="">Cargando equipos...</option>';
    dom.teamAwaySelect.innerHTML = '<option value="">Cargando equipos...</option>';
    if (!code || !teamsByLeague[code] || teamsByLeague[code].length === 0) {
        clearTeamData('Home');
        clearTeamData('Away');
        if (dom.details) dom.details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No hay datos disponibles para esta liga.</div>';
        displaySelectedLeagueEvents('');
        return;
    }
    const teams = teamsByLeague[code].sort((a, b) => a.name.localeCompare(b.name));
    const fragmentHome = document.createDocumentFragment();
    const defaultOptionHome = document.createElement('option');
    defaultOptionHome.value = '';
    defaultOptionHome.textContent = '-- Selecciona equipo --';
    fragmentHome.appendChild(defaultOptionHome);
    const fragmentAway = document.createDocumentFragment();
    const defaultOptionAway = document.createElement('option');
    defaultOptionAway.value = '';
    defaultOptionAway.textContent = '-- Selecciona equipo --';
    fragmentAway.appendChild(defaultOptionAway);
    teams.forEach(t => {
        const opt1 = document.createElement('option');
        opt1.value = t.name;
        opt1.textContent = t.name;
        fragmentHome.appendChild(opt1);
        const opt2 = document.createElement('option');
        opt2.value = t.name;
        opt2.textContent = t.name;
        fragmentAway.appendChild(opt2);
    });
    dom.teamHomeSelect.innerHTML = '';
    dom.teamAwaySelect.innerHTML = '';
    dom.teamHomeSelect.appendChild(fragmentHome);
    dom.teamAwaySelect.appendChild(fragmentAway);
    clearTeamData('Home');
    clearTeamData('Away');
    displaySelectedLeagueEvents(code);
    clearProbabilities();
}

// SELECCIÓN DE EVENTO
function selectEvent(homeTeamName, awayTeamName) {
    let eventLeagueCode = '';
    const ligaName = Object.keys(allData.calendario).find(liga =>
        (allData.calendario[liga] || []).some(e =>
            e.local.trim().toLowerCase() === homeTeamName.trim().toLowerCase() &&
            e.visitante.trim().toLowerCase() === awayTeamName.trim().toLowerCase()
        )
    );
    if (ligaName) {
        eventLeagueCode = Object.keys(leagueCodeToName).find(key => leagueCodeToName[key] === ligaName) || '';
    }
    if (dom.leagueSelect) dom.leagueSelect.value = eventLeagueCode;
    onLeagueChange();
    setTimeout(() => {
        const normalizeName = name => name.trim().toLowerCase().replace(/\s+/g, ' ');
        const homeOption = Array.from(dom.teamHomeSelect.options).find(opt => normalizeName(opt.text) === normalizeName(homeTeamName));
        const awayOption = Array.from(dom.teamAwaySelect.options).find(opt => normalizeName(opt.text) === normalizeName(awayTeamName));
        if (homeOption) dom.teamHomeSelect.value = homeOption.value;
        if (awayOption) dom.teamAwaySelect.value = awayOption.value;
        onTeamChange();
    }, 500);
}

// INICIALIZACIÓN
async function init() {
    console.log('[init] Iniciando aplicación a las', new Date().toLocaleString('es-ES', { timeZone: 'America/Guatemala' }));
    clearAll();
    if (!dom.leagueSelect || !dom.teamHomeSelect || !dom.teamAwaySelect) {
        if (dom.details) dom.details.innerHTML = '<div class="error"><strong>Error:</strong> Problema con la interfaz HTML. Verifica que los elementos select existan.</div>';
        return;
    }
    dom.leagueSelect.style.display = 'block';
    dom.leagueSelect.innerHTML = '<option value="">Cargando ligas...</option>';
    if (dom.details) dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
    await fetchAllData();
    if (!allData.ligas || !Object.keys(allData.ligas).length) {
        dom.leagueSelect.innerHTML = '<option value="">No hay ligas disponibles</option>';
        if (dom.details) dom.details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No se encontraron ligas disponibles. Verifica la conexión con la API.</div>';
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
        const aIndex = customOrder.indexOf(a);
        const bIndex = customOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
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
        if (optgroup.children.length > 0) dom.leagueSelect.appendChild(optgroup);
    });
    if (dom.leagueSelect.children.length <= 1) {
        dom.leagueSelect.innerHTML = '<option value="">No hay ligas disponibles</option>';
        if (dom.details) dom.details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No se encontraron ligas disponibles. Verifica la conexión con la API.</div>';
    } else {
        dom.leagueSelect.style.display = 'block';
    }
    dom.leagueSelect.addEventListener('change', onLeagueChange);
    dom.teamHomeSelect.addEventListener('change', onTeamChange);
    dom.teamAwaySelect.addEventListener('change', onTeamChange);
    if (dom.resetButton) dom.resetButton.addEventListener('click', clearAll);
    displaySelectedLeagueEvents('');
}

// ONTEAMCHANGE
function onTeamChange(event) {
    const leagueCode = dom.leagueSelect.value;
    const teamHome = dom.teamHomeSelect.value;
    const teamAway = dom.teamAwaySelect.value;

    if (!leagueCode) {
        clearProbabilities();
        clearTeamData('Home');
        clearTeamData('Away');
        return;
    }

    if (event) {
        const selectedTeamName = event.target.value;
        const isHome = event.target.id === 'teamHome';
        const teamData = findTeam(leagueCode, selectedTeamName);
        
        if (isHome) {
            if (selectedTeamName) {
                fillTeamData(teamData, 'Home');
            } else {
                clearTeamData('Home');
            }
        } else {
            if (selectedTeamName) {
                fillTeamData(teamData, 'Away');
            } else {
                clearTeamData('Away');
            }
        }
    } else {
        const teamHData = findTeam(leagueCode, teamHome);
        const teamAData = findTeam(leagueCode, teamAway);
        if (teamHData) fillTeamData(teamHData, 'Home');
        if (teamAData) fillTeamData(teamAData, 'Away');
    }

    if (teamHome && teamAway && teamHome !== teamAway) {
        const tH = findTeam(leagueCode, teamHome);
        const tA = findTeam(leagueCode, teamAway);
        if (tH && tA) {
            calculateAll();
        } else {
            if (dom.details) dom.details.innerHTML = `<div class="error"><strong>Error:</strong> Uno o ambos equipos no encontrados en la liga seleccionada.</div>`;
            clearProbabilities();
        }
    } else {
        clearProbabilities();
        if (teamHome && teamAway && teamHome === teamAway) {
            dom.details.innerHTML = '<div class="error"><strong>Error:</strong> No puedes seleccionar el mismo equipo para local y visitante.</div>';
            setTimeout(() => {
                dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
            }, 5000);
        }
    }
}

// FUNCIÓN PARA LIMPIAR SOLO LAS PROBABILIDADES
function clearProbabilities() {
    ['pHome', 'pDraw', 'pAway', 'pBTTS', 'pO25'].forEach(id => {
        const el = dom[id];
        if (el) el.textContent = '--';
    });
    if (dom.suggestion) dom.suggestion.innerHTML = '<p>Esperando datos...</p>';
    if (dom.detailedPrediction) dom.detailedPrediction.innerHTML = '<p>Esperando pronóstico detallado...</p>';
    if (dom.combinedPrediction) dom.combinedPrediction.innerHTML = '<p>Esperando pronóstico combinado...</p>';
}

// GENERAR HTML PARA DATOS DE EQUIPO
function generateTeamHtml(team = {}) {
    const dg = (team.gf || 0) - (team.ga || 0);
    const dgHome = (team.gfHome || 0) - (team.gaHome || 0);
    const dgAway = (team.gfAway || 0) - (team.gaAway || 0);
    const winPct = team.pj > 0 ? ((team.g / team.pj) * 100).toFixed(1) : '0.0';
    return `
        <div class="team-details">
            <div class="stat-section">
                <span class="section-title">General</span>
                <div class="stat-metrics">
                    <span>PJ: ${team.pj || 0}</span>
                    <span>Puntos: ${team.points || 0}</span>
                    <span>DG: ${dg >= 0 ? '+' + dg : dg || 0}</span>
                </div>
            </div>
            <div class="stat-section">
                <span class="section-title">Local</span>
                <div class="stat-metrics">
                    <span>PJ: ${team.pjHome || 0}</span>
                    <span>PG: ${team.winsHome || 0}</span>
                    <span>DG: ${dgHome >= 0 ? '+' + dgHome : dgHome || 0}</span>
                </div>
            </div>
            <div class="stat-section">
                <span class="section-title">Visitante</span>
                <div class="stat-metrics">
                    <span>PJ: ${team.pjAway || 0}</span>
                    <span>PG: ${team.winsAway || 0}</span>
                    <span>DG: ${dgAway >= 0 ? '+' + dgAway : dgAway || 0}</span>
                </div>
            </div>
            <div class="stat-section">
                <span class="section-title">Datos</span>
                <div class="stat-metrics">
                    <span>Posición: ${team.pos || '--'}</span>
                    <span>% de Victorias: ${winPct || '--'}%</span>
                </div>
            </div>
        </div>
    `;
}

// LIMPIAR DATOS DE EQUIPO
function clearTeamData(type) {
    const typeLower = type.toLowerCase();
    const cardHeader = dom[`card${type}`]?.querySelector('.card-header');
    const logoImg = cardHeader?.querySelector('.team-logo');
    logoImg?.remove();
    const box = dom[`form${type}Box`];
    if (box) box.innerHTML = generateTeamHtml();
}

// LLENAR DATOS DE EQUIPO
function fillTeamData(team, type) {
    if (!team) {
        console.warn(`[fillTeamData] Equipo no válido para tipo ${type}`);
        clearTeamData(type);
        return;
    }
    const typeLower = type.toLowerCase();
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
    const box = dom[`form${type}Box`];
    if (box) box.innerHTML = generateTeamHtml(team);
}

// LIMPIAR TODO
function clearAll() {
    if (dom.leagueSelect) dom.leagueSelect.selectedIndex = 0;
    if (dom.teamHomeSelect) dom.teamHomeSelect.selectedIndex = 0;
    if (dom.teamAwaySelect) dom.teamAwaySelect.selectedIndex = 0;
    clearProbabilities();
    if (dom.details) dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
    clearTeamData('Home');
    clearTeamData('Away');
    displaySelectedLeagueEvents('');
}

// CÁLCULO DE PROBABILIDADES CON DIXON-COLES
function dixonColesProbabilities(tH, tA, league) {
    if (!tH || !tA || !teamsByLeague[league] || teamsByLeague[league].length === 0) {
        console.warn('[dixonColesProbabilities] Datos insuficientes para los equipos o la liga:', { tH, tA, league });
        return {
            finalHome: 1/3,
            finalDraw: 1/3,
            finalAway: 1/3,
            pBTTSH: 0.5,
            pO25H: 0.5
        };
    }

    const rho = -0.11;
    const shrinkageFactor = 1.0;
    const teams = teamsByLeague[league];

    // Calcular promedios de la liga
    let totalGames = 0, totalGfHome = 0, totalGaHome = 0, totalGfAway = 0, totalGaAway = 0;
    teams.forEach(t => {
        totalGames += t.pj || 0;
        totalGfHome += t.gfHome || 0;
        totalGaHome += t.gaHome || 0;
        totalGfAway += t.gfAway || 0;
        totalGaAway += t.gaAway || 0;
    });

    const leagueAvgGfHome = totalGfHome / (totalGames || 1);
    const leagueAvgGaHome = totalGaHome / (totalGames || 1);
    const leagueAvgGfAway = totalGfAway / (totalGames || 1);
    const leagueAvgGaAway = totalGaAway / (totalGames || 1);

    // Calcular tasas de ataque y defensa con suavizado para pocos partidos
    const minGames = 1;
    const homeAttackRaw = (tH.gfHome || 0) / (Math.max(tH.pjHome || 1, minGames));
    const homeDefenseRaw = Math.max((tH.gaHome || 0) / (Math.max(tH.pjHome || 1, minGames)), 0.1);
    const awayAttackRaw = (tA.gfAway || 0) / (Math.max(tA.pjAway || 1, minGames));
    const awayDefenseRaw = Math.max((tA.gaAway || 0) / (Math.max(tA.pjAway || 1, minGames)), 0.1);

    const homeAttack = (homeAttackRaw / (leagueAvgGfHome || 1)) * shrinkageFactor;
    const homeDefense = (homeDefenseRaw / (leagueAvgGaHome || 1)) * shrinkageFactor;
    const awayAttack = (awayAttackRaw / (leagueAvgGfAway || 1)) * shrinkageFactor;
    const awayDefense = (awayDefenseRaw / (leagueAvgGaHome || 1)) * shrinkageFactor;

    // Verificar valores finitos
    if (!isFinite(homeAttack) || !isFinite(homeDefense) || !isFinite(awayAttack) || !isFinite(awayDefense)) {
        console.warn('[dixonColesProbabilities] Tasas no válidas:', { homeAttack, homeDefense, awayAttack, awayDefense });
        return {
            finalHome: 1/3,
            finalDraw: 1/3,
            finalAway: 1/3,
            pBTTSH: 0.5,
            pO25H: 0.5
        };
    }

    const expectedHomeGoals = homeAttack * awayDefense * leagueAvgGfHome;
    const expectedAwayGoals = awayAttack * homeDefense * leagueAvgGaAway;

    if (!isFinite(expectedHomeGoals) || !isFinite(expectedAwayGoals)) {
        console.warn('[dixonColesProbabilities] Goles esperados no válidos:', { expectedHomeGoals, expectedAwayGoals });
        return {
            finalHome: 1/3,
            finalDraw: 1/3,
            finalAway: 1/3,
            pBTTSH: 0.5,
            pO25H: 0.5
        };
    }

    let homeWin = 0, draw = 0, awayWin = 0;
    for (let i = 0; i <= 10; i++) {
        for (let j = 0; j <= 10; j++) {
            const prob = poissonProbability(expectedHomeGoals, i) * poissonProbability(expectedAwayGoals, j);
            if (i > j) homeWin += prob;
            else if (i === j) draw += prob;
            else awayWin += prob;
        }
    }

    const tau = (scoreH, scoreA) => {
        if (scoreH === 0 && scoreA === 0) return 1 - (homeAttack * awayDefense * rho);
        if (scoreH === 0 && scoreA === 1) return 1 + (homeAttack * rho);
        if (scoreH === 1 && scoreA === 0) return 1 + (awayDefense * rho);
        if (scoreH === 1 && scoreA === 1) return 1 - rho;
        return 1;
    };

    let adjustedDraw = 0;
    for (let i = 0; i <= 10; i++) {
        const prob = poissonProbability(expectedHomeGoals, i) * poissonProbability(expectedAwayGoals, i) * tau(i, i);
        adjustedDraw += prob;
    }

    const total = homeWin + draw + awayWin;
    if (total > 0) {
        const scale = 1 / total;
        homeWin *= scale;
        draw *= scale;
        awayWin *= scale;
    }

    const adjustedTotal = homeWin + adjustedDraw + awayWin;
    if (adjustedTotal > 0) {
        const scale = 1 / adjustedTotal;
        homeWin *= scale;
        adjustedDraw *= scale;
        awayWin *= scale;
    }

    const pBTTSH = 1 - (poissonProbability(expectedHomeGoals, 0) + poissonProbability(expectedAwayGoals, 0) - poissonProbability(expectedHomeGoals, 0) * poissonProbability(expectedAwayGoals, 0));
    let pO25H = 0;
    for (let i = 0; i <= 10; i++) {
        for (let j = 0; j <= 10; j++) {
            if (i + j >= 3) {
                pO25H += poissonProbability(expectedHomeGoals, i) * poissonProbability(expectedAwayGoals, j);
            }
        }
    }

    return {
        finalHome: isFinite(homeWin) ? homeWin : 1/3,
        finalDraw: isFinite(adjustedDraw) ? adjustedDraw : 1/3,
        finalAway: isFinite(awayWin) ? awayWin : 1/3,
        pBTTSH: isFinite(pBTTSH) ? pBTTSH : 0.5,
        pO25H: isFinite(pO25H) ? pO25H : 0.5
    };
}

// PARSEO DE PRONÓSTICO DE TEXTO PLANO
function parsePlainText(text, matchData) {
    console.log(`[parsePlainText] Procesando texto para ${matchData.local} vs ${matchData.visitante}:`, text);
    const aiProbs = {};
    const aiJustification = {
        home: "Sin justificación detallada.",
        draw: "Sin justificación detallada.",
        away: "Sin justificación detallada."
    };

    // Validar texto de entrada
    if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn('[parsePlainText] Texto inválido o vacío, usando valores predeterminados');
        return {
            "1X2": {
                victoria_local: { probabilidad: '33.3%', justificacion: aiJustification.home },
                empate: { probabilidad: '33.3%', justificacion: aiJustification.draw },
                victoria_visitante: { probabilidad: '33.3%', justificacion: aiJustification.away }
            },
            "BTTS": {
                si: { probabilidad: '50.0%', justificacion: "" },
                no: { probabilidad: '50.0%', justificacion: "" }
            },
            "Goles": {
                mas_2_5: { probabilidad: '50.0%', justificacion: "" },
                menos_2_5: { probabilidad: '50.0%', justificacion: "" }
            }
        };
    }

    // Parsear probabilidades de 1X2
    const probsMatch = text.match(/Probabilidades\s*[:|-]?\s*(.*?)(?:Ambos\s*Anotan|$)/is);
    if (probsMatch && probsMatch[1]) {
        const probsText = probsMatch[1];
        const percentages = probsText.match(/(\d+\.?\d*)%/g) || [];
        if (percentages.length >= 3) {
            aiProbs.home = parseFloat(percentages[0]) / 100;
            aiProbs.draw = parseFloat(percentages[1]) / 100;
            aiProbs.away = parseFloat(percentages[2]) / 100;
            // Normalizar si no suman ~100%
            const sum = aiProbs.home + aiProbs.draw + aiProbs.away;
            if (!isFinite(sum) || sum < 0.95 || sum > 1.05) {
                console.warn('[parsePlainText] Probabilidades 1X2 no válidas o no suman ~100%:', aiProbs);
                const scale = sum > 0 ? 1 / sum : 1/3;
                aiProbs.home = (aiProbs.home * scale) || 1/3;
                aiProbs.draw = (aiProbs.draw * scale) || 1/3;
                aiProbs.away = (aiProbs.away * scale) || 1/3;
            }
        } else {
            console.warn('[parsePlainText] No se encontraron suficientes porcentajes para 1X2:', percentages);
            aiProbs.home = aiProbs.draw = aiProbs.away = 1/3;
        }
    } else {
        console.warn('[parsePlainText] No se encontró sección de Probabilidades en el texto');
        aiProbs.home = aiProbs.draw = aiProbs.away = 1/3;
    }

    // Parsear BTTS y Goles
    const bttsSiMatch = text.match(/BTTS.*Sí\s*[:|-]?\s*(\d+\.?\d*)%/is);
    const bttsNoMatch = text.match(/BTTS.*No\s*[:|-]?\s*(\d+\.?\d*)%/is);
    const over25Match = text.match(/Más\s*de\s*2\.5\s*[:|-]?\s*(\d+\.?\d*)%/is);
    const under25Match = text.match(/Menos\s*de\s*2\.5\s*[:|-]?\s*(\d+\.?\d*)%/is);

    let bttsSi = bttsSiMatch ? parseFloat(bttsSiMatch[1]) : 50;
    let bttsNo = bttsNoMatch ? parseFloat(bttsNoMatch[1]) : 50;
    let over25 = over25Match ? parseFloat(over25Match[1]) : 50;
    let under25 = under25Match ? parseFloat(under25Match[1]) : 50;

    // Normalizar BTTS
    const bttsSum = bttsSi + bttsNo;
    if (!isFinite(bttsSum) || bttsSum < 95 || bttsSum > 105) {
        console.warn('[parsePlainText] BTTS Sí + No no válidos o no suman ~100%:', { bttsSi, bttsNo });
        bttsSi = bttsNo = 50;
    } else {
        const scale = bttsSum > 0 ? 100 / bttsSum : 1;
        bttsSi *= scale;
        bttsNo *= scale;
    }

    // Normalizar Más/Menos 2.5
    const goalsSum = over25 + under25;
    if (!isFinite(goalsSum) || goalsSum < 95 || goalsSum > 105) {
        console.warn('[parsePlainText] Goles Más/Menos 2.5 no válidos o no suman ~100%:', { over25, under25 });
        over25 = under25 = 50;
    } else {
        const scale = goalsSum > 0 ? 100 / goalsSum : 1;
        over25 *= scale;
        under25 *= scale;
    }

    // Parsear justificaciones
    const analysisMatch = text.match(/Análisis\s*del\s*Partido\s*[:|-]?\s*(.*?)(?:Probabilidades\s*[:|-]?|$)/is);
    if (analysisMatch && analysisMatch[1]) {
        const analysisText = analysisMatch[1];
        const localJustification = analysisText.match(new RegExp(`${matchData.local}\\s*[:|-]?\s*(.*?)(?:Empate\s*[:|-]?|$|${matchData.visitante}\\s*[:|-]?)`, 'is'));
        const drawJustification = analysisText.match(/Empate\s*[:|-]?\s*(.*?)(?:(?:[^:]+[:|-]?)|$)/is);
        const awayJustification = analysisText.match(new RegExp(`${matchData.visitante}\\s*[:|-]?\s*(.*?)(?:Probabilidades\s*[:|-]?|$)`, 'is'));
        if (localJustification) aiJustification.home = localJustification[1].trim();
        if (drawJustification) aiJustification.draw = drawJustification[1].trim();
        if (awayJustification) aiJustification.away = awayJustification[1].trim();
    }

    return {
        "1X2": {
            victoria_local: { probabilidad: (aiProbs.home * 100).toFixed(1) + '%', justificacion: aiJustification.home },
            empate: { probabilidad: (aiProbs.draw * 100).toFixed(1) + '%', justificacion: aiJustification.draw },
            victoria_visitante: { probabilidad: (aiProbs.away * 100).toFixed(1) + '%', justificacion: aiJustification.away }
        },
        "BTTS": {
            si: { probabilidad: bttsSi.toFixed(1) + '%', justificacion: "" },
            no: { probabilidad: bttsNo.toFixed(1) + '%', justificacion: "" }
        },
        "Goles": {
            mas_2_5: { probabilidad: over25.toFixed(1) + '%', justificacion: "" },
            menos_2_5: { probabilidad: under25.toFixed(1) + '%', justificacion: "" }
        }
    };
}

// COMBINACIÓN DE PRONÓSTICOS
function getCombinedPrediction(finalProbs, stats, event, matchData) {
    const combined = {};
    const ai = event.pronostico_json || parsePlainText(event.pronostico || '', matchData);
    if (!ai || !ai["1X2"] || Object.values(ai["1X2"]).every(p => !p?.probabilidad)) {
        combined.header = "Análisis Estadístico Principal";
        combined.body = `<p>No se encontró un pronóstico de IA válido. El análisis se basa en datos estadísticos locales.</p>`;
        return combined;
    }
    const statProbs = {
        home: stats.finalHome,
        draw: stats.finalDraw,
        away: stats.finalAway
    };
    const aiProbs = {
        home: parseFloat(ai["1X2"].victoria_local.probabilidad) / 100 || 0,
        draw: parseFloat(ai["1X2"].empate.probabilidad) / 100 || 0,
        away: parseFloat(ai["1X2"].victoria_visitante.probabilidad) / 100 || 0,
    };
    const finalProbsMap = {
        home: finalProbs.find(p => p.label === 'Local').value,
        draw: finalProbs.find(p => p.label === 'Empate').value,
        away: finalProbs.find(p => p.label === 'Visitante').value
    };
    const statMax = Math.max(statProbs.home, statProbs.draw, statProbs.away);
    const aiMax = Math.max(aiProbs.home, aiProbs.draw, aiProbs.away);
    const finalMax = Math.max(finalProbsMap.home, finalProbsMap.draw, finalProbsMap.away);
    const statBest = Object.keys(statProbs).find(k => statProbs[k] === statMax);
    const aiBest = Object.keys(aiProbs).find(k => aiProbs[k] === aiMax);
    const finalBest = Object.keys(finalProbsMap).find(k => finalProbsMap[k] === finalMax);
    let header = "Pronóstico Combinado (Estadística + IA)";
    let body = `
        <p><strong>Modelo Estadístico:</strong> Victoria Local: ${formatPct(statProbs.home)}, Empate: ${formatPct(statProbs.draw)}, Victoria Visitante: ${formatPct(statProbs.away)}.</p>
        <p><strong>Modelo de IA:</strong> Victoria Local: ${formatPct(aiProbs.home)}, Empate: ${formatPct(aiProbs.draw)}, Victoria Visitante: ${formatPct(aiProbs.away)}.</p>
        <p><strong>Pronóstico Final:</strong> Victoria Local: ${formatPct(finalProbsMap.home)}, Empate: ${formatPct(finalProbsMap.draw)}, Victoria Visitante: ${formatPct(finalProbsMap.away)}.</p>
    `;
    if (statBest === aiBest && aiBest === finalBest) {
        const resultText = finalBest === 'home' ? `Victoria ${matchData.local}` : finalBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
        const reason = ai["1X2"][finalBest === 'home' ? 'victoria_local' : finalBest === 'draw' ? 'empate' : 'victoria_visitante']?.justificacion || "Sin justificación detallada.";
        header = `¡Consenso! Apuesta Fuerte en la ${resultText} ⭐`;
        body += `<p>Todos los modelos coinciden en que la **${resultText}** es el resultado más probable.</p>`;
        body += `<p><strong>Justificación de la IA:</strong> ${reason}</p>`;
    } else {
        const statResult = statBest === 'home' ? `Victoria ${matchData.local}` : statBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
        const aiResult = aiBest === 'home' ? `Victoria ${matchData.local}` : aiBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
        const finalResult = finalBest === 'home' ? `Victoria ${matchData.local}` : finalBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
        header = "Discrepancia en Pronósticos ⚠️";
        body += `<p>El modelo estadístico (${formatPct(statMax)}) favorece la **${statResult}**, mientras que la IA (${formatPct(aiMax)}) se inclina por la **${aiResult}**. El pronóstico final sugiere la **${finalResult}** (${formatPct(finalMax)}).</p>`;
        body += `<p><strong>Análisis de la IA:</strong> ${ai["1X2"][aiBest === 'home' ? 'victoria_local' : aiBest === 'draw' ? 'empate' : 'victoria_visitante']?.justificacion || "Sin justificación detallada."}</p>`;
        body += `<p>Se recomienda cautela. Analiza la justificación de la IA para entender los factores externos que no considera el modelo estadístico.</p>`;
    }
    combined.header = header;
    combined.body = body;
    return combined;
}

// FUNCIÓN AUXILIAR PARA VALIDAR PROBABILIDADES
function validateProbability(value, defaultValue) {
    return isFinite(value) && value >= 0 && value <= 1 ? value : defaultValue;
}

// CÁLCULO COMPLETO
function calculateAll() {
    const leagueCode = dom.leagueSelect.value;
    const teamHome = dom.teamHomeSelect.value;
    const teamAway = dom.teamAwaySelect.value;
    if (!leagueCode || !teamHome || !teamAway) {
        if (dom.details) dom.details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> Selecciona una liga y ambos equipos para calcular el pronóstico.</div>';
        clearProbabilities();
        return;
    }
    const tH = findTeam(leagueCode, teamHome);
    const tA = findTeam(leagueCode, teamAway);
    if (!tH || !tA) {
        if (dom.details) dom.details.innerHTML = `<div class="error"><strong>Error:</strong> Uno o ambos equipos no encontrados en la liga seleccionada.</div>`;
        clearProbabilities();
        return;
    }
    const stats = dixonColesProbabilities(tH, tA, leagueCode);
    const ligaName = leagueCodeToName[leagueCode];
    const event = allData.calendario[ligaName]?.find(e => e.local.trim().toLowerCase() === teamHome.trim().toLowerCase() && e.visitante.trim().toLowerCase() === teamAway.trim().toLowerCase());
    const matchData = { local: teamHome, visitante: teamAway };

    console.log('Equipo Local:', tH);
    console.log('Equipo Visitante:', tA);
    console.log('Stats (Dixon-Coles):', stats);
    console.log('Evento:', event);
    console.log('Pronóstico IA (crudo):', event?.pronostico_json || event?.pronostico);

    // Obtener probabilidades de la IA
    const ai = event?.pronostico_json || parsePlainText(event?.pronostico || '', matchData);
    const isLimitedData = (!tH || !tA || tH.pjHome < 1 || tA.pjAway < 1);
    const iaHome = validateProbability(parseFloat(ai["1X2"]?.victoria_local?.probabilidad) / 100, stats.finalHome);
    const iaDraw = validateProbability(parseFloat(ai["1X2"]?.empate?.probabilidad) / 100, stats.finalDraw);
    const iaAway = validateProbability(parseFloat(ai["1X2"]?.victoria_visitante?.probabilidad) / 100, stats.finalAway);
    const iaBTTS = validateProbability(parseFloat(ai.BTTS?.si?.probabilidad) / 100, stats.pBTTSH);
    const iaO25 = validateProbability(parseFloat(ai.Goles?.mas_2_5?.probabilidad) / 100, stats.pO25H);

    console.log('Probabilidades IA (parseadas):', { iaHome, iaDraw, iaAway, iaBTTS, iaO25 });

    // Usar IA directamente si hay pocos datos locales, o promediar si hay suficientes
    const probabilities = [
        {
            label: 'Local',
            value: isLimitedData || !event?.pronostico_json ? iaHome : (stats.finalHome + iaHome) / 2,
            id: 'pHome',
            type: 'Resultado'
        },
        {
            label: 'Empate',
            value: isLimitedData || !event?.pronostico_json ? iaDraw : (stats.finalDraw + iaDraw) / 2,
            id: 'pDraw',
            type: 'Resultado'
        },
        {
            label: 'Visitante',
            value: isLimitedData || !event?.pronostico_json ? iaAway : (stats.finalAway + iaAway) / 2,
            id: 'pAway',
            type: 'Resultado'
        },
        {
            label: 'Ambos Anotan',
            value: isLimitedData || !event?.pronostico_json ? iaBTTS : (stats.pBTTSH + iaBTTS) / 2,
            id: 'pBTTS',
            type: 'Mercado'
        },
        {
            label: 'Más de 2.5 goles',
            value: isLimitedData || !event?.pronostico_json ? iaO25 : (stats.pO25H + iaO25) / 2,
            id: 'pO25',
            type: 'Mercado'
        }
    ];

    // Normalizar 1X2 para que sume ~100%
    const sum1X2 = probabilities[0].value + probabilities[1].value + probabilities[2].value;
    if (sum1X2 > 0 && (sum1X2 < 0.95 || sum1X2 > 1.05)) {
        console.warn('[calculateAll] Probabilidades 1X2 no suman ~100%:', sum1X2);
        const scale = 1 / sum1X2;
        probabilities[0].value *= scale;
        probabilities[1].value *= scale;
        probabilities[2].value *= scale;
    }

    // Actualizar DOM
    probabilities.forEach(p => {
        p.value = validateProbability(p.value, 0.5);
        const el = dom[p.id];
        if (el) el.textContent = formatPct(p.value);
        else console.warn(`[calculateAll] Elemento DOM ${p.id} no encontrado`);
    });

    console.log('Probabilidades Finales:', probabilities);

    // Generar recomendaciones
    const recommendations = probabilities.filter(p => p.value >= 0.3).sort((a, b) => b.value - a.value).slice(0, 3);
    let suggestionText = '<h3>Recomendaciones de Apuesta</h3><ul>';
    recommendations.forEach(r => {
        suggestionText += `<li><strong>${r.label} (${formatPct(r.value)})</strong> - ${r.type}</li>`;
    });
    suggestionText += '</ul>';
    if (dom.suggestion) dom.suggestion.innerHTML = suggestionText;
    else console.warn('[calculateAll] Elemento DOM suggestion no encontrado');

    // Mostrar análisis detallado de la IA
    if (dom.detailedPrediction) {
        if (event && event.pronostico_json) {
            const json = event.pronostico_json;
            let html = `<h3>Análisis de la IA</h3><div class="ia-prediction">`;
            html += `<h4>Análisis del Partido: ${teamHome} vs. ${teamAway}</h4>`;
            html += `<p><strong>${teamHome}:</strong> ${json["1X2"].victoria_local.justificacion} (Probabilidad: ${json["1X2"].victoria_local.probabilidad})</p>`;
            html += `<p><strong>Empate:</strong> ${json["1X2"].empate.justificacion} (Probabilidad: ${json["1X2"].empate.probabilidad})</p>`;
            html += `<p><strong>${teamAway}:</strong> ${json["1X2"].victoria_visitante.justificacion} (Probabilidad: ${json["1X2"].victoria_visitante.probabilidad})</p>`;
            html += `<h4>Ambos Anotan (BTTS):</h4>`;
            html += `<p><strong>Sí:</strong> ${json.BTTS.si.probabilidad} ${json.BTTS.si.justificacion ? ` - ${json.BTTS.si.justificacion}` : ''}</p>`;
            html += `<p><strong>No:</strong> ${json.BTTS.no.probabilidad} ${json.BTTS.no.justificacion ? ` - ${json.BTTS.no.justificacion}` : ''}</p>`;
            html += `<h4>Goles Totales (Más/Menos 2.5):</h4>`;
            html += `<p><strong>Más de 2.5:</strong> ${json.Goles.mas_2_5.probabilidad} ${json.Goles.mas_2_5.justificacion ? ` - ${json.Goles.mas_2_5.justificacion}` : ''}</p>`;
            html += `<p><strong>Menos de 2.5:</strong> ${json.Goles.menos_2_5.probabilidad} ${json.Goles.menos_2_5.justificacion ? ` - ${json.Goles.menos_2_5.justificacion}` : ''}</p>`;
            html += `</div>`;
            dom.detailedPrediction.innerHTML = html;
        } else if (event && event.pronostico) {
            const formattedPrediction = event.pronostico.replace(/\n/g, '<br>').replace(/###\s*(.*)/g, '<h4>$1</h4>');
            dom.detailedPrediction.innerHTML = `<h3>Análisis de la IA</h3><div class="ia-prediction">${formattedPrediction}</div>`;
        } else {
            dom.detailedPrediction.innerHTML = `<p>No hay un pronóstico de la IA disponible para este partido en la hoja de cálculo.</p>`;
        }
    } else {
        console.warn('[calculateAll] Elemento DOM detailedPrediction no encontrado');
    }

    // Generar pronóstico combinado
    const combined = getCombinedPrediction(probabilities, stats, event || {}, matchData);
    if (dom.combinedPrediction) dom.combinedPrediction.innerHTML = `<h3>${combined.header}</h3>${combined.body}`;
    else console.warn('[calculateAll] Elemento DOM combinedPrediction no encontrado');

    // Mostrar advertencia solo si no hay datos locales
    if (isLimitedData && dom.details) {
        dom.details.innerHTML = `<div class="warning"><strong>Advertencia:</strong> Sin datos locales (PJ Home: ${tH?.pjHome || 0}, PJ Away: ${tA?.pjAway || 0}). Usando pronóstico de IA exclusivamente.</div>`;
        setTimeout(() => {
            dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
        }, 5000);
    } else if (dom.details) {
        dom.details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
    }
}

// EVENTOS DEL DOM
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        alert('Las herramientas de desarrollo están deshabilitadas.');
    }
});
document.addEventListener('DOMContentLoaded', init);
