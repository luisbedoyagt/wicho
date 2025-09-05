const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzOJtjsqYuqxn6sMxFKQ7vb5TxoGxj7NoxcfUp5omYIw3C5s3qyAvOfLvRyGeE2xpc4/exec?tipo=todo&update=false';
const leagueNames = {
    'esp.1': 'LaLiga España',
    'esp.2': 'Segunda División España',
    'eng.1': 'Premier League Inglaterra',
    'eng.2': 'Championship Inglaterra',
    'ita.1': 'Serie A Italia',
    'ger.1': 'Bundesliga Alemania',
    'fra.1': 'Ligue 1 Francia',
    'ned.1': 'Eredivisie Países Bajos',
    'ned.2': 'Eerste Divisie Países Bajos',
    'por.1': 'Liga Portugal',
    'mex.1': 'Liga MX México',
    'mex.2': 'Expansión MX México',
    'usa.1': 'MLS Estados Unidos',
    'bra.1': 'Brasileirão Brasil',
    'gua.1': 'Liga Nacional Guatemala',
    'crc.1': 'Liga Promerica Costa Rica',
    'hon.1': 'Liga Nacional Honduras',
    'slv.1': 'Primera División El Salvador',
    'ksa.1': 'Pro League Arabia Saudí',
    'tur.1': 'Süper Lig Turquía',
    'ger.2': '2. Bundesliga Alemania',
    'arg.1': 'Liga Profesional Argentina',
    'chn.1': 'Superliga China',
    'fifa.worldq.conmebol': 'Eliminatorias CONMEBOL',
    'fifa.worldq.concacaf': 'Eliminatorias CONCACAF',
    'fifa.worldq.uefa': 'Eliminatorias UEFA'
};

const leagueCodeToName = {
    'esp.1': 'España_LaLiga',
    'esp.2': 'España_Segunda',
    'eng.1': 'Inglaterra_PremierLeague',
    'eng.2': 'Inglaterra_Championship',
    'ita.1': 'Italia_SerieA',
    'ger.1': 'Alemania_Bundesliga',
    'fra.1': 'Francia_Ligue1',
    'ned.1': 'PaísesBajos_Eredivisie',
    'ned.2': 'PaísesBajos_EersteDivisie',
    'por.1': 'Portugal_LigaPortugal',
    'mex.1': 'México_LigaMX',
    'mex.2': 'México_ExpansionMX',
    'usa.1': 'EstadosUnidos_MLS',
    'bra.1': 'Brasil_Brasileirao',
    'gua.1': 'Guatemala_LigaNacional',
    'crc.1': 'CostaRica_LigaPromerica',
    'hon.1': 'Honduras_LigaNacional',
    'slv.1': 'ElSalvador_LigaPrimeraDivision',
    'ksa.1': 'Arabia_Saudi_ProLeague',
    'tur.1': 'Turquia_SuperLig',
    'ger.2': 'Alemania_Bundesliga2',
    'arg.1': 'Argentina_LigaProfesional',
    'chn.1': 'China_Superliga',
    'fifa.worldq.conmebol': 'Eliminatorias_CONMEBOL',
    'fifa.worldq.concacaf': 'Eliminatorias_CONCACAF',
    'fifa.worldq.uefa': 'Eliminatorias_UEFA'
};

let allData = { ligas: {}, calendario: {} };
let eventInterval = null;

const $ = id => document.getElementById(id);

async function fetchAllData() {
    try {
        console.log('[fetchAllData] Iniciando carga de datos desde:', WEBAPP_URL);
        const response = await fetch(WEBAPP_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('[fetchAllData] Datos recibidos:', data);
        allData = data;
        return data;
    } catch (error) {
        console.error('[fetchAllData] Error al cargar datos:', error);
        return null;
    }
}

function findTeam(leagueCode, teamName) {
    if (!allData.ligas[leagueCode]) {
        console.warn(`[findTeam] Liga no encontrada: ${leagueCode}`);
        return null;
    }
    const team = allData.ligas[leagueCode].find(t => t.name.trim() === teamName.trim());
    if (!team) {
        console.warn(`[findTeam] Equipo no encontrado: ${teamName} en liga ${leagueCode}`);
    }
    return team;
}

function displaySelectedLeagueEvents(leagueCode) {
    const selectedEventsList = $('selected-league-events');
    if (!selectedEventsList) {
        console.warn('[displaySelectedLeagueEvents] Elemento selected-league-events no encontrado');
        return;
    }
    console.log('[displaySelectedLeagueEvents] leagueCode:', leagueCode);
    console.log('[displaySelectedLeagueEvents] allData.calendario:', allData.calendario);

    if (eventInterval) {
        clearInterval(eventInterval);
        eventInterval = null;
    }
    selectedEventsList.innerHTML = '';

    let events = [];
    if (!leagueCode) {
        console.log('[displaySelectedLeagueEvents] Mostrando eventos de todas las ligas');
        if (allData.calendario && typeof allData.calendario === 'object') {
            Object.keys(allData.calendario).forEach(ligaName => {
                if (Array.isArray(allData.calendario[ligaName])) {
                    console.log(`[displaySelectedLeagueEvents] Procesando liga: ${ligaName}, eventos:`, allData.calendario[ligaName]);
                    events.push(...allData.calendario[ligaName].map(event => ({
                        ...event,
                        ligaName: ligaName,
                        leagueCode: Object.keys(leagueCodeToName).find(code => leagueCodeToName[code] === ligaName) || ''
                    })));
                } else {
                    console.warn(`[displaySelectedLeagueEvents] allData.calendario[${ligaName}] no es un arreglo:`, allData.calendario[ligaName]);
                }
            });
            console.log('[displaySelectedLeagueEvents] Eventos recolectados (todas las ligas):', events);
        } else {
            console.warn('[displaySelectedLeagueEvents] allData.calendario es undefined o no es un objeto');
            selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos disponibles.</span></div>';
            return;
        }
    } else {
        const ligaName = leagueCodeToName[leagueCode];
        console.log('[displaySelectedLeagueEvents] Liga seleccionada:', ligaName);
        events = (allData.calendario[ligaName] || []).map(event => ({
            ...event,
            ligaName: ligaName,
            leagueCode: leagueCode
        }));
        console.log('[displaySelectedLeagueEvents] Eventos recolectados (liga seleccionada):', events);
        if (events.length === 0) {
            selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos para esta liga.</span></div>';
            console.log(`[displaySelectedLeagueEvents] No hay eventos para ${ligaName}`);
            return;
        }
    }

    if (events.length === 0) {
        selectedEventsList.innerHTML = '<div class="event-item placeholder"><span>No hay eventos próximos disponibles.</span></div>';
        console.log('[displaySelectedLeagueEvents] No hay eventos disponibles');
        return;
    }

    events.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    const eventsPerPage = 1;
    const totalPages = Math.ceil(events.length / eventsPerPage);
    let currentPage = 0;

    function showCurrentPage() {
        const startIndex = currentPage * eventsPerPage;
        const eventsToShow = events.slice(startIndex, startIndex + eventsPerPage);
        console.log('[displaySelectedLeagueEvents] Mostrando página:', currentPage, 'Eventos a mostrar:', eventsToShow);

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
                console.log('[displaySelectedLeagueEvents] Renderizando evento:', event);
                const div = document.createElement('div');
                div.className = 'event-item slide-in';
                div.style.animationDelay = `${index * 0.1}s`;
                div.dataset.homeTeam = event.local.trim();
                div.dataset.awayTeam = event.visitante.trim();
                div.dataset.leagueCode = event.leagueCode;

                const homeTeam = findTeam(event.leagueCode, event.local.trim());
                const awayTeam = findTeam(event.leagueCode, event.visitante.trim());
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
                        <span class="event-details">${leagueNames[event.leagueCode] || event.ligaName}: ${eventDateTime}${statusText}</span>
                        <span class="event-details">Estadio: ${event.estadio || 'Por confirmar'}</span>
                    </div>
                `;
                if (isInProgress) {
                    div.classList.add('in-progress');
                    div.style.cursor = 'not-allowed';
                    div.title = 'Evento en curso, no seleccionable';
                } else {
                    div.addEventListener('click', () => {
                        const leagueSelect = $('leagueSelect');
                        if (leagueSelect && event.leagueCode) {
                            leagueSelect.value = event.leagueCode;
                            console.log('[displaySelectedLeagueEvents] Seleccionando liga:', event.leagueCode);
                            onLeagueChange();
                        }
                        selectEvent(event.local.trim(), event.visitante.trim());
                    });
                }
                selectedEventsList.appendChild(div);
            });
            currentPage = (currentPage + 1) % totalPages;
        }, currentItems.length > 0 ? 800 : 0);
    }
    showCurrentPage();
    if (totalPages > 1) {
        eventInterval = setInterval(showCurrentPage, 10000);
    }
}

function populateLeagueSelect() {
    const leagueSelect = $('leagueSelect');
    leagueSelect.innerHTML = '<option value="">-- Selecciona liga --</option>';
    
    const optgroups = {
        'Europa': ['esp.1', 'esp.2', 'eng.1', 'eng.2', 'ita.1', 'ger.1', 'ger.2', 'fra.1', 'ned.1', 'ned.2', 'por.1', 'tur.1'],
        'América': ['mex.1', 'mex.2', 'usa.1', 'bra.1', 'gua.1', 'crc.1', 'hon.1', 'slv.1', 'arg.1'],
        'Asia': ['ksa.1', 'chn.1'],
        'Eliminatorias': ['fifa.worldq.conmebol', 'fifa.worldq.concacaf', 'fifa.worldq.uefa']
    };

    for (const [groupName, leagues] of Object.entries(optgroups)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        leagues.forEach(leagueCode => {
            if (leagueNames[leagueCode]) {
                const option = document.createElement('option');
                option.value = leagueCode;
                option.textContent = leagueNames[leagueCode];
                optgroup.appendChild(option);
            }
        });
        leagueSelect.appendChild(optgroup);
    }
}

function populateTeamSelects(leagueCode) {
    const teamHome = $('teamHome');
    const teamAway = $('teamAway');
    teamHome.innerHTML = '<option value="">-- Selecciona equipo local --</option>';
    teamAway.innerHTML = '<option value="">-- Selecciona equipo visitante --</option>';

    if (!leagueCode || !allData.ligas[leagueCode]) {
        console.warn('[populateTeamSelects] Liga no válida o sin datos:', leagueCode);
        return;
    }

    allData.ligas[leagueCode].forEach(team => {
        const optionHome = document.createElement('option');
        const optionAway = document.createElement('option');
        optionHome.value = team.name;
        optionAway.value = team.name;
        optionHome.textContent = team.name;
        optionAway.textContent = team.name;
        teamHome.appendChild(optionHome);
        teamAway.appendChild(optionAway);
    });
}

function onLeagueChange() {
    const leagueSelect = $('leagueSelect');
    const leagueCode = leagueSelect.value;
    console.log('[onLeagueChange] Liga seleccionada:', leagueCode);
    populateTeamSelects(leagueCode);
    displaySelectedLeagueEvents(leagueCode);
    clearStats();
}

function selectEvent(homeTeam, awayTeam) {
    console.log('[selectEvent] Seleccionando evento:', homeTeam, 'vs', awayTeam);
    const leagueSelect = $('leagueSelect');
    const teamHome = $('teamHome');
    const teamAway = $('teamAway');
    
    if (leagueSelect.value) {
        teamHome.value = homeTeam;
        teamAway.value = awayTeam;
        updateStats(homeTeam, awayTeam, leagueSelect.value);
    }
}

function updateStats(homeTeam, awayTeam, leagueCode) {
    console.log('[updateStats] Actualizando estadísticas para:', homeTeam, awayTeam, leagueCode);
    
    const home = findTeam(leagueCode, homeTeam);
    const away = findTeam(leagueCode, awayTeam);
    
    if (home) {
        $('posHome').textContent = home.rank || '--';
        $('gfHome').textContent = home.goalsFor || '--';
        $('gaHome').textContent = home.goalsAgainst || '--';
        $('winRateHome').textContent = home.gamesPlayed ? `${((home.wins / home.gamesPlayed) * 100).toFixed(1)}%` : '--';
        
        const formHomeBox = $('formHomeBox');
        formHomeBox.innerHTML = `
            <div class="team-details">
                <div class="stat-section">
                    <span class="section-title">General</span>
                    <div class="stat-metrics">
                        <span>PJ: ${home.gamesPlayed || 0}</span>
                        <span>Puntos: ${home.points || 0}</span>
                        <span>DG: ${home.goalsDiff || 0}</span>
                    </div>
                </div>
                <div class="stat-section">
                    <span class="section-title">Local</span>
                    <div class="stat-metrics">
                        <span>PJ: ${home.gamesPlayedHome || 0}</span>
                        <span>PG: ${home.winsHome || 0}</span>
                        <span>DG: ${home.goalsForHome - home.goalsAgainstHome || 0}</span>
                    </div>
                </div>
                <div class="stat-section">
                    <span class="section-title">Visitante</span>
                    <div class="stat-metrics">
                        <span>PJ: ${home.gamesPlayedAway || 0}</span>
                        <span>PG: ${home.winsAway || 0}</span>
                        <span>DG: ${home.goalsForAway - home.goalsAgainstAway || 0}</span>
                    </div>
                </div>
            </div>
        `;
    }

    if (away) {
        $('posAway').textContent = away.rank || '--';
        $('gfAway').textContent = away.goalsFor || '--';
        $('gaAway').textContent = away.goalsAgainst || '--';
        $('winRateAway').textContent = away.gamesPlayed ? `${((away.wins / away.gamesPlayed) * 100).toFixed(1)}%` : '--';
        
        const formAwayBox = $('formAwayBox');
        formAwayBox.innerHTML = `
            <div class="team-details">
                <div class="stat-section">
                    <span class="section-title">General</span>
                    <div class="stat-metrics">
                        <span>PJ: ${away.gamesPlayed || 0}</span>
                        <span>Puntos: ${away.points || 0}</span>
                        <span>DG: ${away.goalsDiff || 0}</span>
                    </div>
                </div>
                <div class="stat-section">
                    <span class="section-title">Local</span>
                    <div class="stat-metrics">
                        <span>PJ: ${away.gamesPlayedHome || 0}</span>
                        <span>PG: ${away.winsHome || 0}</span>
                        <span>DG: ${away.goalsForHome - away.goalsAgainstHome || 0}</span>
                    </div>
                </div>
                <div class="stat-section">
                    <span class="section-title">Visitante</span>
                    <div class="stat-metrics">
                        <span>PJ: ${away.gamesPlayedAway || 0}</span>
                        <span>PG: ${away.winsAway || 0}</span>
                        <span>DG: ${away.goalsForAway - away.goalsAgainstAway || 0}</span>
                    </div>
                </div>
            </div>
        `;
    }

    const event = allData.calendario[leagueCodeToName[leagueCode]]?.find(e => 
        e.local.trim() === homeTeam.trim() && e.visitante.trim() === awayTeam.trim()
    );
    
    if (event?.pronostico_json) {
        const p = event.pronostico_json;
        $('pHome').textContent = p["1X2"].victoria_local.probabilidad;
        $('pDraw').textContent = p["1X2"].empate.probabilidad;
        $('pAway').textContent = p["1X2"].victoria_visitante.probabilidad;
        $('pBTTS').textContent = p.BTTS.si.probabilidad;
        $('pO25').textContent = p.Goles.mas_2_5.probabilidad;

        const suggestion = $('suggestion');
        suggestion.innerHTML = `
            <ul>
                <li class="rec-item"><span class="rec-rank">1</span><span class="rec-bet">1X2: ${p["1X2"].victoria_local.probabilidad} para ${homeTeam}</span></li>
                <li class="rec-item"><span class="rec-rank">2</span><span class="rec-bet">Ambos Anotan: ${p.BTTS.si.probabilidad}</span></li>
                <li class="rec-item"><span class="rec-rank">3</span><span class="rec-bet">Más de 2.5 Goles: ${p.Goles.mas_2_5.probabilidad}</span></li>
            </ul>
        `;
        
        $('detailed-prediction').innerHTML = `
            <p><strong>${homeTeam}:</strong> ${p["1X2"].victoria_local.justificacion}</p>
            <p><strong>Empate:</strong> ${p["1X2"].empate.justificacion}</p>
            <p><strong>${awayTeam}:</strong> ${p["1X2"].victoria_visitante.justificacion}</p>
        `;
        
        $('combined-prediction').innerHTML = `
            <p><strong>Recomendación Combinada:</strong></p>
            <ul>
                <li>1X2: ${p["1X2"].victoria_local.probabilidad} para ${homeTeam}</li>
                <li>Ambos Anotan: ${p.BTTS.si.probabilidad}</li>
                <li>Más de 2.5 Goles: ${p.Goles.mas_2_5.probabilidad}</li>
            </ul>
        `;
    } else {
        console.warn('[updateStats] No se encontró pronóstico para:', homeTeam, awayTeam);
        clearPredictions();
    }
}

function clearStats() {
    ['posHome', 'gfHome', 'gaHome', 'winRateHome', 'posAway', 'gfAway', 'gaAway', 'winRateAway'].forEach(id => {
        $(id).textContent = '--';
    });
    $('formHomeBox').innerHTML = `
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
    $('formAwayBox').innerHTML = `
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
    clearPredictions();
}

function clearPredictions() {
    ['pHome', 'pDraw', 'pAway', 'pBTTS', 'pO25'].forEach(id => {
        $(id).textContent = '--';
    });
    $('suggestion').innerHTML = '<p>Esperando datos...</p>';
    $('detailed-prediction').innerHTML = '<p>Esperando pronóstico detallado...</p>';
    $('combined-prediction').innerHTML = '<p>Esperando pronóstico combinado...</p>';
}

function clearAll() {
    console.log('[clearAll] Reseteando todo');
    const leagueSelect = $('leagueSelect');
    leagueSelect.value = '';
    populateTeamSelects('');
    displaySelectedLeagueEvents('');
    clearStats();
}

async function init() {
    console.log('[init] Inicializando aplicación');
    populateLeagueSelect();
    const leagueSelect = $('leagueSelect');
    leagueSelect.addEventListener('change', onLeagueChange);
    
    const resetButton = $('reset');
    resetButton.addEventListener('click', clearAll);

    await fetchAllData();
    console.log('[init] Datos cargados, mostrando eventos iniciales');
    displaySelectedLeagueEvents('');
}

init();
