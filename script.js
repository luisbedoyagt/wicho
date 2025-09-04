voy de nuevo, espera y te explico mejor, responde en español

tengo este codigo el cual quiero eliminar los espacios para que el codigo sea mas pequelo pero siempre dividiendo cada funcion con su comentario en //

const $ = id => {
    const element = document.getElementById(id);
    if (!element) console.error(`[Utilidades] Elemento con ID ${id} no encontrado en el DOM`);
    return element;
};

const formatPct = x => (100 * (isFinite(x) ? x : 0)).toFixed(1) + '%';
const formatDec = x => (isFinite(x) ? x.toFixed(2) : '0.00');

const parseNumberString = val => {
    if (val === null || val === undefined) return 0;
    // Accept numbers, "1,234.5", "1.234,5" etc. Replace commas intelligently:
    const s = String(val).trim().replace(/\s+/g, '');
    // If there's a comma and dot, assume comma is thousand separator: remove commas
    if ((s.match(/\./g) || []).length > 0 && (s.match(/,/g) || []).length > 0) {
        return Number(s.replace(/,/g, '')) || 0;
    }
    // If only commas, treat them as decimals
    if ((s.match(/,/g) || []).length > 0 && (s.match(/\./g) || []).length === 0) {
        return Number(s.replace(/,/g, '.')) || 0;
    }
    // default parse
    const n = Number(s);
    return isFinite(n) ? n : 0;
};

const normalizeStr = s => (String(s || '')).toLowerCase().replace(/[^a-z0-9áéíóúüñÀ-ÖØ-öø-ÿ]+/g, '');
// Poisson util

function factorial(n) {
    if (n < 0) return 1;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

function poissonProbability(lambda, k) {
    if (!isFinite(lambda) || lambda <= 0) return k === 0 ? 1 : 0;
    if (k < 0) return 0;
    // Use exp and pow and factorial; safe for our small k range (0..10)
    return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

// CONFIGURACIÓN DE LIGAS
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzcrFrU34kJS0cjAq0YfUTU1XTfGUuEnBfohYJaljkcxRqlfa879ALvWsYHy7E8UVp0/exec";
let teamsByLeague = {};
let allData = {};
let currentEventPage = 0;
let eventInterval;

const leagueNames = {
    "fifa.worldq.conmebol": "Eliminatorias CONMEBOL",
    "fifa.worldq.concacaf": "Eliminatorias CONCACAF",
    "fifa.worldq.uefa": "Eliminatorias UEFA"
};

const leagueCodeToName = {
    "fifa.worldq.conmebol": "Eliminatorias_CONMEBOL",
    "fifa.worldq.concacaf": "Eliminatorias_CONCACAF",
    "fifa.worldq.uefa": "Eliminatorias_UEFA"
};

const leagueRegions = {
    "fifa.worldq.conmebol": "Eliminatorias Mundiales",
    "fifa.worldq.concacaf": "Eliminatorias Mundiales",
    "fifa.worldq.uefa": "Eliminatorias Mundiales"
};
// NORMALIZACIÓN DE DATOS
function normalizeTeam(raw) {
    if (!raw) return null;
    const r = {};
    // Name fallbacks
    r.name = raw.name || raw.team_name || raw.team || raw.club || '';
    if (!r.name) return null;

    r.pos = parseNumberString(raw.rank ?? raw.position ?? raw.pos ?? raw.position_in_table ?? 0);
    r.gf = parseNumberString(raw.goalsFor ?? raw.goals_for ?? raw.gf ?? raw.gf_total ?? 0);
    r.ga = parseNumberString(raw.goalsAgainst ?? raw.goals_against ?? raw.ga ?? raw.ga_total ?? 0);
    r.pj = parseNumberString(raw.gamesPlayed ?? raw.played ?? raw.pj ?? raw.games ?? 0);
    r.g = parseNumberString(raw.wins ?? raw.win ?? raw.g ?? raw.w ?? 0);
    r.e = parseNumberString(raw.ties ?? raw.draws ?? raw.d ?? raw.e ?? 0);
    r.p = parseNumberString(raw.losses ?? raw.lose ?? raw.l ?? 0);
    r.points = parseNumberString(raw.points ?? raw.pts ?? (r.g * 3 + r.e) ?? 0);
    r.gfHome = parseNumberString(raw.goalsForHome ?? raw.goals_for_home ?? raw.gfHome ?? 0);
    r.gfAway = parseNumberString(raw.goalsForAway ?? raw.goals_for_away ?? raw.gfAway ?? 0);
    r.gaHome = parseNumberString(raw.goalsAgainstHome ?? raw.goals_against_home ?? raw.gaHome ?? 0);
    r.gaAway = parseNumberString(raw.goalsAgainstAway ?? raw.goals_against_away ?? raw.gaAway ?? 0);
    r.pjHome = parseNumberString(raw.gamesPlayedHome ?? raw.played_home ?? raw.pjHome ?? 0);
    r.pjAway = parseNumberString(raw.gamesPlayedAway ?? raw.played_away ?? raw.pjAway ?? 0);
    r.winsHome = parseNumberString(raw.winsHome ?? raw.win_home ?? raw.home_wins ?? 0);
    r.winsAway = parseNumberString(raw.winsAway ?? raw.win_away ?? raw.away_wins ?? 0);
    r.tiesHome = parseNumberString(raw.tiesHome ?? raw.drawsHome ?? 0);
    r.tiesAway = parseNumberString(raw.tiesAway ?? raw.drawsAway ?? 0);
    r.lossesHome = parseNumberString(raw.lossesHome ?? raw.losesHome ?? 0);
    r.lossesAway = parseNumberString(raw.lossesAway ?? raw.losesAway ?? 0);
    r.logoUrl = raw.logoUrl || raw.logo || raw.badge || raw.team_logo || '';
    // Some APIs have lowercase keys
    r.rank = r.pos;
    return r;
}
// PARSEO DE PRONÓSTICO DE TEXTO PLANO (RESPALDO)
function parsePlainText(text, matchData = { local: '', visitante: '' }) {
    // Defensive: ensure string
    text = String(text || '');

    console.log(`[parsePlainText] Procesando texto para ${matchData.local} vs ${matchData.visitante}`);

    const aiProbs = { home: null, draw: null, away: null };
    const aiJustification = {
        home: "Sin justificación detallada.",
        draw: "Sin justificación detallada.",
        away: "Sin justificación detallada."
    };
    // Try multiple patterns to extract a probabilities block
    // Patterns to try: "Probabilidades:", "Probabilidades 1X2", "Prob 1X2", "1X2:"
    const probBlockPatterns = [/Probabilidades(?:\\s*1X2)?\\s*:\\s*([\\s\\S]*?)(?:BTTS|Análisis|$)/i,
                               [/1X2\\s*[:\\-]\\s*([\\s\\S]*?)(?:BTTS|Análisis|$)/i,
                               [/Prob\\.?\\s*1X2[\\s\\-:]*([\\s\\S]*?)(?:BTTS|Análisis|$)/i]];

    let probsText = null;
    for (const p of probBlockPatterns) {
        const m = text.match(p);
        if (m && m[1]) {
            probsText = m[1];
            break;
        }
    }
    if (!probsText) {
        // fallback: look for any sequence of percentages near each other in the whole text
        const allPerc = (text.match(/(\\d+(?:\\.\\d+)?)%/g) || []).map(x => x.replace('%', ''));
        if (allPerc.length >= 3) {
            aiProbs.home = parseFloat(allPerc[0]) / 100;
            aiProbs.draw = parseFloat(allPerc[1]) / 100;
            aiProbs.away = parseFloat(allPerc[2]) / 100;
            console.log('[parsePlainText] Probabilidades extraídas por fallback de porcentajes sueltos');
        } else {
            console.warn('[parsePlainText] No se encontró bloque de probabilidades, ni suficientes porcentajes en texto');
        }
    } else {
        // find percentages in the probsText
        const percentages = (probsText.match(/(\\d+(?:\\.\\d+)?)%/g) || []).map(p => parseFloat(p.replace('%', '')));
        // Sometimes it is like "Local 45% / X 30% / Visitante 25%", or "1: 45% X:30% 2:25%"
        if (percentages.length >= 3) {
            aiProbs.home = percentages[0] / 100;
            aiProbs.draw = percentages[1] / 100;
            aiProbs.away = percentages[2] / 100;
            console.log(`[parsePlainText] Probabilidades extraídas: Local=${aiProbs.home}, Empate=${aiProbs.draw}, Visitante=${aiProbs.away}`);
        } else {
            // Try labeled matches
            const labelMatch = probsText.match(/(?:Local|1|Casa)[:\\s]*?(\\d+(?:\\.\\d+)?)%[\\s\\S]*?(?:Empate|X|Draw)[:\\s]*?(\\d+(?:\\.\\d+)?)%[\\s\\S]*?(?:Visitante|2|Fuera)[:\\s]*?(\\d+(?:\\.\\d+)?)%/i);
            if (labelMatch) {
                aiProbs.home = parseFloat(labelMatch[1]) / 100;
                aiProbs.draw = parseFloat(labelMatch[2]) / 100;
                aiProbs.away = parseFloat(labelMatch[3]) / 100;
            } else {
                console.warn('[parsePlainText] No se detectaron 3 porcentajes en la sección de probabilidades:', probsText);
            }
        }
    }
    // Extract justifications - try to find analysis block
    const analysisPatterns = [/Análisis del Partido:\\s*([\\s\\S]*?)(?:Probabilidades|$)/i,
                              [/Análisis:\\s*([\\s\\S]*?)(?:Probabilidades|$)/i,
                              [/Razones:\\s*([\\s\\S]*?)(?:Probabilidades|$)/i]];
    let analysisText = null;
    for (const p of analysisPatterns) {
        const m = text.match(p);
        if (m && m[1]) {
            analysisText = m[1].trim();
            break;
        }
    }
    if (analysisText) {
        // Try to split by team labels or by lines
        // e.g. "Barcelona: ... Empate: ... Real Madrid: ..."
        const localRegex = new RegExp(`${escapeRegex(matchData.local || '')}[:\\-\\s]*([\\s\\S]*?)(?:Empate[:\\-\\s]|${escapeRegex(matchData.visitante || '')}[:\\-\\s]|$)`, 'i');
        const drawRegex = /Empate[:\-\s]*([\s\S]*?)(?:(?:[^:]+:)|$)/i;
        const awayRegex = new RegExp(`${escapeRegex(matchData.visitante || '')}[:\\-\\s]*([\\s\\S]*?)(?:Probabilidades|$)`, 'i');

        const localJust = analysisText.match(localRegex);
        const drawJust = analysisText.match(drawRegex);
        const awayJust = analysisText.match(awayRegex);

        if (localJust && localJust[1]) aiJustification.home = localJust[1].trim();
        if (drawJust && drawJust[1]) aiJustification.draw = drawJust[1].trim();
        if (awayJust && awayJust[1]) aiJustification.away = awayJust[1].trim();

        console.log('[parsePlainText] Justificaciones extraídas (posiblemente parciales):', aiJustification);
    } else {
        console.warn('[parsePlainText] No se encontró sección de análisis en el texto');
    }
    // BTTS
    const bttsMatch = text.match(/BTTS\\s*(?:[:\\-])?\\s*(?:Si|Sí|Yes|S):?\\s*(\\d+(?:\\.\\d+)?)%/i)
                   || text.match(/Both\\s*Teams\\s*To\\s*Score\\s*(?:[:\\-])?\\s*(\\d+(?:\\.\\d+)?)%/i);
    const bttsNoMatch = text.match(/BTTS\\s*(?:[:\\-])?\\s*(?:No):?\\s*(\\d+(?:\\.\\d+)?)%/i);

    // Goles >2.5 / <2.5
    const over25 = text.match(/(?:Mas|Más|Over)\\s*2\\.?5[:\\-\\s\\(]*?(\\d+(?:\\.\\d+)?)%/i)
                 || text.match(/(\\d+(?:\\.\\d+)?)%\\s*(?:over|más|mas)\\s*2\\.?5/i);
    const under25 = text.match(/(?:Menos|Under)\\s*2\\.?5[:\\-\\s\\(]*?(\\d+(?:\\.\\d+)?)%/i)
                  || text.match(/(\\d+(?:\\.\\d+)?)%\\s*(?:under|menos)\\s*2\\.?5/i);

    const result = {
        "1X2": {
            victoria_local: {
                probabilidad: aiProbs.home !== null ? (aiProbs.home * 100).toFixed(0) + '%' : 'N/D',
                justificacion: aiJustification.home
            },
            empate: {
                probabilidad: aiProbs.draw !== null ? (aiProbs.draw * 100).toFixed(0) + '%' : 'N/D',
                justificacion: aiJustification.draw
            },
            victoria_visitante: {
                probabilidad: aiProbs.away !== null ? (aiProbs.away * 100).toFixed(0) + '%' : 'N/D',
                justificacion: aiJustification.away
            }
        },
        "BTTS": {
            si: {
                probabilidad: bttsMatch ? (parseFloat(bttsMatch[1]).toFixed(0) + '%') : 'N/D',
                justificacion: ""
            },
            no: {
                probabilidad: bttsNoMatch ? (parseFloat(bttsNoMatch[1]).toFixed(0) + '%') : 'N/D',
                justificacion: ""
            }
        },
        "Goles": {
            mas_2_5: {
                probabilidad: over25 ? (parseFloat(over25[1]).toFixed(0) + '%') : 'N/D',
                justificacion: ""
            },
            menos_2_5: {
                probabilidad: under25 ? (parseFloat(under25[1]).toFixed(0) + '%') : 'N/D',
                justificacion: ""
            }
        }
    };

    console.log('[parsePlainText] Resultado final:', result);
    return result;
}

function escapeRegex(s) {
    if (!s) return '';
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ----------------------
// FETCH DATOS COMPLETOS
// ----------------------
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

        // Validate
        if (!allData || (!allData.calendario && !allData.ligas)) {
            throw new Error('Estructura de datos inválida: la respuesta está vacía o faltan "calendario" o "ligas".');
        }

        // Normalize teams: the API might give ligas mapping in keys different from our league codes,
        // so we'll attempt to create teamsByLeague for our expected league codes, but also include any
        // other keys present.
        const normalized = {};
        const sourceLigas = allData.ligas || {};

        for (const key in sourceLigas) {
            if (!Object.prototype.hasOwnProperty.call(sourceLigas, key)) continue;
            const arr = Array.isArray(sourceLigas[key]) ? sourceLigas[key] : [];
            normalized[key] = arr.map(normalizeTeam).filter(t => t && t.name);
            console.log(`[fetchAllData] Liga fuente ${key} normalizada con ${normalized[key].length} equipos`);
        }

        // Also try to map our known league codes using leagueCodeToName to calendario mapping
        // If the API provides 'ligas' keyed by leagueName (like "España_LaLiga"), we need to
        // flatten and allow lookup by either code or by name.
        // To be safe, make an alias lookup: lowercased name => data
        const alias = {};
        for (const key in normalized) {
            alias[key.toLowerCase()] = normalized[key];
            alias[(key.replace(/\s+/g, '').toLowerCase())] = normalized[key];
        }
        // Try map known codes
        for (const code in leagueCodeToName) {
            const nameKey = leagueCodeToName[code];
            if (normalized[code] && normalized[code].length) {
                teamsByLeague[code] = normalized[code];
            } else if (normalized[nameKey] && normalized[nameKey].length) {
                teamsByLeague[code] = normalized[nameKey];
            } else if (allData.ligas && allData.ligas[nameKey] && Array.isArray(allData.ligas[nameKey])) {
                teamsByLeague[code] = allData.ligas[nameKey].map(normalizeTeam).filter(Boolean);
            } else if (alias[nameKey.toLowerCase()]) {
                teamsByLeague[code] = alias[nameKey.toLowerCase()];
            } else if (alias[code.toLowerCase()]) {
                teamsByLeague[code] = alias[code.toLowerCase()];
            } else {
                // As fallback, if there's any league in normalized, pick a similar one by partial match
                // (not ideal but better than empty)
                const fallback = Object.keys(normalized).find(k => k.toLowerCase().includes(code.split('.')[0]));
                if (fallback) teamsByLeague[code] = normalized[fallback];
            }
            if (!teamsByLeague[code]) teamsByLeague[code] = [];
            console.log(`[fetchAllData] teamsByLeague[${code}] tiene ${teamsByLeague[code].length} equipos`);
        }

        // persist
        try {
            localStorage.setItem('allData', JSON.stringify(allData));
            console.log('[fetchAllData] Datos almacenados en localStorage');
        } catch (e) {
            console.warn('[fetchAllData] No se pudo guardar en localStorage:', e.message);
        }

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

// ----------------------
// MUESTRA DE EVENTOS DE LA LIGA SELECCIONADA
// ----------------------
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

    const ligaName = leagueCodeToName[leagueCode] || leagueCode;
    // Support calendars keyed both by our league name and by code
    const events = allData.calendario[ligaName] || allData.calendario[leagueCode] || allData.calendario[leagueCodeToName[leagueCode]] || [];

    if (!Array.isArray(events) || events.length === 0) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos para esta liga.</span></div>';
        console.log(`[displaySelectedLeagueEvents] No hay eventos para ${ligaName} (clave: ${leagueCode})`);
        return;
    }

    // Filter and sanitize events: ensure fecha parsable and teams present
    const sanitizedEvents = events.map(ev => {
        // Some rows might have pronostico_json as string; attempt safe parse
        try {
            if (ev && ev.pronostico_json && typeof ev.pronostico_json === 'string') {
                ev.pronostico_json = JSON.parse(ev.pronostico_json);
            }
        } catch (e) {
            // leave as-is if parse fails
        }
        return ev;
    }).filter(ev => ev && (ev.local || ev.home || ev.team_home) && (ev.visitante || ev.away || ev.team_away));

    if (sanitizedEvents.length === 0) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos con datos válidos.</span></div>';
        return;
    }

    const eventsPerPage = 3;
    const totalPages = Math.ceil(sanitizedEvents.length / eventsPerPage);
    let currentPage = 0;

    function parseEventDateString(dateStr) {
        if (!dateStr) return null;
        // Accept many formats: if looks ISO-ish, make it ISO; else try common scnearios.
        let s = String(dateStr).trim();
        // If already contains T or Z, try direct parse
        if (s.includes('T') || s.endsWith('Z') || s.includes('+')) {
            const d = new Date(s);
            if (!isNaN(d.getTime())) return d;
        }
        // Replace space between date and time with T and add Z if no timezone
        if (/\d{4}[-\/]\d{2}[-\/]\d{2}/.test(s) && /\d{1,2}:\d{2}/.test(s)) {
            // Normalize separators
            s = s.replace(' ', 'T');
            if (!s.toLowerCase().includes('z') && !/[+-]\d{2}:?\d{2}/.test(s)) {
                s += 'Z';
            }
            const d = new Date(s);
            if (!isNaN(d.getTime())) return d;
        }
        // If format like "DD/MM/YYYY HH:MM" convert to ISO
        const parts = s.match(/(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})\\s+(\\d{1,2}:\\d{2})/);
        if (parts) {
            const iso = `${parts[3]}-${String(parts[2]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}T${parts[4]}Z`;
            const d = new Date(iso);
            if (!isNaN(d.getTime())) return d;
        }
        // Last resort: Date.parse
        const fallback = new Date(s);
        if (!isNaN(fallback.getTime())) return fallback;
        return null;
    }

    function showCurrentPage() {
        const startIndex = currentPage * eventsPerPage;
        const eventsToShow = sanitizedEvents.slice(startIndex, startIndex + eventsPerPage);

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

                const localName = event.local || event.home || event.team_home || 'Local';
                const awayName = event.visitante || event.away || event.team_away || 'Visitante';
                div.dataset.homeTeam = localName;
                div.dataset.awayTeam = awayName;

                let eventDateTime;
                let isInProgress = false;
                try {
                    const parsedDate = parseEventDateString(event.fecha || event.date || event.datetime || '');
                    if (!parsedDate) throw new Error("Fecha inválida");
                    const now = new Date();
                    const matchDuration = 120 * 60 * 1000; // 2 horas por defecto
                    if (now >= parsedDate && now < new Date(parsedDate.getTime() + matchDuration)) {
                        isInProgress = true;
                    }
                    // Format using user's tz: America/Guatemala
                    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Guatemala' };
                    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guatemala' };
                    const formattedDate = parsedDate.toLocaleDateString('es-ES', dateOptions);
                    const formattedTime = parsedDate.toLocaleTimeString('es-ES', timeOptions);
                    eventDateTime = `${formattedDate} ${formattedTime} (GT)`;
                } catch (err) {
                    console.warn(`[displaySelectedLeagueEvents] Error parseando fecha para el evento: ${localName} vs. ${awayName}`, err);
                    eventDateTime = `${event.fecha || event.date || 'Fecha no disponible'} (Hora no disponible)`;
                }

                let statusText = isInProgress ? ' - Evento en Juego' : '';
                div.innerHTML = `
                    <strong>${localName} vs. ${awayName}</strong>
                    <span>Estadio: ${event.estadio || event.stadium || 'Por confirmar'}</span>
                    <span>${eventDateTime}${statusText}</span>
                `;

                if (isInProgress) {
                    div.classList.add('in-progress');
                    div.style.cursor = 'not-allowed';
                    div.title = 'Evento en curso, no seleccionable';
                } else {
                    div.addEventListener('click', () => {
                        selectEvent(localName, awayName);
                    });
                }

                selectedEventsList.appendChild(div);
            });

            currentPage = (currentPage + 1) % totalPages;

        }, 500);
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

    await fetchAllData();

    console.log('[init] Ligas recibidas en allData.ligas:', allData.ligas ? Object.keys(allData.ligas) : 'ninguna');

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

    // Agrupar las ligas por región
    const regionsMap = {};
    Object.keys(leagueCodeToName).forEach(code => {
        const region = leagueRegions[code] || 'Otras Ligas';
        if (!regionsMap[region]) regionsMap[region] = [];
        regionsMap[region].push(code);
    });
    console.log('[init] Regiones mapeadas (basado en leagueCodeToName):', regionsMap);

    // Ordenar regiones con custom order
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

    // Llenar el select con opciones agrupadas
    sortedRegions.forEach(regionName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = regionName;

        const codes = regionsMap[regionName].slice().sort((a, b) => {
            const aName = leagueNames[a] || a;
            const bName = leagueNames[b] || b;
            return aName.localeCompare(bName);
        });

        codes.forEach(code => {
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

    const resetButton = $('reset');
    if (resetButton) {
        resetButton.addEventListener('click', clearAll);
    } else {
        console.warn('[init] Botón reset no encontrado');
    }
}
document.addEventListener('DOMContentLoaded', init);

// ----------------------
// FUNCIONES AUXILIARES DE UI
// ----------------------
function onLeagueChange() {
    const code = $('leagueSelect').value;
    console.log('[onLeagueChange] Liga seleccionada:', code);
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');

    if (!teamHomeSelect || !teamAwaySelect) {
        console.error('[onLeagueChange] Elementos teamHome o teamAway no encontrados');
        return;
    }

    teamHomeSelect.innerHTML = '<option value="">Cargando equipos...</option>';
    teamAwaySelect.innerHTML = '<option value="">Cargando equipos...</option>';

    if (!code || !teamsByLeague[code] || teamsByLeague[code].length === 0) {
        clearTeamData('Home');
        clearTeamData('Away');
        const details = $('details');
        if (details) {
            details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> No hay datos disponibles para esta liga.</div>';
        }
        console.log('[onLeagueChange] Sin datos para la liga:', code);
        displaySelectedLeagueEvents('');
        return;
    }

    // Sort teams by name and fill selects
    const teams = teamsByLeague[code].slice().sort((a, b) => a.name.localeCompare(b.name));

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

    // Try to find options using normalized names (case/space insensitive)
    const homeOption = Array.from(teamHomeSelect.options).find(opt => normalizeStr(opt.text) === normalizeStr(homeTeamName));
    if (homeOption) {
        teamHomeSelect.value = homeOption.value;
    } else {
        // Try contains match as fallback
        const partial = Array.from(teamHomeSelect.options).find(opt => normalizeStr(opt.text).includes(normalizeStr(homeTeamName)) || normalizeStr(homeTeamName).includes(normalizeStr(opt.text)));
        if (partial) teamHomeSelect.value = partial.value;
    }

    const awayOption = Array.from(teamAwaySelect.options).find(opt => normalizeStr(opt.text) === normalizeStr(awayTeamName));
    if (awayOption) {
        teamAwaySelect.value = awayOption.value;
    } else {
        const partial = Array.from(teamAwaySelect.options).find(opt => normalizeStr(opt.text).includes(normalizeStr(awayTeamName)) || normalizeStr(awayTeamName).includes(normalizeStr(opt.text)));
        if (partial) teamAwaySelect.value = partial.value;
    }

    if (teamHomeSelect.value && teamAwaySelect.value) {
        fillTeamData(teamHomeSelect.value, leagueCode, 'Home');
        fillTeamData(teamAwaySelect.value, leagueCode, 'Away');
        calculateAll();
    } else {
        const details = $('details');
        if (details) {
            details.innerHTML = `<div class="error"><strong>Error:</strong> No se pudo encontrar uno o ambos equipos en la lista de la liga.</div>`;
        }
        console.error('[selectEvent] Equipos no encontrados (exact match failed):', homeTeamName, awayTeamName);
    }
}

function restrictSameTeam() {
    const teamHome = $('teamHome')?.value;
    const teamAway = $('teamAway')?.value;
    if (teamHome && teamAway && teamHome === teamAway) {
        const details = $('details');
        if (details) {
            details.innerHTML = '<div class="error"><strong>Error:</strong> No puedes seleccionar el mismo equipo para local y visitante.</div>';
        }
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

    const posEl = $(`pos${type}`);
    if (posEl) posEl.textContent = '--';
    const gfEl = $(`gf${type}`);
    if (gfEl) gfEl.textContent = '--';
    const gaEl = $(`ga${type}`);
    if (gaEl) gaEl.textContent = '--';
    const winEl = $(`winRate${type}`);
    if (winEl) winEl.textContent = '--';

    const box = $(`form${type}Box`);
    if (box) {
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
    }

    const cardHeader = $(`card-${typeLower}`)?.querySelector('.card-header');
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
    const detailedPrediction = $('detailed-prediction');
    if (detailedPrediction) {
        detailedPrediction.innerHTML = '<p>Esperando pronóstico detallado...</p>';
    }
    const details = $('details');
    if (details) {
        details.innerHTML = 'Detalles del Pronóstico';
    }
    const suggestion = $('suggestion');
    if (suggestion) {
        suggestion.innerHTML = '<p>Esperando datos...</p>';
    }
    const combinedPrediction = $('combined-prediction');
    if (combinedPrediction) {
        combinedPrediction.innerHTML = '<p>Esperando pronóstico combinado...</p>';
    }

    clearTeamData('Home');
    clearTeamData('Away');
    displaySelectedLeagueEvents('');
}

// ----------------------
// BÚSQUEDA Y LLENADO DE EQUIPO
// ----------------------
function findTeam(leagueCode, teamName) {
    if (!teamsByLeague[leagueCode]) return null;
    // Try exact normalized match, then partial contains match
    const list = teamsByLeague[leagueCode];
    const normalizedName = normalizeStr(teamName);
    let found = list.find(t => normalizeStr(t.name) === normalizedName);
    if (!found) {
        found = list.find(t => normalizeStr(t.name).includes(normalizedName) || normalizedName.includes(normalizeStr(t.name)));
    }
    return found || null;
}

function fillTeamData(teamName, leagueCode, type) {
    const t = findTeam(leagueCode, teamName);
    const typeLower = type.toLowerCase();

    if (!t) {
        console.error(`[fillTeamData] Equipo no encontrado: ${teamName} en liga ${leagueCode}`);
        const details = $('details');
        if (details) {
            details.innerHTML = `<div class="error"><strong>Error:</strong> Equipo ${teamName} no encontrado en la liga seleccionada.</div>`;
        }
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
    }

    const cardHeader = $(`card-${typeLower}`)?.querySelector('.card-header');
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

    const teams = teamsByLeague[league] || [];
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

    // Avoid division by zero - if totals are zero, use league averages from teams where possible
    const denomGames = totalGames || teams.reduce((s, x) => s + (x.pj || 0), 0) || 1;
    const leagueAvgGfHome = totalGfHome / denomGames || 1;
    const leagueAvgGaAway = totalGaAway / denomGames || 1;
    const leagueAvgGfAway = totalGfAway / denomGames || 1;
    const leagueAvgGaHome = totalGaHome / denomGames || 1;

    const safeDiv = (num, den) => den ? num / den : 0;

    const homeAttackRaw = safeDiv(tH.gfHome || 0, tH.pjHome || 1);
    const homeDefenseRaw = safeDiv(tH.gaHome || 0, tH.pjHome || 1);
    const awayAttackRaw = safeDiv(tA.gfAway || 0, tA.pjAway || 1);
    const awayDefenseRaw = safeDiv(tA.gaAway || 0, tA.pjAway || 1);

    const homeAttack = (homeAttackRaw / (leagueAvgGfHome || 1)) * shrinkageFactor;
    const homeDefense = (homeDefenseRaw / (leagueAvgGaHome || 1)) * shrinkageFactor;
    const awayAttack = (awayAttackRaw / (leagueAvgGfAway || 1)) * shrinkageFactor;
    const awayDefense = (awayDefenseRaw / (leagueAvgGaAway || 1)) * shrinkageFactor;

    const expectedHomeGoals = homeAttack * awayDefense * leagueAvgGfHome;
    const expectedAwayGoals = awayAttack * homeDefense * leagueAvgGfAway;

    let homeWin = 0, draw = 0, awayWin = 0;
    // Sum probabilities for reasonable score range
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
        adjustedDraw += poissonProbability(expectedHomeGoals, i) * poissonProbability(expectedAwayGoals, i) * tau(i, i);
    }

    // Normalize statistic probabilities
    const total = homeWin + draw + awayWin;
    if (total > 0) {
        const scale = 1 / total;
        homeWin *= scale;
        draw *= scale;
        awayWin *= scale;
    } else {
        // If total == 0 fallback to equal probabilities
        homeWin = draw = awayWin = 1 / 3;
    }

    const adjustedTotal = homeWin + adjustedDraw + awayWin;
    if (adjustedTotal > 0) {
        const scale = 1 / adjustedTotal;
        homeWin *= scale;
        adjustedDraw *= scale;
        awayWin *= scale;
    }

    // BTTS probability estimation (approx)
    const pGoal0Home = poissonProbability(expectedHomeGoals, 0);
    const pGoal0Away = poissonProbability(expectedAwayGoals, 0);
    const pBTTSH = 1 - pGoal0Home - pGoal0Away + (pGoal0Home * pGoal0Away);

    // Over 2.5 approx: 1 - P(totalGoals <= 2)
    const sumUpTo2Home = poissonProbability(expectedHomeGoals, 0) + poissonProbability(expectedHomeGoals, 1) + poissonProbability(expectedHomeGoals, 2);
    const sumUpTo2Away = poissonProbability(expectedAwayGoals, 0) + poissonProbability(expectedAwayGoals, 1) + poissonProbability(expectedAwayGoals, 2);
    const pO25H = 1 - (sumUpTo2Home * sumUpTo2Away);

    return {
        finalHome: homeWin,
        finalDraw: adjustedDraw,
        finalAway: awayWin,
        pBTTSH,
        pO25H
    };
}

// ----------------------
// COMBINACIÓN DE PRONÓSTICOS
// ----------------------
function getCombinedPrediction(stats, event, matchData) {
    const combined = {};
    // event.pronostico_json could be object or string or undefined
    let ai = null;
    try {
        if (event && event.pronostico_json) {
            ai = typeof event.pronostico_json === 'string' ? JSON.parse(event.pronostico_json) : event.pronostico_json;
        } else if (event && event.pronostico) {
            ai = parsePlainText(event.pronostico || '', matchData);
            // Wrap ai into same structure expected later
            ai = {
                "1X2": {
                    victoria_local: { probabilidad: ai["1X2"]?.victoria_local?.probabilidad || ai["1X2"]?.victoria_local || 'N/D', justificacion: ai["1X2"]?.victoria_local?.justificacion || '' },
                    empate: { probabilidad: ai["1X2"]?.empate?.probabilidad || ai["1X2"]?.empate || 'N/D', justificacion: ai["1X2"]?.empate?.justificacion || '' },
                    victoria_visitante: { probabilidad: ai["1X2"]?.victoria_visitante?.probabilidad || ai["1X2"]?.victoria_visitante || 'N/D', justificacion: ai["1X2"]?.victoria_visitante?.justificacion || '' }
                }
            };
        }
    } catch (e) {
        console.warn('[getCombinedPrediction] Error parseando pronostico_json:', e.message);
    }

    if (!ai || !ai["1X2"] || Object.values(ai["1X2"]).every(p => !p?.probabilidad)) {
        combined.header = "Análisis Estadístico Principal";
        combined.body = `<p>No se encontró un pronóstico de IA válido. El análisis se basa únicamente en datos estadísticos.</p>`;
        console.log('[getCombinedPrediction] Sin pronóstico IA válido, usando solo estadísticas');
        return combined;
    }

    // parse probabilities from ai robustly
    const aiProbs = {
        home: safeParseProbability(ai["1X2"].victoria_local?.probabilidad),
        draw: safeParseProbability(ai["1X2"].empate?.probabilidad),
        away: safeParseProbability(ai["1X2"].victoria_visitante?.probabilidad)
    };

    const statProbs = {
        home: stats.finalHome,
        draw: stats.finalDraw,
        away: stats.finalAway
    };

    const statMax = Math.max(statProbs.home, statProbs.draw, statProbs.away);
    const aiMax = Math.max(aiProbs.home, aiProbs.draw, aiProbs.away);
    const statBest = Object.keys(statProbs).find(k => statProbs[k] === statMax);
    const aiBest = Object.keys(aiProbs).find(k => aiProbs[k] === aiMax);

    let header = "Pronóstico Combinado (Estadística + IA)";
    let body = `
        <p><strong>Modelo Estadístico:</strong> Victoria Local: ${formatPct(statProbs.home)}, Empate: ${formatPct(statProbs.draw)}, Victoria Visitante: ${formatPct(statProbs.away)}.</p>
        <p><strong>Modelo de IA:</strong> Victoria Local: ${formatPct(aiProbs.home)}, Empate: ${formatPct(aiProbs.draw)}, Victoria Visitante: ${formatPct(aiProbs.away)}.</p>
    `;

    if (statBest === aiBest) {
        const resultText = statBest === 'home' ? `Victoria ${matchData.local}` : statBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
        const reason = ai["1X2"][statBest === 'home' ? 'victoria_local' : statBest === 'draw' ? 'empate' : 'victoria_visitante']?.justificacion || "Sin justificación detallada.";
        header = `¡Consenso! Apuesta Fuerte en la ${resultText} ⭐`;
        body += `<p>Ambos modelos coinciden en que la <strong>${resultText}</strong> es el resultado más probable.</p>`;
        body += `<p><strong>Justificación de la IA:</strong> ${reason}</p>`;
    } else {
        const statResult = statBest === 'home' ? `Victoria ${matchData.local}` : statBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
        const aiResult = aiBest === 'home' ? `Victoria ${matchData.local}` : aiBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;

        header = "Discrepancia en Pronósticos ⚠️";
        body += `<p>El modelo estadístico (${formatPct(statMax)}) favorece la <strong>${statResult}</strong>, mientras que la IA (${formatPct(aiMax)}) se inclina por la <strong>${aiResult}</strong>.</p>`;
        body += `<p><strong>Análisis de la IA:</strong> ${ai["1X2"][aiBest === 'home' ? 'victoria_local' : aiBest === 'draw' ? 'empate' : 'victoria_visitante']?.justificacion || "Sin justificación detallada."}</p>`;
        body += `<p>Se recomienda cautela. Analiza la justificación de la IA para entender los factores externos que no considera el modelo estadístico.</p>`;
    }

    combined.header = header;
    combined.body = body;
    console.log('[getCombinedPrediction] Pronóstico combinado:', combined);
    return combined;
}

function safeParseProbability(p) {
    if (!p && p !== 0) return 0;
    if (typeof p === 'number') return p;
    const s = String(p).trim().replace('%', '');
    const num = parseFloat(s);
    if (isFinite(num)) return num / 100;
    return 0;
}

// ----------------------
// CÁLCULO COMPLETO
// ----------------------
function calculateAll() {
    const leagueCode = $('leagueSelect')?.value;
    const teamHome = $('teamHome')?.value;
    const teamAway = $('teamAway')?.value;

    if (!leagueCode || !teamHome || !teamAway) {
        const details = $('details');
        if (details) {
            details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> Selecciona una liga y ambos equipos para calcular el pronóstico.</div>';
        }
        console.log('[calculateAll] Faltan datos: leagueCode=', leagueCode, 'teamHome=', teamHome, 'teamAway=', teamAway);
        return;
    }

    const tH = findTeam(leagueCode, teamHome);
    const tA = findTeam(leagueCode, teamAway);

    if (!tH || !tA) {
        const details = $('details');
        if (details) {
            details.innerHTML = `<div class="error"><strong>Error:</strong> Uno o ambos equipos no encontrados en la liga seleccionada.</div>`;
        }
        console.error('[calculateAll] Equipos no encontrados: tH=', tH, 'tA=', tA);
        return;
    }

    const stats = dixonColesProbabilities(tH, tA, leagueCode);
    console.log('[calculateAll] Probabilidades estadísticas:', stats);

    const ligaName = leagueCodeToName[leagueCode];
    const calendario = allData.calendario || {};
    const eventsForLeague = calendario[ligaName] || calendario[leagueCode] || [];

    // find event - tolerate small differences in team name
    const event = (Array.isArray(eventsForLeague) ? eventsForLeague : []).find(e => {
        const local = e.local || e.home || e.team_home || '';
        const away = e.visitante || e.away || e.team_away || '';
        return normalizeStr(local) === normalizeStr(teamHome) && normalizeStr(away) === normalizeStr(teamAway);
    });

    const matchData = { local: teamHome, visitante: teamAway };

    const probabilities = [
        { label: 'Local', value: stats.finalHome, id: 'pHome', type: 'Resultado' },
        { label: 'Empate', value: stats.finalDraw, id: 'pDraw', type: 'Resultado' },
        { label: 'Visitante', value: stats.finalAway, id: 'pAway', type: 'Resultado' },
        { label: 'Ambos Anotan', value: event && event.pronostico_json ? safeParseProbability(event.pronostico_json?.BTTS?.si?.probabilidad || event.pronostico_json?.BTTS?.si?.probabilidad) : stats.pBTTSH, id: 'pBTTS', type: 'Mercado' },
        { label: 'Más de 2.5 goles', value: event && event.pronostico_json ? safeParseProbability(event.pronostico_json?.Goles?.mas_2_5?.probabilidad) : stats.pO25H, id: 'pO25', type: 'Mercado' }
    ];

    probabilities.forEach(p => {
        const el = $(p.id);
        if (el) el.textContent = formatPct(p.value);
    });

    const recommendations = probabilities.filter(p => p.value >= 0.3)
                                       .sort((a, b) => b.value - a.value)
                                       .slice(0, 3);
    console.log('[calculateAll] Recomendaciones:', recommendations);

    let suggestionText = '<h3>Recomendaciones de Apuesta</h3><ul>';
    if (recommendations.length === 0) {
        suggestionText += `<li>No hay recomendaciones fuertes (>=30%).</li>`;
    } else {
        recommendations.forEach(r => {
            suggestionText += `<li><strong>${r.label} (${formatPct(r.value)})</strong> - ${r.type}</li>`;
        });
    }
    suggestionText += '</ul>';
    const suggestion = $('suggestion');
    if (suggestion) {
        suggestion.innerHTML = suggestionText;
    }

    const detailedPredictionBox = $('detailed-prediction');
    if (event && event.pronostico_json) {
        const json = (typeof event.pronostico_json === 'string') ? (() => {
            try { return JSON.parse(event.pronostico_json); } catch (e) { return event.pronostico_json; }
        })() : event.pronostico_json;

        let html = `<h3>Análisis de la IA</h3><div class="ia-prediction">`;
        html += `<h4>Análisis del Partido: ${teamHome} vs. ${teamAway}</h4>`;

        // Guard against missing fields
        const oneX2 = json["1X2"] || json["1x2"] || {};
        html += `<p><strong>${teamHome}:</strong> ${oneX2.victoria_local?.justificacion || oneX2.home?.justificacion || oneX2.local?.justificacion || 'Sin justificación.'} (Probabilidad: ${oneX2.victoria_local?.probabilidad || oneX2.home?.probabilidad || 'N/D'})</p>`;
        html += `<p><strong>Empate:</strong> ${oneX2.empate?.justificacion || oneX2.draw?.justificacion || 'Sin justificación.'} (Probabilidad: ${oneX2.empate?.probabilidad || oneX2.draw?.probabilidad || 'N/D'})</p>`;
        html += `<p><strong>${teamAway}:</strong> ${oneX2.victoria_visitante?.justificacion || oneX2.away?.justificacion || 'Sin justificación.'} (Probabilidad: ${oneX2.victoria_visitante?.probabilidad || oneX2.away?.probabilidad || 'N/D'})</p>`;

        const btts = json.BTTS || json.btts || {};
        html += `<h4>Ambos Anotan (BTTS):</h4>`;
        html += `<p><strong>Sí:</strong> ${btts.si?.probabilidad || btts.yes?.probabilidad || 'N/D'} ${btts.si?.justificacion ? ` - ${btts.si.justificacion}` : ''}</p>`;
        html += `<p><strong>No:</strong> ${btts.no?.probabilidad || 'N/D'} ${btts.no?.justificacion ? ` - ${btts.no.justificacion}` : ''}</p>`;

        const goles = json.Goles || json.goles || {};
        html += `<h4>Goles Totales (Más/Menos 2.5):</h4>`;
        html += `<p><strong>Más de 2.5:</strong> ${goles.mas_2_5?.probabilidad || goles.over?.probabilidad || 'N/D'} ${goles.mas_2_5?.justificacion ? ` - ${goles.mas_2_5.justificacion}` : ''}</p>`;
        html += `<p><strong>Menos de 2.5:</strong> ${goles.menos_2_5?.probabilidad || goles.under?.probabilidad || 'N/D'} ${goles.menos_2_5?.justificacion ? ` - ${goles.menos_2_5.justificacion}` : ''}</p>`;
        html += `</div>`;
        if (detailedPredictionBox) {
            detailedPredictionBox.innerHTML = html;
            console.log('[calculateAll] Mostrando pronóstico JSON:', json);
        }
    } else if (event && event.pronostico) {
        const formattedPrediction = String(event.pronostico).replace(/\n/g, '<br>').replace(/###\s*(.*)/g, '<h4>$1</h4>');
        if (detailedPredictionBox) {
            detailedPredictionBox.innerHTML = `<h3>Análisis de la IA</h3><div class="ia-prediction">${formattedPrediction}</div>`;
            console.log('[calculateAll] Mostrando pronóstico de texto plano:', event.pronostico);
        }
    } else if (detailedPredictionBox) {
        detailedPredictionBox.innerHTML = `<p>No hay un pronóstico de la IA disponible para este partido en la hoja de cálculo.</p>`;
        console.log('[calculateAll] Sin pronóstico disponible para', teamHome, 'vs', teamAway);
    }

    const combined = getCombinedPrediction(stats, event || {}, matchData);
    const combinedPrediction = $('combined-prediction');
    if (combinedPrediction) {
        combinedPrediction.innerHTML = `<h3>${combined.header}</h3>${combined.body}`;
    }
}
