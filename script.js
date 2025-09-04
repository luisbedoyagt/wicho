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
// PARSEO DE PRONÓSTICO DE TEXTO PLANO (RESPALDO)
function parsePlainText(text, matchData) {
    console.log(`[parsePlainText] Procesando texto para ${matchData.local} vs ${matchData.visitante}`);
    const aiProbs = {};
    const aiJustification = {
        home: "Sin justificación detallada.",
        draw: "Sin justificación detallada.",
        away: "Sin justificación detallada."
    };
    const probsMatch = text.match(/Probabilidades:\s*(.*?)(?:Ambos Anotan|$)/s);
    if (probsMatch && probsMatch[1]) {
        const probsText = probsMatch[1];
        const percentages = probsText.match(/(\d+)%/g) || [];
        if (percentages.length >= 3) {
            aiProbs.home = parseFloat(percentages[0]) / 100;
            aiProbs.draw = parseFloat(percentages[1]) / 100;
            aiProbs.away = parseFloat(percentages[2]) / 100;
            console.log(`[parsePlainText] Probabilidades extraídas: Local=${aiProbs.home}, Empate=${aiProbs.draw}, Visitante=${aiProbs.away}`);
        } else {
            console.warn(`[parsePlainText] No se encontraron suficientes probabilidades en el texto: ${probsText}`);
        }
    } else {
        console.warn(`[parsePlainText] No se encontró la sección de probabilidades en el texto: ${text}`);
    }
    const analysisMatch = text.match(/Análisis del Partido:(.*?)Probabilidades:/s);
    if (analysisMatch && analysisMatch[1]) {
        const analysisText = analysisMatch[1];
        const localJustification = analysisText.match(new RegExp(`${matchData.local}:(.*?)(?:Empate:|$)`, 's'));
        const drawJustification = analysisText.match(/Empate:(.*?)(?:(?:[^:]+:)|$)/s);
        const awayJustification = analysisText.match(new RegExp(`${matchData.visitante}:(.*?)(?:Probabilidades:|$)`, 's'));

        if (localJustification) aiJustification.home = localJustification[1].trim();
        if (drawJustification) aiJustification.draw = drawJustification[1].trim();
        if (awayJustification) aiJustification.away = awayJustification[1].trim();
        console.log(`[parsePlainText] Justificaciones extraídas: Local=${aiJustification.home}, Empate=${aiJustification.draw}, Visitante=${aiJustification.away}`);
    } else {
        console.warn(`[parsePlainText] No se encontró la sección de análisis en el texto: ${text}`);
    }
    const result = {
        "1X2": {
            victoria_local: {
                probabilidad: (aiProbs.home * 100 || 0).toFixed(0) + '%',
                justificacion: aiJustification.home
            },
            empate: {
                probabilidad: (aiProbs.draw * 100 || 0).toFixed(0) + '%',
                justificacion: aiJustification.draw
            },
            victoria_visitante: {
                probabilidad: (aiProbs.away * 100 || 0).toFixed(0) + '%',
                justificacion: aiJustification.away
            }
        },
        "BTTS": {
            si: {
                probabilidad: (text.match(/BTTS.*Sí:\s*(\d+)%/)?.[1] || '0') + '%',
                justificacion: ""
            },
            no: {
                probabilidad: (text.match(/BTTS.*No:\s*(\d+)%/)?.[1] || '0') + '%',
                justificacion: ""
            }
        },
        "Goles": {
            mas_2_5: {
                probabilidad: (text.match(/Más de 2\.5:\s*(\d+)%/)?.[1] || '0') + '%',
                justificacion: ""
            },
            menos_2_5: {
                probabilidad: (text.match(/Menos de 2\.5:\s*(\d+)%/)?.[1] || '0') + '%',
                justificacion: ""
            }
        }
    };
    console.log(`[parsePlainText] Resultado final:`, result);
    return result;
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
            console.warn('[fetchAllData] allData.ligas está vacío');
            throw new Error('No se encontraron ligas en los datos de la API.');
        }
        const normalized = {};
        for (const key in allData.ligas) {
            normalized[key] = (allData.ligas[key] || []).map(normalizeTeam).filter(t => t && t.name);
            console.log(`[fetchAllData] Liga ${key} normalizada con ${normalized[key].length} equipos`, normalized[key]);
        }
        teamsByLeague = normalized;
        localStorage.setItem('allData', JSON.stringify(allData));
        console.log('[fetchAllData] Datos almacenados en localStorage');
        return allData;
    } catch (err) {
        console.error('[fetchAllData] Error:', err);
        const errorMsg = `<div class="error"><strong>Error:</strong> No se pudieron cargar los datos de la API. Verifica la conexión a la hoja de Google Sheets o el endpoint de la API. Detalle: ${err.message}</div>`;
        const details = $('details');
        if (details) details.innerHTML = errorMsg;
        if (leagueSelect) {
            leagueSelect.innerHTML = '<option value="">Error al cargar ligas</option>';
            leagueSelect.style.display = 'block';
        }
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
    if (eventInterval) {
        clearInterval(eventInterval);
        eventInterval = null;
    }
    selectedEventsList.innerHTML = '';
    if (!leagueCode || !allData.calendario) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>Selecciona una liga para ver eventos próximos.</span></div>';
        console.log('[displaySelectedLeagueEvents] Sin leagueCode o allData.calendario');
        return;
    }
    const ligaName = leagueCodeToName[leagueCode];
    const events = allData.calendario[ligaName] || [];
    if (events.length === 0) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos para esta liga.</span></div>';
        console.log(`[displaySelectedLeagueEvents] No hay eventos para ${ligaName}`);
        return;
    }
    const eventsPerPage = 2;
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

                // Buscar los logos de los equipos
                const homeTeam = findTeam(leagueCode, event.local.trim());
                const awayTeam = findTeam(leagueCode, event.visitante.trim());
                const homeLogo = homeTeam?.logoUrl || '';
                const awayLogo = awayTeam?.logoUrl || '';

                let eventDateTime;
                let isInProgress = false;
                try {
                    const parsedDate = new Date(event.fecha);
                    if (isNaN(parsedDate.getTime())) {
                        throw new Error("Fecha inválida");
                    }
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
                    console.warn(`[displaySelectedLeagueEvents] Error parseando fecha para el evento: ${event.local} vs. ${event.visitante}`, err);
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
                    div.addEventListener('click', () => {
                        selectEvent(event.local.trim(), event.visitante.trim());
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
// INICIALIZACIÓN
async function init() {
    console.log('[init] Iniciando aplicación a las', new Date().toLocaleString('es-ES', { timeZone: 'America/Guatemala' }));
    clearAll();
    const leagueSelect = $('leagueSelect');
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    if (!leagueSelect || !teamHomeSelect || !teamAwaySelect) {
        console.error('[init] Elementos DOM no encontrados: leagueSelect=', !!leagueSelect, 'teamHome=', !!teamHomeSelect, 'teamAway=', !!teamAwaySelect);
        const details = $('details');
        if (details) {
            details.innerHTML = '<div class="error"><strong>Error:</strong> Problema con la interfaz HTML. Verifica que los elementos select (leagueSelect, teamHome, teamAway) existan.</div>';
        }
        return;
    }
    leagueSelect.style.display = 'block';
    leagueSelect.innerHTML = '<option value="">Cargando ligas...</option>';
    const details = $('details');
    if (details) {
        details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
    }
    await fetchAllData();
    console.log('[init] Ligas recibidas en allData.ligas:', Object.keys(allData.ligas));
    if (!allData.ligas || !Object.keys(allData.ligas).length) {
        console.warn('[init] No hay ligas disponibles en allData.ligas');
        leagueSelect.innerHTML = '<option value="">No hay ligas disponibles</option>';
        const details = $('details');
        if (details) {
            details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No se encontraron ligas disponibles. Verifica la conexión con la API o los datos en la hoja de cálculo.</div>';
        }
        return;
    }
    leagueSelect.innerHTML = '<option value="">-- Selecciona liga --</option>';
    const regionsMap = {};
    Object.keys(allData.ligas).forEach(code => {
        const region = leagueRegions[code] || 'Otras Ligas';
        if (!regionsMap[region]) {
            regionsMap[region] = [];
        }
        regionsMap[region].push(code);
        console.log(`[init] Asignando liga ${code} a la región ${region}`);
    });
    console.log('[init] Regiones mapeadas:', regionsMap);
    
    const customOrder = ["Europa", "Sudamérica", "Norteamérica", "Centroamérica", "Asia", "Copas Internacionales", "Eliminatorias Mundiales", "Otras Ligas"];
    const sortedRegions = Object.keys(regionsMap).sort((a, b) => {
        const aIndex = customOrder.indexOf(a);
        const bIndex = customOrder.indexOf(b);
        if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });
    console.log('[init] Regiones ordenadas:', sortedRegions);

    sortedRegions.forEach(regionName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = regionName;
        regionsMap[regionName].sort().forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = leagueNames[code] || code;
            optgroup.appendChild(opt);
            console.log(`[init] Añadiendo liga ${code} (${leagueNames[code] || code}) al optgroup ${regionName}`);
        });
        if (optgroup.children.length > 0) {
            leagueSelect.appendChild(optgroup);
            console.log(`[init] Optgroup ${regionName} añadido con ${optgroup.children.length} ligas`);
        } else {
            console.log(`[init] Optgroup ${regionName} vacío, no se añade`);
        }
    });
    if (leagueSelect.children.length <= 1) {
        console.warn('[init] No se añadieron ligas al select. Verifica allData.ligas y leagueRegions.');
        leagueSelect.innerHTML = '<option value="">No hay ligas disponibles</option>';
        const details = $('details');
        if (details) {
            details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No se encontraron ligas disponibles. Verifica la conexión con la API o los datos en la hoja de cálculo.</div>';
        }
    } else {
        console.log(`[init] Select llenado con ${leagueSelect.children.length} elementos (incluyendo opción por defecto)`);
        leagueSelect.style.display = 'block';
    }
    leagueSelect.addEventListener('change', onLeagueChange);
    teamHomeSelect.addEventListener('change', () => {
        if (restrictSameTeam()) {
            const leagueCode = $('leagueSelect').value;
            const teamHome = $('teamHome').value;
            const teamAway = $('teamAway').value;
            console.log('[teamHome change] Valores:', { leagueCode, teamHome, teamAway });
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
            console.log('[teamAway change] Valores:', { leagueCode, teamHome, teamAway });
            if (leagueCode && teamHome && teamAway) {
                fillTeamData(teamAway, leagueCode, 'Away');
                calculateAll();
            }
        }
    });
    const resetButton = $('reset');
    if (resetButton) {
        resetButton.addEventListener('click', clearAll);
    } else {
        console.warn('[init] Botón de reset no encontrado');
    }
}
// EVENTO DE CAMBIO DE LIGA
function onLeagueChange() {
    const leagueCode = $('leagueSelect').value;
    console.log('[onLeagueChange] Liga seleccionada:', leagueCode);
    if (!leagueCode) {
        clearAll();
        return;
    }
    const teams = teamsByLeague[leagueCode] || [];
    console.log(`[onLeagueChange] Equipos para la liga ${leagueCode}:`, teams.map(t => t.name));
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    if (!teamHomeSelect || !teamAwaySelect) {
        console.error('[onLeagueChange] Selectores de equipos no encontrados');
        return;
    }
    teamHomeSelect.innerHTML = '<option value="">-- Selecciona equipo local --</option>';
    teamAwaySelect.innerHTML = '<option value="">-- Selecciona equipo visitante --</option>';
    teams.sort((a, b) => a.name.localeCompare(b.name)).forEach(team => {
        const optHome = document.createElement('option');
        const optAway = document.createElement('option');
        optHome.value = team.name;
        optHome.textContent = team.name;
        optAway.value = team.name;
        optAway.textContent = team.name;
        teamHomeSelect.appendChild(optHome);
        teamAwaySelect.appendChild(optAway);
        console.log(`[onLeagueChange] Añadiendo equipo ${team.name} a los selectores`);
    });
    displaySelectedLeagueEvents(leagueCode);
    clearTeamData('Home');
    clearTeamData('Away');
    clearResults();
}
// BUSCAR EQUIPO
function findTeam(leagueCode, teamName) {
    if (!leagueCode || !teamName) {
        console.warn('[findTeam] Parámetros inválidos:', { leagueCode, teamName });
        return null;
    }
    const teams = teamsByLeague[leagueCode] || [];
    const team = teams.find(t => t.name.trim().toLowerCase() === teamName.trim().toLowerCase());
    if (!team) {
        console.warn(`[findTeam] Equipo ${teamName} no encontrado en la liga ${leagueCode}`);
    }
    return team;
}
// LLENAR DATOS DE EQUIPO
function fillTeamData(teamName, leagueCode, type) {
    const team = findTeam(leagueCode, teamName);
    if (!team) {
        console.warn(`[fillTeamData] Equipo ${teamName} no encontrado para ${type}`);
        clearTeamData(type);
        return;
    }
    console.log(`[fillTeamData] Llenando datos para ${teamName} (${type})`, team);
    const pos = $(`pos${type}`);
    const gf = $(`gf${type}`);
    const ga = $(`ga${type}`);
    const winRate = $(`winRate${type}`);
    const formBox = $(`form${type}Box`);
    if (!pos || !gf || !ga || !winRate || !formBox) {
        console.error(`[fillTeamData] Elementos DOM no encontrados para ${type}`);
        return;
    }
    pos.textContent = team.pos || '--';
    gf.textContent = team.gf || '--';
    ga.textContent = team.ga || '--';
    const totalGames = team.pj || 0;
    const winRateValue = totalGames > 0 ? (team.g / totalGames) : 0;
    winRate.textContent = formatPct(winRateValue);
    formBox.innerHTML = `
        <div class="team-details">
            <div class="stat-section">
                <span class="section-title">General</span>
                <div class="stat-metrics">
                    <span>PJ: ${team.pj || 0}</span>
                    <span>Puntos: ${team.points || 0}</span>
                    <span>DG: ${(team.gf - team.ga) || 0}</span>
                </div>
            </div>
            <div class="stat-section">
                <span class="section-title">Local</span>
                <div class="stat-metrics">
                    <span>PJ: ${team.pjHome || 0}</span>
                    <span>PG: ${team.winsHome || 0}</span>
                    <span>DG: ${(team.gfHome - team.gaHome) || 0}</span>
                </div>
            </div>
            <div class="stat-section">
                <span class="section-title">Visitante</span>
                <div class="stat-metrics">
                    <span>PJ: ${team.pjAway || 0}</span>
                    <span>PG: ${team.winsAway || 0}</span>
                    <span>DG: ${(team.gfAway - team.gaAway) || 0}</span>
                </div>
            </div>
        </div>
    `;
}
// LIMPIAR DATOS DE EQUIPO
function clearTeamData(type) {
    console.log(`[clearTeamData] Limpiando datos para ${type}`);
    const pos = $(`pos${type}`);
    const gf = $(`gf${type}`);
    const ga = $(`ga${type}`);
    const winRate = $(`winRate${type}`);
    const formBox = $(`form${type}Box`);
    if (pos) pos.textContent = '--';
    if (gf) gf.textContent = '--';
    if (ga) ga.textContent = '--';
    if (winRate) winRate.textContent = '--';
    if (formBox) {
        formBox.innerHTML = `
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
    }
}
// RESTRINGIR SELECCIÓN DEL MISMO EQUIPO
function restrictSameTeam() {
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    if (!teamHomeSelect || !teamAwaySelect) {
        console.error('[restrictSameTeam] Selectores de equipos no encontrados');
        return false;
    }
    const teamHome = teamHomeSelect.value;
    const teamAway = teamAwaySelect.value;
    if (teamHome && teamAway && teamHome === teamAway) {
        console.warn('[restrictSameTeam] Mismo equipo seleccionado:', teamHome);
        const details = $('details');
        if (details) {
            details.innerHTML = '<div class="error"><strong>Error:</strong> No puedes seleccionar el mismo equipo para local y visitante.</div>';
        }
        teamAwaySelect.value = '';
        return false;
    }
    return true;
}
// LIMPIAR TODO
function clearAll() {
    console.log('[clearAll] Limpiando toda la interfaz');
    const leagueSelect = $('leagueSelect');
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    const selectedEventsList = $('selected-league-events');
    if (leagueSelect) leagueSelect.innerHTML = '<option value="">-- Selecciona liga --</option>';
    if (teamHomeSelect) teamHomeSelect.innerHTML = '<option value="">-- Selecciona equipo local --</option>';
    if (teamAwaySelect) teamAwaySelect.innerHTML = '<option value="">-- Selecciona equipo visitante --</option>';
    if (selectedEventsList) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>Selecciona una liga para ver eventos próximos.</span></div>';
    }
    if (eventInterval) {
        clearInterval(eventInterval);
        eventInterval = null;
    }
    clearTeamData('Home');
    clearTeamData('Away');
    clearResults();
}
// LIMPIAR RESULTADOS
function clearResults() {
    console.log('[clearResults] Limpiando resultados y pronósticos');
    const pHome = $('pHome');
    const pDraw = $('pDraw');
    const pAway = $('pAway');
    const pBTTS = $('pBTTS');
    const pO25 = $('pO25');
    const suggestion = $('suggestion');
    const detailedPrediction = $('detailed-prediction');
    const combinedPrediction = $('combined-prediction');
    const details = $('details');
    if (pHome) pHome.textContent = '--';
    if (pDraw) pDraw.textContent = '--';
    if (pAway) pAway.textContent = '--';
    if (pBTTS) pBTTS.textContent = '--';
    if (pO25) pO25.textContent = '--';
    if (suggestion) suggestion.innerHTML = '<p>Esperando datos...</p>';
    if (detailedPrediction) detailedPrediction.innerHTML = '<p>Esperando pronóstico detallado...</p>';
    if (combinedPrediction) combinedPrediction.innerHTML = '<p>Esperando pronóstico combinado...</p>';
    if (details) details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
}
// SELECCIÓN DE EVENTO
function selectEvent(homeTeam, awayTeam) {
    console.log('[selectEvent] Evento seleccionado:', { homeTeam, awayTeam });
    const leagueCode = $('leagueSelect').value;
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    if (!leagueCode || !teamHomeSelect || !teamAwaySelect) {
        console.error('[selectEvent] Liga o selectores no disponibles:', { leagueCode, teamHomeSelect: !!teamHomeSelect, teamAwaySelect: !!teamAwaySelect });
        return;
    }
    teamHomeSelect.value = homeTeam;
    teamAwaySelect.value = awayTeam;
    if (restrictSameTeam()) {
        fillTeamData(homeTeam, leagueCode, 'Home');
        fillTeamData(awayTeam, leagueCode, 'Away');
        calculateAll();
    }
}
// CÁLCULOS DE PRONÓSTICO
async function calculateAll() {
    const leagueCode = $('leagueSelect').value;
    const teamHome = $('teamHome').value;
    const teamAway = $('teamAway').value;
    console.log('[calculateAll] Iniciando cálculos para:', { leagueCode, teamHome, teamAway });
    if (!leagueCode || !teamHome || !teamAway) {
        console.warn('[calculateAll] Faltan datos:', { leagueCode, teamHome, teamAway });
        clearResults();
        return;
    }
    const homeTeam = findTeam(leagueCode, teamHome);
    const awayTeam = findTeam(leagueCode, teamAway);
    if (!homeTeam || !awayTeam) {
        console.warn('[calculateAll] Equipos no encontrados:', { homeTeam, awayTeam });
        const details = $('details');
        if (details) {
            details.innerHTML = `<div class="error"><strong>Error:</strong> Uno o ambos equipos no encontrados en la liga seleccionada.</div>`;
        }
        clearResults();
        return;
    }
    const transitionMessage = $('transition-message');
    const cardBody = document.querySelector('.result-card .card-body');
    if (transitionMessage && cardBody) {
        transitionMessage.querySelector('.loading-text').textContent = 'Calculando pronósticos...';
        transitionMessage.style.display = 'flex';
        cardBody.classList.add('loading');
    }
    try {
        const matchData = {
            local: teamHome,
            visitante: teamAway,
            liga: leagueNames[leagueCode] || leagueCode
        };
        console.log('[calculateAll] Enviando datos de partido a la API:', matchData);
        const res = await fetch(`${WEBAPP_URL}?tipo=prediccion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(matchData)
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error HTTP ${res.status}: ${res.statusText}. Respuesta: ${errorText}`);
        }
        const predictionData = await res.json();
        console.log('[calculateAll] Predicción recibida:', predictionData);
        let prediction;
        if (typeof predictionData === 'string') {
            console.log('[calculateAll] Parseando texto plano de la API');
            prediction = parsePlainText(predictionData, matchData);
        } else {
            prediction = predictionData;
        }
        const pHome = $('pHome');
        const pDraw = $('pDraw');
        const pAway = $('pAway');
        const pBTTS = $('pBTTS');
        const pO25 = $('pO25');
        const suggestion = $('suggestion');
        const detailedPrediction = $('detailed-prediction');
        const combinedPrediction = $('combined-prediction');
        const details = $('details');
        if (!pHome || !pDraw || !pAway || !pBTTS || !pO25 || !suggestion || !detailedPrediction || !combinedPrediction || !details) {
            console.error('[calculateAll] Elementos DOM no encontrados para mostrar resultados');
            return;
        }
        pHome.textContent = prediction["1X2"].victoria_local.probabilidad || '--';
        pDraw.textContent = prediction["1X2"].empate.probabilidad || '--';
        pAway.textContent = prediction["1X2"].victoria_visitante.probabilidad || '--';
        pBTTS.textContent = prediction.BTTS.si.probabilidad || '--';
        pO25.textContent = prediction.Goles.mas_2_5.probabilidad || '--';
        const probs = [
            { label: `${teamHome} gana`, prob: parseFloat(prediction["1X2"].victoria_local.probabilidad) || 0, justification: prediction["1X2"].victoria_local.justificacion },
            { label: 'Empate', prob: parseFloat(prediction["1X2"].empate.probabilidad) || 0, justification: prediction["1X2"].empate.justificacion },
            { label: `${teamAway} gana`, prob: parseFloat(prediction["1X2"].victoria_visitante.probabilidad) || 0, justification: prediction["1X2"].victoria_visitante.justificacion }
        ];
        probs.sort((a, b) => b.prob - a.prob);
        suggestion.innerHTML = `
            <ul>
                ${probs.map((item, idx) => `
                    <li class="rec-item">
                        <span class="rec-rank">${idx + 1}</span>
                        <span class="rec-bet">${item.label}</span>
                        <span class="rec-prob">${item.prob.toFixed(0)}%</span>
                    </li>
                `).join('')}
            </ul>
        `;
        detailedPrediction.innerHTML = `
            <p><strong>${teamHome}:</strong> ${probs.find(p => p.label === `${teamHome} gana`)?.justification || 'Sin justificación.'}</p>
            <p><strong>Empate:</strong> ${probs.find(p => p.label === 'Empate')?.justification || 'Sin justificación.'}</p>
            <p><strong>${teamAway}:</strong> ${probs.find(p => p.label === `${teamAway} gana`)?.justification || 'Sin justificación.'}</p>
        `;
        const bttsProb = parseFloat(prediction.BTTS.si.probabilidad) || 0;
        const over25Prob = parseFloat(prediction.Goles.mas_2_5.probabilidad) || 0;
        combinedPrediction.innerHTML = `
            <p><strong>Ambos Anotan:</strong> ${bttsProb >= 50 ? 'Alta probabilidad' : 'Baja probabilidad'} (${bttsProb.toFixed(0)}%)</p>
            <p><strong>Más de 2.5 Goles:</strong> ${over25Prob >= 50 ? 'Alta probabilidad' : 'Baja probabilidad'} (${over25Prob.toFixed(0)}%)</p>
        `;
        details.innerHTML = `Pronóstico para ${teamHome} vs ${teamAway}`;
        if (transitionMessage && cardBody) {
            transitionMessage.style.display = 'none';
            cardBody.classList.remove('loading');
        }
        console.log('[calculateAll] Pronósticos mostrados correctamente');
    } catch (err) {
        console.error('[calculateAll] Error al obtener predicción:', err);
        const details = $('details');
        if (details) {
            details.innerHTML = `<div class="error"><strong>Error:</strong> No se pudo obtener el pronóstico. Detalle: ${err.message}</div>`;
        }
        clearResults();
        if (transitionMessage && cardBody) {
            transitionMessage.style.display = 'none';
            cardBody.classList.remove('loading');
        }
    }
}
// INICIAR APLICACIÓN
init();
