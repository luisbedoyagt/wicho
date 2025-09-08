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

// BUSCAR EQUIPO
function findTeam(league, teamName) {
    if (!teamsByLeague[league] || !teamName) return null;
    return teamsByLeague[league].find(t => t && t.name && t.name.toLowerCase() === teamName.toLowerCase()) || null;
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
            throw new Error('No se encontraron ligas en los datos recibidos.');
        }

        // Organizar equipos por liga
        teamsByLeague = {};
        Object.entries(allData.ligas).forEach(([league, teams]) => {
            teamsByLeague[league] = (teams || []).map(normalizeTeam).filter(t => t);
        });

        // Rellenar el selector de ligas
        const regions = [...new Set(Object.values(leagueRegions))];
        leagueSelect.innerHTML = '<option value="">Selecciona una liga</option>';
        regions.forEach(region => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = region;
            Object.entries(leagueNames)
                .filter(([code]) => leagueRegions[code] === region)
                .sort((a, b) => a[1].localeCompare(b[1]))
                .forEach(([code, name]) => {
                    const option = document.createElement('option');
                    option.value = code;
                    option.textContent = name;
                    optgroup.appendChild(option);
                });
            leagueSelect.appendChild(optgroup);
        });
    } catch (error) {
        console.error('[fetchAllData] Error:', error);
        leagueSelect.innerHTML = '<option value="">Error al cargar datos</option>';
        const eventsContainer = $('selected-league-events');
        if (eventsContainer) {
            eventsContainer.innerHTML = '<div class="event-item placeholder"><span>Error al cargar los datos. Por favor, intenta de nuevo.</span></div>';
        }
    }
}

// CAMBIO DE LIGA
function onLeagueChange() {
    const leagueSelect = $('leagueSelect');
    const selectedLeague = leagueSelect.value;
    const teamHome = $('teamHome');
    const teamAway = $('teamAway');
    if (!selectedLeague) {
        teamHome.innerHTML = '<option value="">Selecciona una liga primero</option>';
        teamAway.innerHTML = '<option value="">Selecciona una liga primero</option>';
        $('selected-league-events').innerHTML = '<div class="event-item placeholder"><span>Selecciona una liga para ver eventos próximos.</span></div>';
        clearAll();
        return;
    }

    // Rellenar selectores de equipos
    teamHome.innerHTML = '<option value="">Selecciona equipo local</option>';
    teamAway.innerHTML = '<option value="">Selecciona equipo visitante</option>';
    if (teamsByLeague[selectedLeague]) {
        teamsByLeague[selectedLeague].sort((a, b) => a.name.localeCompare(b.name)).forEach(team => {
            const optionHome = document.createElement('option');
            optionHome.value = team.name;
            optionHome.textContent = team.name;
            teamHome.appendChild(optionHome);
            const optionAway = document.createElement('option');
            optionAway.value = team.name;
            optionAway.textContent = team.name;
            teamAway.appendChild(optionAway);
        });
    }

    // Mostrar eventos de la liga seleccionada
    displaySelectedLeagueEvents(selectedLeague);
    clearAll();
}

// MOSTRAR EVENTOS DE LA LIGA SELECCIONADA
function displaySelectedLeagueEvents(league) {
    const eventsContainer = $('selected-league-events');
    if (!eventsContainer) return;
    eventsContainer.innerHTML = '<div class="event-item placeholder"><span>Cargando eventos...</span></div>';

    const events = (allData.calendario && allData.calendario[league]) || [];
    if (!events.length) {
        eventsContainer.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos para esta liga.</span></div>';
        return;
    }

    eventsContainer.innerHTML = '';
    currentEventPage = 0;
    if (eventInterval) clearInterval(eventInterval);

    function showEvent(index) {
        eventsContainer.innerHTML = '';
        const event = events[index];
        const eventItem = document.importNode($('event-item-template').content, true).querySelector('.event-item');
        const homeLogo = eventItem.querySelector('.home-logo');
        const awayLogo = eventItem.querySelector('.away-logo');
        eventItem.querySelector('[data-home-team]').textContent = event.homeTeam || 'TBD';
        eventItem.querySelector('[data-away-team]').textContent = event.awayTeam || 'TBD';
        eventItem.querySelector('[data-event-datetime]').textContent = event.datetime || 'Fecha TBD';
        eventItem.querySelector('[data-event-stadium]').textContent = event.stadium || 'Estadio TBD';
        homeLogo.src = event.homeLogo || '';
        awayLogo.src = event.awayLogo || '';
        homeLogo.classList.toggle('hidden', !event.homeLogo);
        awayLogo.classList.toggle('hidden', !event.awayLogo);
        eventItem.classList.add('slide-in');
        eventItem.addEventListener('click', () => selectEvent(event));
        eventsContainer.appendChild(eventItem);
    }

    showEvent(currentEventPage);
    if (events.length > 1) {
        eventInterval = setInterval(() => {
            const prevEvent = eventsContainer.querySelector('.event-item');
            if (prevEvent) prevEvent.classList.replace('slide-in', 'slide-out');
            setTimeout(() => {
                currentEventPage = (currentEventPage + 1) % events.length;
                showEvent(currentEventPage);
            }, 800);
        }, 5000);
    }
}

// SELECCIÓN DE EVENTO
function selectEvent(event) {
    const leagueSelect = $('leagueSelect');
    const teamHome = $('teamHome');
    const teamAway = $('teamAway');
    if (eventInterval) clearInterval(eventInterval);
    if (event.homeTeam && event.awayTeam && leagueSelect.value) {
        teamHome.value = event.homeTeam;
        teamAway.value = event.awayTeam;
        restrictSameTeam();
        calculateAll();
    }
}

// INICIALIZACIÓN
async function init() {
    await fetchAllData();
    const leagueSelect = $('leagueSelect');
    const teamHome = $('teamHome');
    const teamAway = $('teamAway');
    const resetButton = $('reset');
    if (leagueSelect) leagueSelect.addEventListener('change', onLeagueChange);
    if (teamHome) teamHome.addEventListener('change', restrictSameTeam);
    if (teamAway) teamAway.addEventListener('change', restrictSameTeam);
    if (resetButton) resetButton.addEventListener('click', clearAll);
}

// INICIAR APLICACIÓN
init();
