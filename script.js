/**
 * @fileoverview Script mejorado para interfaz web que muestra estadísticas de fútbol y calcula probabilidades de partidos
 * usando datos de una API de Google Apps Script. Ahora usa un modelo basado en la distribución de Poisson
 * con el ajuste de Dixon y Coles y "shrinkage" para una mejor predicción de empates y resultados realistas.
 * Incluye soporte para pronósticos estructurados en JSON desde el backend.
 */

// ----------------------
// UTILIDADES
// ----------------------
const $ = id => document.getElementById(id);
const formatPct = x => (100 * (isFinite(x) ? x : 0)).toFixed(1) + '%';
const formatDec = x => (isFinite(x) ? x.toFixed(2) : '0.00');
const parseNumberString = val => {
    const s = String(val || '').replace(/,/g, '.');
    const n = Number(s);
    return isFinite(n) ? n : 0;
};

// Funciones auxiliares para Poisson y Dixon-Coles
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

// ----------------------
// CONFIGURACIÓN DE LIGAS
// ----------------------
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxFsrfFgnpzUWIjjLdg_nGC3BhmJfOpxNBHamEvEkKT6RddHDDrV-ioca_4HP0JhZVk/exec";
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

// Nuevo objeto para agrupar ligas por región
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

// ----------------------
// NORMALIZACIÓN DE DATOS
// ----------------------
function normalizeTeam(raw) {
    if (!raw) return null;
    const r = {};
    r.name = raw.name || '';
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

// ----------------------
// FETCH DATOS COMPLETOS
// ----------------------
async function fetchAllData() {
    const leagueSelect = $('leagueSelect');
    if (leagueSelect) leagueSelect.innerHTML = '<option value="">Cargando datos...</option>';

    try {
        const res = await fetch(`${WEBAPP_URL}?tipo=todo&update=false`);
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error HTTP ${res.status}: ${res.statusText}. Respuesta: ${errorText}`);
        }
        allData = await res.json();

        // VALIDACIÓN MEJORADA
        if (!allData || !allData.calendario || !allData.ligas) {
            throw new Error('Estructura de datos inválida: la respuesta está vacía o faltan "calendario" o "ligas".');
        }

        const normalized = {};
        for (const key in allData.ligas) {
            normalized[key] = (allData.ligas[key] || []).map(normalizeTeam).filter(t => t && t.name);
        }
        teamsByLeague = normalized;

        localStorage.setItem('allData', JSON.stringify(allData));
        return allData;
    } catch (err) {
        console.error('Error en fetchAllData:', err);
        const errorMsg = `<div class="error"><strong>Error:</strong> No se pudieron cargar los datos de la API. Verifica la conexión a la hoja de Google Sheets o el endpoint de la API. Detalle: ${err.message}</div>`;
        $('details').innerHTML = errorMsg;
        if (leagueSelect) leagueSelect.innerHTML = '<option value="">Error al cargar ligas</option>';
        return {};
    }
}

// ----------------------
// MUESTRA DE EVENTOS DE LA LIGA SELECCIONADA
// ----------------------
function displaySelectedLeagueEvents(leagueCode) {
    const selectedEventsList = $('selected-league-events');
    if (!selectedEventsList) return;

    if (eventInterval) {
        clearInterval(eventInterval);
        eventInterval = null;
    }

    selectedEventsList.innerHTML = '';
    
    if (!leagueCode || !allData.calendario) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>Selecciona una liga para ver eventos próximos.</span></div>';
        return;
    }

    const ligaName = leagueCodeToName[leagueCode];
    const events = allData.calendario[ligaName] || [];

    if (events.length === 0) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos para esta liga.</span></div>';
        return;
    }

    const eventsPerPage = 3;
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
                div.dataset.homeTeam = event.local;
                div.dataset.awayTeam = event.visitante;

                let eventDateTime;
                let isInProgress = false;
                try {
                    const parsedDate = new Date(event.fecha);
                    if (isNaN(parsedDate.getTime())) {
                        throw new Error("Fecha inválida");
                    }
                    const now = new Date();
                    const matchDuration = 120 * 60 * 1000; // 2 horas en milisegundos (duración aproximada de un partido)
                    if (now >= parsedDate && now < new Date(parsedDate.getTime() + matchDuration)) {
                        isInProgress = true;
                    }
                    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Guatemala' };
                    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guatemala' };
                    const formattedDate = parsedDate.toLocaleDateString('es-ES', dateOptions);
                    const formattedTime = parsedDate.toLocaleTimeString('es-ES', timeOptions);
                    eventDateTime = `${formattedDate} ${formattedTime} (GT)`;
                } catch (err) {
                    console.warn(`Error parseando fecha para el evento: ${event.local} vs. ${event.visitante}`, err);
                    eventDateTime = `${event.fecha} (Hora no disponible)`;
                }

                let statusText = isInProgress ? ' - Evento en Juego' : '';
                div.innerHTML = `
                    <strong>${event.local} vs. ${event.visitante}</strong>
                    <span>Estadio: ${event.estadio || 'Por confirmar'}</span>
                    <span>${eventDateTime}${statusText}</span>
                `;

                // Agregar clase para eventos en curso y deshabilitar interacción
                if (isInProgress) {
                    div.classList.add('in-progress');
                    div.style.cursor = 'not-allowed';
                    div.title = 'Evento en curso, no seleccionable';
                } else {
                    div.addEventListener('click', () => {
                        selectEvent(event.local, event.visitante);
                    });
                }

                selectedEventsList.appendChild(div);
            });

            currentPage = (currentPage + 1) % totalPages;

        }, 800);
    }

    showCurrentPage();

    if (totalPages > 1) {
        eventInterval = setInterval(showCurrentPage, 10000);
    }
}

// ----------------------
// INICIALIZACIÓN
// ----------------------
async function init() {
    clearAll();
    
    await fetchAllData();
    
    const leagueSelect = $('leagueSelect');
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');

    if (!leagueSelect || !teamHomeSelect || !teamAwaySelect) {
        $('details').innerHTML = '<div class="error"><strong>Error:</strong> Problema con la interfaz HTML.</div>';
        return;
    }

    leagueSelect.innerHTML = '<option value="">-- Selecciona liga --</option>';

    // Crear un mapa para agrupar las ligas por región
    const regionsMap = {};
    Object.keys(leagueRegions).forEach(code => {
        const region = leagueRegions[code];
        if (!regionsMap[region]) {
            regionsMap[region] = [];
        }
        regionsMap[region].push(code);
    });

    // Ordenar las regiones de forma específica y luego alfabéticamente
    const customOrder = ["Europa", "Sudamérica", "Norteamérica", "Centroamérica", "Asia", "Copas Internacionales", "Eliminatorias Mundiales"];
    const sortedRegions = Object.keys(regionsMap).sort((a, b) => {
        const aIndex = customOrder.indexOf(a);
        const bIndex = customOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) {
            return a.localeCompare(b);
        }
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    // Recorrer las regiones ordenadas para construir el select
    sortedRegions.forEach(regionName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = regionName;

        // Ordenar las ligas dentro de cada grupo
        regionsMap[regionName].sort().forEach(code => {
            // No se agregan las ligas comentadas en la hoja de cálculo
            if (code === "conmebol.sudamericana" || code === "conmebol.libertadores") {
                return;
            }
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = leagueNames[code] || code;
            optgroup.appendChild(opt);
        });
        
        // Solo agregar el optgroup si tiene opciones dentro
        if (optgroup.children.length > 0) {
            leagueSelect.appendChild(optgroup);
        }
    });

    leagueSelect.addEventListener('change', onLeagueChange);
    
    teamHomeSelect.addEventListener('change', () => {
        if (restrictSameTeam()) {
            fillTeamData($('teamHome').value, $('leagueSelect').value, 'Home');
            calculateAll();
        }
    });
    teamAwaySelect.addEventListener('change', () => {
        if (restrictSameTeam()) {
            fillTeamData($('teamAway').value, $('leagueSelect').value, 'Away');
            calculateAll();
        }
    });

    $('reset').addEventListener('click', clearAll);
}
document.addEventListener('DOMContentLoaded', init);

// ----------------------
// FUNCIONES AUXILIARES DE UI
// ----------------------
function onLeagueChange() {
    const code = $('leagueSelect').value;
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    
    teamHomeSelect.innerHTML = '<option value="">Cargando equipos...</option>';
    teamAwaySelect.innerHTML = '<option value="">Cargando equipos...</option>';

    if (!code || !teamsByLeague[code] || teamsByLeague[code].length === 0) {
        clearTeamData('Home');
        clearTeamData('Away');
        $('details').innerHTML = '<div class="warning"><strong>Advertencia:</strong> No hay datos disponibles para esta liga.</div>';
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
    
    calculateAll();
    
    displaySelectedLeagueEvents(code);
}

function selectEvent(homeTeamName, awayTeamName) {
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    
    const leagueCode = $('leagueSelect').value;
    
    const homeOption = Array.from(teamHomeSelect.options).find(opt => opt.text === homeTeamName);
    if (homeOption) {
        teamHomeSelect.value = homeOption.value;
    }
    
    const awayOption = Array.from(teamAwaySelect.options).find(opt => opt.text === awayTeamName);
    if (awayOption) {
        teamAwaySelect.value = awayOption.value;
    }
    
    if (homeOption && awayOption) {
        fillTeamData(homeTeamName, leagueCode, 'Home');
        fillTeamData(awayTeamName, leagueCode, 'Away');
        calculateAll();
    } else {
        $('details').innerHTML = '<div class="error"><strong>Error:</strong> No se pudo encontrar uno o ambos equipos en la lista de la liga.</div>';
    }
}

function restrictSameTeam() {
    const teamHome = $('teamHome').value;
    const teamAway = $('teamAway').value;
    if (teamHome && teamAway && teamHome === teamAway) {
        $('details').innerHTML = '<div class="error"><strong>Error:</strong> No puedes seleccionar el mismo equipo para local y visitante.</div>';
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
    const typeLower = type.toLowerCase();
    
    $(`pos${type}`).textContent = '--';
    $(`gf${type}`).textContent = '--';
    $(`ga${type}`).textContent = '--';
    $(`winRate${type}`).textContent = '--';
    
    const box = $(`form${type}Box`);
    box.innerHTML = `
    <div class="team-details">
        <div class="stat-section">
            <span class="section-title">General</span>
            <div class="stat-metrics">
                <span>PJ: 0</span>
                <span>Puntos: 0</span>
                <span>DG: 0</span>
            </div>
        </div>
        <div class="stat-section">
            <span class="section-title">Local</span>
            <div class="stat-metrics">
                <span>PJ: 0</span>
                <span>PG: 0</span>
                <span>DG: 0</span>
            </div>
        </div>
        <div class="stat-section">
            <span class="section-title">Visitante</span>
            <div class="stat-metrics">
                <span>PJ: 0</span>
                <span>PG: 0</span>
                <span>DG: 0</span>
            </div>
        </div>
    </div>
    `;

    const cardHeader = $(`card-${typeLower}`).querySelector('.card-header');
    const h3 = cardHeader ? cardHeader.querySelector('h3') : null;
    const logoImg = h3 ? cardHeader.querySelector('.team-logo') : null;
    if (logoImg) {
        logoImg.remove();
    }
}

function clearAll() {
    document.querySelectorAll('.stat-value').forEach(el => el.textContent = '--');
    document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
    ['pHome', 'pDraw', 'pAway', 'pBTTS', 'pO25'].forEach(id => {
        const el = $(id);
        if (el) el.textContent = '--';
    });
    $('detailed-prediction').innerHTML = '<p>Esperando pronóstico detallado...</p>';
    $('details').innerHTML = 'Detalles del Pronóstico';
    $('suggestion').innerHTML = '<p>Esperando datos...</p>';
    $('combined-prediction').innerHTML = '<p>Esperando pronóstico combinado...</p>';
    
    clearTeamData('Home');
    clearTeamData('Away');
    displaySelectedLeagueEvents('');
}

// ----------------------
// BÚSQUEDA Y LLENADO DE EQUIPO
// ----------------------
function findTeam(leagueCode, teamName) {
    if (!teamsByLeague[leagueCode]) return null;
    return teamsByLeague[leagueCode].find(t => t.name === teamName) || null;
}

function fillTeamData(teamName, leagueCode, type) {
    const t = findTeam(leagueCode, teamName);
    const typeLower = type.toLowerCase();
    
    if (!t) {
        console.error(`Equipo no encontrado: ${teamName} en liga ${leagueCode}`);
        $('details').innerHTML = `<div class="error"><strong>Error:</strong> Equipo ${teamName} no encontrado en la liga seleccionada.</div>`;
        return;
    }

    $(`pos${type}`).textContent = t.pos || '--';
    $(`gf${type}`).textContent = formatDec(t.gf / (t.pj || 1));
    $(`ga${type}`).textContent = formatDec(t.ga / (t.pj || 1));
    $(`winRate${type}`).textContent = formatPct(t.pj ? t.g / t.pj : 0);

    const dg = t.gf - t.ga;
    const dgHome = t.gfHome - t.gaHome;
    const dgAway = t.gfAway - t.gaAway;
    
    const box = $(`form${type}Box`);
    box.innerHTML = `
    <div class="team-details">
        <div class="stat-section">
            <span class="section-title">General</span>
            <div class="stat-metrics">
                <span>PJ: ${t.pj || 0}</span>
                <span>Puntos: ${t.points || 0}</span>
                <span>DG: ${dg >= 0 ? '+' + dg : dg || 0}</span>
            </div>
        </div>
        <div class="stat-section">
            <span class="section-title">Local</span>
            <div class="stat-metrics">
                <span>PJ: ${t.pjHome || 0}</span>
                <span>PG: ${t.winsHome || 0}</span>
                <span>DG: ${dgHome >= 0 ? '+' + dgHome : dgHome || 0}</span>
            </div>
        </div>
        <div class="stat-section">
            <span class="section-title">Visitante</span>
            <div class="stat-metrics">
                <span>PJ: ${t.pjAway || 0}</span>
                <span>PG: ${t.winsAway || 0}</span>
                <span>DG: ${dgAway >= 0 ? '+' + dgAway : dgAway || 0}</span>
            </div>
        </div>
    </div>
    `;

    const cardHeader = $(`card-${typeLower}`).querySelector('.card-header');
    if (cardHeader) {
        let logoImg = cardHeader.querySelector('.team-logo');
        if (!logoImg) {
            logoImg = document.createElement('img');
            logoImg.className = 'team-logo';
            logoImg.alt = `Logo de ${t.name}`;
            const h3 = cardHeader.querySelector('h3');
            if (h3) {
                h3.insertAdjacentElement('beforebegin', logoImg);
            }
        }
        logoImg.src = t.logoUrl || '';
        logoImg.style.display = t.logoUrl ? 'inline-block' : 'none';
    }
}

// ----------------------
// CÁLCULO DE PROBABILIDADES CON DIXON-COLES Y SHRINKAGE
// ----------------------
function dixonColesProbabilities(tH, tA, league) {
    const rho = -0.11;
    const shrinkageFactor = 1.0;

    const teams = teamsByLeague[league];
    let totalGames = 0, totalGf = 0, totalGa = 0, totalGfHome = 0, totalGaHome = 0, totalGfAway = 0, totalGaAway = 0;
    teams.forEach(t => {
        totalGames += t.pj || 0;
        totalGf += t.gf || 0;
        totalGa += t.ga || 0;
        totalGfHome += t.gfHome || 0;
        totalGaHome += t.gaHome || 0;
        totalGfAway += t.gfAway || 0;
        totalGaAway += t.gaAway || 0;
    });

    const leagueAvgGfHome = totalGfHome / (totalGames || 1);
    const leagueAvgGaAway = totalGaAway / (totalGames || 1);
    const leagueAvgGfAway = totalGfAway / (totalGames || 1);
    const leagueAvgGaHome = totalGaHome / (totalGames || 1);

    const homeAttackRaw = (tH.gfHome || 0) / (tH.pjHome || 1);
    const homeDefenseRaw
