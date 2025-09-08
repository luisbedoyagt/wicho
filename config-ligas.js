// UTILIDADES
const $ = id => {
    const element = document.getElementById(id);
    if (!element) console.error(`[Utilidades] Elemento con ID ${id} no encontrado en el DOM`);
    return element;
};
const formatPct = x => (100 * (isFinite(x) ? x : 0)).toFixed(1) + '%';
const formatDec = x => (isFinite(x) ? x.toFixed(2) : '0.00');
const parseNumberString = val => {
    const s = String(val || '').replace(/,/g, '.');
    const n = Number(s);
    return isFinite(n) ? n : 0;
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

// CONFIGURACIÓN DE LIGAS
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzOJtjsqYuqxn6sMxFKQ7vb5TxoGxj7NoxcfUp5omYIw3C5s3qyAvOfLvRyGeE2xpc4/exec";
let teamsByLeague = {};
let allData = {};
let currentEventPage = 0;
let eventInterval;
const leagueNames = {
    "esp.1": "LaLiga España",
    "esp.2": "Segunda España",
    "eng.1": "Premier League Inglaterra",
    "eng.2": "Championship Inglaterra",
    "ita.1": "Serie A Italia",
    "ger.1": "Bundesliga Alemania",
    "fra.1": "Ligue 1 Francia",
    "ned.1": "Eredivisie Países Bajos",
    "ned.2": "Eerste Divisie Países Bajos",
    "por.1": "Liga Portugal",
    "mex.1": "Liga MX México",
    "mex.2": "Liga de Expansión MX",
    "usa.1": "MLS Estados Unidos",
    "bra.1": "Brasileirão Brasil",
    "gua.1": "Liga Nacional Guatemala",
    "crc.1": "Liga Promerica Costa Rica",
    "hon.1": "Honduras LigaNacional",
    "slv.1": "El Salvador Liga Primera División",
    "ksa.1": "Pro League Arabia Saudita",
    "tur.1": "Super Lig de Turquía",
    "ger.2": "Bundesliga 2 de Alemania",
    "arg.1": "Liga Profesional de Fútbol de Argentina",
    "conmebol.sudamericana": "CONMEBOL Sudamericana",
    "conmebol.libertadores": "CONMEBOL Libertadores",
    "chn.1": "Superliga China",
    "fifa.worldq.conmebol": "Eliminatorias CONMEBOL",
    "fifa.worldq.concacaf": "Eliminatorias CONCACAF",
    "fifa.worldq.uefa": "Eliminatorias UEFA"
};
const leagueCodeToName = {
    "esp.1": "España_LaLiga",
    "esp.2": "España_Segunda",
    "eng.1": "Inglaterra_PremierLeague",
    "eng.2": "Inglaterra_Championship",
    "ita.1": "Italia_SerieA",
    "ger.1": "Alemania_Bundesliga",
    "fra.1": "Francia_Ligue1",
    "ned.1": "PaísesBajos_Eredivisie",
    "ned.2": "PaísesBajos_EersteDivisie",
    "por.1": "Portugal_LigaPortugal",
    "mex.1": "México_LigaMX",
    "mex.2": "México_ExpansionMX",
    "usa.1": "EstadosUnidos_MLS",
    "bra.1": "Brasil_Brasileirao",
    "gua.1": "Guatemala_LigaNacional",
    "crc.1": "CostaRica_LigaPromerica",
    "hon.1": "Honduras_LigaNacional",
    "slv.1": "ElSalvador_LigaPrimeraDivision",
    "ksa.1": "Arabia_Saudi_ProLeague",
    "tur.1": "Turquia_SuperLig",
    "ger.2": "Alemania_Bundesliga2",
    "arg.1": "Argentina_LigaProfesional",
    "conmebol.sudamericana": "CONMEBOL_Sudamericana",
    "conmebol.libertadores": "CONMEBOL_Libertadores",
    "chn.1": "China_Superliga",
    "fifa.worldq.conmebol": "Eliminatorias_CONMEBOL",
    "fifa.worldq.concacaf": "Eliminatorias_CONCACAF",
    "fifa.worldq.uefa": "Eliminatorias_UEFA"
};
const leagueRegions = {
    "esp.1": "Europa",
    "esp.2": "Europa",
    "eng.1": "Europa",
    "eng.2": "Europa",
    "ita.1": "Europa",
    "ger.1": "Europa",
    "fra.1": "Europa",
    "ned.1": "Europa",
    "ned.2": "Europa",
    "por.1": "Europa",
    "tur.1": "Europa",
    "ger.2": "Europa",
    "arg.1": "Sudamérica",
    "bra.1": "Sudamérica",
    "mex.1": "Norteamérica",
    "mex.2": "Norteamérica",
    "usa.1": "Norteamérica",
    "gua.1": "Centroamérica",
    "crc.1": "Centroamérica",
    "hon.1": "Centroamérica",
    "slv.1": "Centroamérica",
    "ksa.1": "Asia",
    "chn.1": "Asia",
    "conmebol.sudamericana": "Copas Internacionales",
    "conmebol.libertadores": "Copas Internacionales",
    "fifa.worldq.conmebol": "Eliminatorias Mundiales",
    "fifa.worldq.concacaf": "Eliminatorias Mundiales",
    "fifa.worldq.uefa": "Eliminatorias Mundiales"
};

// NORMALIZACIÓN DE DATOS
function normalizeTeam(raw) {
    if (!raw) return null;
    const r = {};
    r.name = (raw.name || '').trim();
    if (!r.name) return null;
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
    r.pjHome = parseNumberString(raw.gamesPlayedHome || 0);
    r.pjAway = parseNumberString(raw.gamesPlayedAway || 0);
    r.winsHome = parseNumberString(raw.winsHome || 0);
    r.winsAway = parseNumberString(raw.winsAway || 0);
    r.tiesHome = parseNumberString(raw.tiesHome || 0);
    r.tiesAway = parseNumberString(raw.tiesAway || 0);
    r.lossesHome = parseNumberString(raw.lossesHome || 0);
    r.lossesAway = parseNumberString(raw.lossesAway || 0);
    r.logoUrl = raw.logoUrl || '';
    return r;
}

// BÚSQUEDA DE EQUIPO
function findTeam(leagueCode, teamName) {
    if (leagueCode) {
        if (!teamsByLeague[leagueCode]) return null;
        return teamsByLeague[leagueCode].find(t => t.name.trim().toLowerCase() === teamName.trim().toLowerCase()) || null;
    } else {
        for (const code in teamsByLeague) {
            const team = teamsByLeague[code].find(t => t.name.trim().toLowerCase() === teamName.trim().toLowerCase());
            if (team) return team;
        }
        return null;
    }
}

// FETCH DATOS COMPLETOS
async function fetchAllData() {
    const leagueSelect = $('leagueSelect');
    if (leagueSelect) {
        leagueSelect.innerHTML = '<option value="">Cargando datos...</option>';
        leagueSelect.style.display = 'block';
    }
    try {
        console.log('[fetchAllData] Solicitando datos desde:', WEBAPP_URL);
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
        const normalized = {};
        for (const key in allData.ligas) {
            normalized[key] = (allData.ligas[key] || []).map(normalizeTeam).filter(t => t && t.name);
            console.log(`[fetchAllData] Liga ${key} normalizada con ${normalized[key].length} equipos`);
        }
        teamsByLeague = normalized;
        localStorage.setItem('allData', JSON.stringify(allData));
        return allData;
    } catch (err) {
        console.error('[fetchAllData] Error:', err);
        const errorMsg = `<div class="error"><strong>Error:</strong> No se pudieron cargar los datos de la API. Verifica la conexión a la hoja de Google Sheets o el endpoint de la API. Detalle: ${err.message}</div>`;
        const details = $('details');
        if (details) details.innerHTML = errorMsg;
        if (leagueSelect) leagueSelect.innerHTML = '<option value="">Error al cargar ligas</option>';
        return {};
    }
}

// MUESTRA DE EVENTOS DE LA LIGA SELECCIONADA
function displaySelectedLeagueEvents(leagueCode) {
    const selectedEventsList = $('selected-league-events');
    if (!selectedEventsList) {
        console.warn('[displaySelectedLeagueEvents] Elemento selected-league-events no encontrado');
        return;
    }
    if (eventInterval) clearInterval(eventInterval);
    selectedEventsList.innerHTML = '';
    if (!allData.calendario) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>Selecciona una liga para ver eventos próximos.</span></div>';
        return;
    }
    let events = [];
    if (!leagueCode) {
        Object.keys(allData.calendario).forEach(ligaName => {
            events = events.concat(allData.calendario[ligaName] || []);
        });
    } else {
        const ligaName = leagueCodeToName[leagueCode];
        events = allData.calendario[ligaName] || [];
    }
    if (events.length === 0) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos para esta liga.</span></div>';
        return;
    }
    const eventsPerPage = 1;
    const totalPages = Math.ceil(events.length / eventsPerPage);
    let currentPage = 0;
    function showCurrentPage() {
        const startIndex = currentPage * eventsPerPage;
        const eventsToShow = events.slice(startIndex, startIndex + eventsPerPage);
        const currentItems = selectedEventsList.querySelectorAll('.event-item');
        if (currentItems.length > 0) {
            currentItems.forEach(item => {
                item.classList.remove('slide-in');
                item.classList.add('slide-out');
            });
        }
        setTimeout(() => {
            selectedEventsList.innerHTML = '';
            eventsToShow.forEach((event, index) => {
                const div = document.createElement('div');
                div.className = 'event-item slide-in';
                div.style.animationDelay = `${index * 0.1}s`;
                div.dataset.homeTeam = event.local.trim();
                div.dataset.awayTeam = event.visitante.trim();
                const homeTeam = findTeam(leagueCode, event.local.trim());
                const awayTeam = findTeam(leagueCode, event.visitante.trim());
                const homeLogo = homeTeam?.logoUrl || '';
                const awayLogo = awayTeam?.logoUrl || '';
                let eventDateTime;
                let isInProgress = false;
                try {
                    const parsedDate = new Date(event.fecha);
                    if (isNaN(parsedDate.getTime())) throw new Error("Fecha inválida");
                    const now = new Date();
                    const matchDuration = 120 * 60 * 1000;
                    if (now >= parsedDate && now < new Date(parsedDate.getTime() + matchDuration)) {
                        isInProgress = true;
                    }
                    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Guatemala' };
                    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guatemala' };
                    const formattedDate = parsedDate.toLocaleDateString('es-ES', dateOptions);
                    const formattedTime = parsedDate.toLocaleTimeString('es-ES', timeOptions);
                    eventDateTime = `${formattedDate} ${formattedTime} (GT)`;
                } catch (err) {
                    eventDateTime = `${event.fecha} (Hora no disponible)`;
                }
                let statusText = isInProgress ? ' - Evento en Juego' : '';
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
                selectedEventsList.appendChild(div);
            });
            currentPage = (currentPage + 1) % totalPages;
        }, 800);
    }
    showCurrentPage();
    if (totalPages > 1) eventInterval = setInterval(showCurrentPage, 10000);
}

// CAMBIO DE LIGA
function onLeagueChange() {
    const code = $('leagueSelect').value;
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    teamHomeSelect.disabled = !code;
    teamAwaySelect.disabled = !code;
    if (!teamHomeSelect || !teamAwaySelect) return;
    teamHomeSelect.innerHTML = '<option value="">Cargando equipos...</option>';
    teamAwaySelect.innerHTML = '<option value="">Cargando equipos...</option>';
    if (!code || !teamsByLeague[code] || teamsByLeague[code].length === 0) {
        clearTeamData('Home');
        clearTeamData('Away');
        const details = $('details');
        if (details) details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No hay datos disponibles para esta liga.</div>';
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
    teamHomeSelect.innerHTML = '';
    teamAwaySelect.innerHTML = '';
    teamHomeSelect.appendChild(fragmentHome);
    teamAwaySelect.appendChild(fragmentAway);
    clearTeamData('Home');
    clearTeamData('Away');
    displaySelectedLeagueEvents(code);
}

// SELECCIÓN DE EVENTO
function selectEvent(homeTeamName, awayTeamName) {
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    const leagueSelect = $('leagueSelect');
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
    if (eventLeagueCode && leagueSelect) {
        leagueSelect.value = eventLeagueCode;
        const changeEvent = new Event('change');
        leagueSelect.dispatchEvent(changeEvent);
    } else {
        const details = $('details');
        if (details) details.innerHTML = '<div class="error"><strong>Error:</strong> No se pudo encontrar la liga del evento.</div>';
        return;
    }
    setTimeout(() => {
        const normalizeName = name => name.trim().toLowerCase();
        const homeOption = Array.from(teamHomeSelect.options).find(opt => normalizeName(opt.text) === normalizeName(homeTeamName));
        const awayOption = Array.from(teamAwaySelect.options).find(opt => normalizeName(opt.text) === normalizeName(awayTeamName));
        if (homeOption) teamHomeSelect.value = homeOption.value;
        if (awayOption) teamAwaySelect.value = awayOption.value;
        if (homeOption && awayOption && restrictSameTeam()) {
            fillTeamData(homeTeamName, eventLeagueCode, 'Home');
            fillTeamData(awayTeamName, eventLeagueCode, 'Away');
            calculateAll();
        } else {
            const details = $('details');
            if (details) details.innerHTML = '<div class="error"><strong>Error:</strong> No se pudo encontrar uno o ambos equipos en la lista de la liga.</div>';
        }
    }, 500);
}

// INICIALIZACIÓN
async function init() {
    console.log('[init] Iniciando aplicación a las', new Date().toLocaleString('es-ES', { timeZone: 'America/Guatemala' }));
    clearAll();
    const leagueSelect = $('leagueSelect');
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    if (!leagueSelect || !teamHomeSelect || !teamAwaySelect) {
        const details = $('details');
        if (details) details.innerHTML = '<div class="error"><strong>Error:</strong> Problema con la interfaz HTML. Verifica que los elementos select existan.</div>';
        return;
    }
    leagueSelect.style.display = 'block';
    leagueSelect.innerHTML = '<option value="">Cargando ligas...</option>';
    const details = $('details');
    if (details) details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
    await fetchAllData();
    if (!allData.ligas || !Object.keys(allData.ligas).length) {
        leagueSelect.innerHTML = '<option value="">No hay ligas disponibles</option>';
        if (details) details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No se encontraron ligas disponibles. Verifica la conexión con la API.</div>';
        return;
    }
    leagueSelect.innerHTML = '<option value="">-- Selecciona liga --</option>';
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
        if (optgroup.children.length > 0) leagueSelect.appendChild(optgroup);
    });
    if (leagueSelect.children.length <= 1) {
        leagueSelect.innerHTML = '<option value="">No hay ligas disponibles</option>';
        if (details) details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No se encontraron ligas disponibles. Verifica la conexión con la API.</div>';
    } else {
        leagueSelect.style.display = 'block';
    }
    leagueSelect.addEventListener('change', onLeagueChange);
    teamHomeSelect.addEventListener('change', () => {
        if (restrictSameTeam()) {
            const leagueCode = $('leagueSelect').value;
            const teamHome = $('teamHome').value;
            const teamAway = $('teamAway').value;
            if (leagueCode && teamHome && teamAway) {
                fillTeamData(teamHome, leagueCode, 'Home');
                calculateAll();
            }
        }
    });
    teamAwaySelect.addEventListener('change', () => {
        if (restrictSameTeam()) {
            const leagueCode = $('leagueSelect').value;
            const teamHome = $('teamHome').value;
            const teamAway = $('teamAway').value;
            if (leagueCode && teamHome && teamAway) {
                fillTeamData(teamAway, leagueCode, 'Away');
                calculateAll();
            }
        }
    });
    const resetButton = $('reset');
    if (resetButton) resetButton.addEventListener('click', clearAll);
    displaySelectedLeagueEvents('');
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
