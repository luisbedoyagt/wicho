// UTILIDADES Y CONSTANTES
const getDomElement = id => {
    const element = document.getElementById(id);
    if (!element) console.warn(`[DOM] Elemento con ID "${id}" no encontrado.`);
    return element;
};

const formatPct = x => (100 * (isFinite(x) ? x : 0)).toFixed(1) + '%';
const formatDec = x => (isFinite(x) ? x.toFixed(2) : '0.00');
const parseNumberString = val => {
    const n = Number(String(val).replace(/,/g, '.').replace(/%/g, '').trim());
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
    away: ['gamesPlayedAway', 'matchesPlayedAway', 'awayGamesPlayed', 'awayMatches', 'playedAway', 'awayPlayed', 'gamesAway', 'matchesAway'],
    goalsForHome: ['goalsForHome', 'homeGoalsFor', 'gfHome', 'goalsScoredHome'],
    goalsForAway: ['goalsForAway', 'awayGoalsFor', 'gfAway', 'goalsScoredAway'],
    goalsAgainstHome: ['goalsAgainstHome', 'homeGoalsAgainst', 'gaHome', 'goalsConcededHome'],
    goalsAgainstAway: ['goalsAgainstAway', 'awayGoalsAgainst', 'gaAway', 'goalsConcededAway'],
    winsHome: ['winsHome', 'homeWins', 'victoriesHome'],
    winsAway: ['winsAway', 'awayWins', 'victoriesAway'],
    tiesHome: ['tiesHome', 'homeTies', 'drawsHome'],
    tiesAway: ['tiesAway', 'awayTies', 'drawsAway'],
    lossesHome: ['lossesHome', 'homeLosses', 'defeatsHome'],
    lossesAway: ['lossesAway', 'awayLosses', 'defeatsAway']
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
        gfHome: teamFields.goalsForHome.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        gfAway: teamFields.goalsForAway.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        gaHome: teamFields.goalsAgainstHome.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        gaAway: teamFields.goalsAgainstAway.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        pjHome: teamFields.home.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        pjAway: teamFields.away.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        winsHome: teamFields.winsHome.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        winsAway: teamFields.winsAway.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        tiesHome: teamFields.tiesHome.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        tiesAway: teamFields.tiesAway.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        lossesHome: teamFields.lossesHome.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        lossesAway: teamFields.lossesAway.reduce((val, field) => val || parseNumberString(raw[field]), 0),
        logoUrl: raw.logoUrl || '',
        form: raw.form ? raw.form.trim().toUpperCase() : '',
        formHome: raw.formHome ? raw.formHome.trim().toUpperCase() : raw.form ? raw.form.trim().toUpperCase() : '',
        formAway: raw.formAway ? raw.formAway.trim().toUpperCase() : raw.form ? raw.form.trim().toUpperCase() : ''
    };
    if (r.pjHome === 0 && r.pjAway === 0) {
        console.warn(`[normalizeTeam] Equipo ${r.name} tiene pjHome=0 y pjAway=0:`, { rawFields: Object.keys(raw) });
    }
    [r.form, r.formHome, r.formAway].forEach((form, i) => {
        if (form && !form.match(/^[WDL]*$/)) {
            console.warn(`[normalizeTeam] Forma inválida para ${r.name} (${i === 0 ? 'form' : i === 1 ? 'formHome' : 'formAway'}):`, form);
            if (i === 0) r.form = '';
            else if (i === 1) r.formHome = r.form;
            else r.formAway = r.form;
        }
    });
    return r;
}

// BÚSQUEDA DE EQUIPO
function findTeam(leagueCode, teamName) {
    if (!teamsByLeague[leagueCode]) {
        console.warn('[findTeam] Liga no encontrada:', leagueCode);
        return { name: teamName, pjHome: 0, pjAway: 0, gfHome: 0, gaHome: 0, gfAway: 0, gaAway: 0, pos: 0, gf: 0, ga: 0, form: '' };
    }
    const team = teamsByLeague[leagueCode].find(t => normalizeName(t.name) === normalizeName(teamName));
    if (!team) {
        console.warn('[findTeam] Equipo no encontrado:', teamName, 'en liga:', leagueCode);
        return { name: teamName, pjHome: 0, pjAway: 0, gfHome: 0, gaHome: 0, gfAway: 0, gaAway: 0, pos: 0, gf: 0, ga: 0, form: '' };
    }
    return team;
}

// FUNCIÓN PARA CALCULAR FACTOR DE FORMA
function calculateFormFactor(form, isHome = false) {
    if (!form || form.length < 3) {
        console.warn('[calculateFormFactor] Forma insuficiente o vacía:', form);
        return 1.0;
    }
    const formWeight = 0.4;
    const recentGames = form.slice(-5).split('');
    const weights = [0.3, 0.25, 0.2, 0.15, 0.1].slice(-recentGames.length);
    const formScore = recentGames.reduce((score, result, index) => {
        const weight = weights[recentGames.length - 1 - index];
        if (result === 'W') return score + 1 * weight;
        if (result === 'D') return score + 0.5 * weight;
        return score;
    }, 0);
    const maxScore = weights.reduce((sum, w) => sum + w, 0);
    const formFactor = 1 + formWeight * (formScore / maxScore - 0.5);
    return Math.min(Math.max(formFactor, 0.8), 1.2);
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

// PROBABILIDADES DIXON-COLES
function dixonColesProbabilities(teamHome, teamAway, leagueCode) {
    const leagueTeams = teamsByLeague[leagueCode] || [];
    const avgGoalsHome = leagueTeams.reduce((sum, t) => sum + (t.gfHome / Math.max(t.pjHome, 1)), 0) / Math.max(leagueTeams.length, 1);
    const avgGoalsAway = leagueTeams.reduce((sum, t) => sum + (t.gfAway / Math.max(t.pjAway, 1)), 0) / Math.max(leagueTeams.length, 1);
    const homeAttack = (teamHome.gfHome / Math.max(teamHome.pjHome, 1)) / (avgGoalsHome || 1);
    const awayAttack = (teamAway.gfAway / Math.max(teamAway.pjAway, 1)) / (avgGoalsAway || 1);
    const homeDefense = (teamHome.gaHome / Math.max(teamHome.pjHome, 1)) / (avgGoalsAway || 1);
    const awayDefense = (teamAway.gaAway / Math.max(teamAway.pjAway, 1)) / (avgGoalsHome || 1);
    const homeAdvantage = 1.1;
    const lambdaHome = homeAttack * awayDefense * avgGoalsHome * homeAdvantage * calculateFormFactor(teamHome.formHome, true);
    const lambdaAway = awayAttack * homeDefense * avgGoalsAway * calculateFormFactor(teamAway.formAway, false);
    const rho = -0.1;
    let pHome = 0, pDraw = 0, pAway = 0;
    for (let i = 0; i <= 10; i++) {
        for (let j = 0; j <= 10; j++) {
            let prob = poissonProbability(lambdaHome, i) * poissonProbability(lambdaAway, j);
            if (i === 0 && j === 0) prob *= (1 - lambdaHome * lambdaAway * rho);
            else if (i === 1 && j === 1) prob *= (1 + lambdaHome * lambdaAway * rho);
            if (i > j) pHome += prob;
            else if (i === j) pDraw += prob;
            else pAway += prob;
        }
    }
    let pBTTS = 0, pO25 = 0;
    for (let i = 0; i <= 10; i++) {
        for (let j = 0; j <= 10; j++) {
            const prob = poissonProbability(lambdaHome, i) * poissonProbability(lambdaAway, j);
            if (i >= 1 && j >= 1) pBTTS += prob;
            if (i + j > 2.5) pO25 += prob;
        }
    }
    return {
        finalHome: validateProbability(pHome, 1/3),
        finalDraw: validateProbability(pDraw, 1/3),
        finalAway: validateProbability(pAway, 1/3),
        pBTTSH: validateProbability(pBTTS, 0.5),
        pO25H: validateProbability(pO25, 0.5),
        lambdaHome,
        lambdaAway
    };
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
        if (!allData.ligas || !Object.keys(allData.ligas).length) {
            throw new Error('Datos inválidos: falta "ligas" o ligas vacías.');
        }
        teamsByLeague = Object.fromEntries(
            Object.entries(allData.ligas).map(([key, value]) => {
                value.forEach(team => {
                    if (!team.form) console.warn(`[fetchAllData] Equipo ${team.name} en liga ${key} sin datos de forma`);
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
    console.log('[selectEvent] Buscando evento:', { homeTeamName, awayTeamName, ligaName, eventLeagueCode });
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
        const event = allData.calendario?.[ligaName]?.find(e =>
            normalizeName(e.local) === normalizeName(homeTeamName) && normalizeName(e.visitante) === normalizeName(awayTeamName)
        );
        console.log('[selectEvent] Evento encontrado:', event ? JSON.stringify(event, null, 2) : 'No encontrado');
        console.log('[selectEvent] Pronóstico IA:', event?.pronostico_json || event?.pronostico || 'No disponible');
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
    if (dom.suggestion) dom.suggestion.innerHTML = '<ul id="suggestion-list"><li><strong>Esperando datos...</strong></li></ul>';
    if (dom.detailedPrediction) dom.detailedPrediction.innerHTML = '<div class="ia-prediction"><p class="ia-item">Esperando pronóstico detallado...</p></div>';
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
                    <span>Puntos: ${team.points || 0}</span>
                    <span>DG: ${dgTotal >= 0 ? '+' + dgTotal : dgTotal || 0}</span>
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
                    <span>Posición: ${team.pos || '-'}</span>
                    <span>% de Victorias: ${winPct}%</span>
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

    // Calcular probabilidades para Resultados y Probabilidades (usando Dixon-Coles)
    const statsDixon = dixonColesProbabilities(tH, tA, leagueCode);
    const isLimitedData = tH.pjHome < 3 || tA.pjAway < 3;
    const probabilities = [
        { label: 'Local', value: statsDixon.finalHome, id: 'pHome', type: 'Resultado' },
        { label: 'Empate', value: statsDixon.finalDraw, id: 'pDraw', type: 'Resultado' },
        { label: 'Visitante', value: statsDixon.finalAway, id: 'pAway', type: 'Resultado' },
        { label: 'Ambos Anotan', value: statsDixon.pBTTSH, id: 'pBTTS', type: 'Mercado' },
        { label: 'Más de 2.5 goles', value: statsDixon.pO25H, id: 'pO25', type: 'Mercado' }
    ];

    // Normalizar probabilidades 1X2
    const sum1X2 = probabilities[0].value + probabilities[1].value + probabilities[2].value;
    if (sum1X2 > 0 && (sum1X2 < 0.95 || sum1X2 > 1.05)) {
        const scale = 1 / sum1X2;
        probabilities[0].value *= scale;
        probabilities[1].value *= scale;
        probabilities[2].value *= scale;
    }

    // Actualizar DOM con probabilidades (Resultados y Probabilidades)
    probabilities.forEach(p => {
        p.value = validateProbability(p.value, p.type === 'Resultado' ? 1/3 : 0.5);
        if (dom[p.id]) dom[p.id].textContent = formatPct(p.value);
        else console.warn(`[calculateAll] Elemento ${p.id} no encontrado`);
    });

    // Generar recomendaciones (Resultados y Probabilidades)
    const recommendations = probabilities.filter(p => p.value >= 0.3).sort((a, b) => b.value - a.value).slice(0, 3);
    if (dom.suggestion) {
        dom.suggestion.innerHTML = `<ul id="suggestion-list">${
            recommendations.length
                ? recommendations.map((r, i) => `<li><strong>${i + 1}. ${r.label}:</strong> ${formatPct(r.value)}</li>`).join('')
                : '<li><strong>Sin recomendaciones</strong></li>'
        }</ul>`;
    }

    // Buscar evento correspondiente
    const ligaName = leagueCodeToName[leagueCode] || '';
    const event = allData.calendario?.[ligaName]?.find(e =>
        normalizeName(e.local) === normalizeName(teamHome) && normalizeName(e.visitante) === normalizeName(teamAway)
    );

    // Generar pronóstico de IA
    let aiPrediction = null;
    if (event?.pronostico_json || event?.pronostico) {
        console.log('[calculateAll] Usando datos del evento:', JSON.stringify(event, null, 2));
        aiPrediction = event.pronostico_json || parsePlainText(event.pronostico, { local: teamHome, visitante: teamAway });
        console.log('[calculateAll] Pronóstico IA:', JSON.stringify(aiPrediction, null, 2));
        const outcomes = [
            { key: '1X2', subkey: 'victoria_local', label: `Victoria ${teamHome}`, prob: aiPrediction['1X2'].victoria_local.probabilidad, just: aiPrediction['1X2'].victoria_local.justificacion },
            { key: '1X2', subkey: 'empate', label: 'Empate', prob: aiPrediction['1X2'].empate.probabilidad, just: aiPrediction['1X2'].empate.justificacion },
            { key: '1X2', subkey: 'victoria_visitante', label: `Victoria ${teamAway}`, prob: aiPrediction['1X2'].victoria_visitante.probabilidad, just: aiPrediction['1X2'].victoria_visitante.justificacion },
            { key: 'BTTS', subkey: 'si', label: 'Ambos Anotan - Sí', prob: aiPrediction['BTTS'].si.probabilidad, just: aiPrediction['BTTS'].si.justificacion || 'No disponible' },
            { key: 'BTTS', subkey: 'no', label: 'Ambos Anotan - No', prob: aiPrediction['BTTS'].no.probabilidad, just: aiPrediction['BTTS'].no.justificacion || 'No disponible' },
            { key: 'Goles', subkey: 'mas_2_5', label: 'Más de 2.5 Goles', prob: aiPrediction['Goles'].mas_2_5.probabilidad, just: aiPrediction['Goles'].mas_2_5.justificacion || 'No disponible' },
            { key: 'Goles', subkey: 'menos_2_5', label: 'Menos de 2.5 Goles', prob: aiPrediction['Goles'].menos_2_5.probabilidad, just: aiPrediction['Goles'].menos_2_5.justificacion || 'No disponible' }
        ];
        if (dom.detailedPrediction) {
            dom.detailedPrediction.innerHTML = `
                <div class="ia-prediction">
                    <div class="stat-section">
                        <span class="section-title">Análisis 1X2</span>
                        <p class="ia-item"><strong>Victoria ${teamHome} (${aiPrediction['1X2'].victoria_local.probabilidad}):</strong> ${aiPrediction['1X2'].victoria_local.justificacion || 'No disponible'}</p>
                        <p class="ia-item"><strong>Empate (${aiPrediction['1X2'].empate.probabilidad}):</strong> ${aiPrediction['1X2'].empate.justificacion || 'No disponible'}</p>
                        <p class="ia-item"><strong>Victoria ${teamAway} (${aiPrediction['1X2'].victoria_visitante.probabilidad}):</strong> ${aiPrediction['1X2'].victoria_visitante.justificacion || 'No disponible'}</p>
                    </div>
                    <div class="stat-section">
                        <span class="section-title">Ambos Anotan</span>
                        <p class="ia-item"><strong>Sí (${aiPrediction['BTTS'].si.probabilidad}):</strong> ${aiPrediction['BTTS'].si.justificacion || 'No disponible'}</p>
                        <p class="ia-item"><strong>No (${aiPrediction['BTTS'].no.probabilidad}):</strong> ${aiPrediction['BTTS'].no.justificacion || 'No disponible'}</p>
                    </div>
                    <div class="stat-section">
                        <span class="section-title">Goles</span>
                        <p class="ia-item"><strong>Más de 2.5 (${aiPrediction['Goles'].mas_2_5.probabilidad}):</strong> ${aiPrediction['Goles'].mas_2_5.justificacion || 'No disponible'}</p>
                        <p class="ia-item"><strong>Menos de 2.5 (${aiPrediction['Goles'].menos_2_5.probabilidad}):</strong> ${aiPrediction['Goles'].menos_2_5.justificacion || 'No disponible'}</p>
                    </div>
                </div>
            `;
        }
        if (dom.combinedPrediction) {
            const bestOutcome = outcomes.filter(o => o.prob.replace('%', '') >= 50).sort((a, b) => parseFloat(b.prob) - parseFloat(a.prob))[0];
            dom.combinedPrediction.innerHTML = bestOutcome
                ? `<p><strong>Pronóstico Combinado:</strong> ${bestOutcome.label} (${bestOutcome.prob}) - ${bestOutcome.just}</p>`
                : `<p><strong>Pronóstico Combinado:</strong> Sin pronósticos claros disponibles.</p>`;
        }
    } else {
        console.warn('[calculateAll] No se encontró pronóstico IA para el evento');
        if (dom.detailedPrediction) {
            dom.detailedPrediction.innerHTML = `
                <div class="ia-prediction">
                    <div class="stat-section">
                        <span class="section-title">Análisis 1X2</span>
                        <p class="ia-item"><strong>Victoria ${teamHome} (${formatPct(statsDixon.finalHome)}):</strong> Basado en estadísticas, ${teamHome} tiene ventaja en casa.</p>
                        <p class="ia-item"><strong>Empate (${formatPct(statsDixon.finalDraw)}):</strong> Posible empate debido a la forma reciente.</p>
                        <p class="ia-item"><strong>Victoria ${teamAway} (${formatPct(statsDixon.finalAway)}):</strong> ${teamAway} podría sorprender como visitante.</p>
                    </div>
                    <div class="stat-section">
                        <span class="section-title">Ambos Anotan</span>
                        <p class="ia-item"><strong>Sí (${formatPct(statsDixon.pBTTSH)}):</strong> Ambos equipos tienen capacidad ofensiva.</p>
                        <p class="ia-item"><strong>No (${formatPct(1 - statsDixon.pBTTSH)}):</strong> Alguno podría no anotar.</p>
                    </div>
                    <div class="stat-section">
                        <span class="section-title">Goles</span>
                        <p class="ia-item"><strong>Más de 2.5 (${formatPct(statsDixon.pO25H)}):</strong> Alta probabilidad de un partido con goles.</p>
                        <p class="ia-item"><strong>Menos de 2.5 (${formatPct(1 - statsDixon.pO25H)}):</strong> Posible partido cerrado.</p>
                    </div>
                </div>
            `;
        }
        if (dom.combinedPrediction) {
            dom.combinedPrediction.innerHTML = `<p><strong>Pronóstico Combinado:</strong> No hay datos suficientes para un pronóstico combinado.</p>`;
        }
    }

    if (isLimitedData && dom.details) {
        dom.details.innerHTML = `<div class="warning"><strong>Advertencia:</strong> Datos limitados (${tH.pjHome} partidos locales, ${tA.pjAway} partidos visitantes). Los cálculos pueden ser imprecisos.</div>`;
    } else if (dom.details) {
        dom.details.innerHTML = `<div class="info"><strong>Información:</strong> Cálculos completados para ${teamHome} vs ${teamAway}.</div>`;
    }
}

// INICIAR
init();
