// RESTRINGIR SELECCIÓN DEL MISMO EQUIPO
function restrictSameTeam() {
    const teamHome = $('teamHome');
    const teamAway = $('teamAway');
    const selectedLeague = $('leagueSelect').value;
    if (!selectedLeague) return;

    const homeValue = teamHome.value;
    const awayValue = teamAway.value;

    // Deshabilitar la opción seleccionada en el otro select
    Array.from(teamHome.options).forEach(option => {
        option.disabled = option.value === awayValue && option.value !== '';
    });
    Array.from(teamAway.options).forEach(option => {
        option.disabled = option.value === homeValue && option.value !== '';
    });

    // Limpiar datos si no hay selección válida
    if (!homeValue) clearTeamData('home');
    if (!awayValue) clearTeamData('away');
    if (homeValue && awayValue && homeValue !== awayValue) {
        calculateAll();
    } else {
        clearAll(false);
    }
}

// LIMPIAR DATOS DE EQUIPO
function clearTeamData(prefix) {
    $(`${prefix}-pj-general`).textContent = 'PJ: 0';
    $(`${prefix}-points-general`).textContent = 'Puntos: 0';
    $(`${prefix}-dg-general`).textContent = 'DG: 0';
    $(`${prefix}-pj-local`).textContent = 'PJ: 0';
    $(`${prefix}-wins-local`).textContent = 'PG: 0';
    $(`${prefix}-dg-local`).textContent = 'DG: 0';
    $(`${prefix}-pj-away`).textContent = 'PJ: 0';
    $(`${prefix}-wins-away`).textContent = 'PG: 0';
    $(`${prefix}-dg-away`).textContent = 'DG: 0';
    $(`pos${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`).textContent = '--';
    $(`gf${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`).textContent = '--';
    $(`ga${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`).textContent = '--';
    $(`winRate${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`).textContent = '--';
}

// LLENAR DATOS DE EQUIPO
function fillTeamData(team, prefix) {
    if (!team) return;
    $(`${prefix}-pj-general`).textContent = `PJ: ${team.pj}`;
    $(`${prefix}-points-general`).textContent = `Puntos: ${team.points}`;
    $(`${prefix}-dg-general`).textContent = `DG: ${team.gf - team.ga}`;
    $(`${prefix}-pj-local`).textContent = `PJ: ${team.pjHome}`;
    $(`${prefix}-wins-local`).textContent = `PG: ${team.winsHome}`;
    $(`${prefix}-dg-local`).textContent = `DG: ${team.gfHome - team.gaHome}`;
    $(`${prefix}-pj-away`).textContent = `PJ: ${team.pjAway}`;
    $(`${prefix}-wins-away`).textContent = `PG: ${team.winsAway}`;
    $(`${prefix}-dg-away`).textContent = `DG: ${team.gfAway - team.gaAway}`;
    $(`pos${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`).textContent = team.pos || '--';
    $(`gf${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`).textContent = team.gf || '--';
    $(`ga${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`).textContent = team.ga || '--';
    const winRate = team.pj > 0 ? (team.g / team.pj) : 0;
    $(`winRate${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`).textContent = formatPct(winRate);
}

// LIMPIAR TODO
function clearAll(resetTeams = true) {
    clearTeamData('home');
    clearTeamData('away');
    $('pHome').textContent = '--';
    $('pDraw').textContent = '--';
    $('pAway').textContent = '--';
    $('pBTTS').textContent = '--';
    $('pO25').textContent = '--';
    $('suggestion-list').innerHTML = '';
    $('ia-prediction-content').innerHTML = '<p>Esperando pronóstico detallado...</p>';
    $('combined-prediction-content').innerHTML = '<p>Esperando pronóstico combinado...</p>';
    if (resetTeams) {
        const teamHome = $('teamHome');
        const teamAway = $('teamAway');
        if (teamHome) teamHome.value = '';
        if (teamAway) teamAway.value = '';
        Array.from(teamHome.options).forEach(opt => opt.disabled = false);
        Array.from(teamAway.options).forEach(opt => opt.disabled = false);
    }
}

// CALCULAR PROBABILIDADES DIXON-COLES
function dixonColesProbabilities(homeTeam, awayTeam) {
    const homeAttack = homeTeam.gf / (homeTeam.pj || 1);
    const homeDefense = homeTeam.ga / (homeTeam.pj || 1);
    const awayAttack = awayTeam.gf / (awayTeam.pj || 1);
    const awayDefense = awayTeam.ga / (awayTeam.pj || 1);
    const leagueAvgGoals = (homeTeam.gf + awayTeam.gf) / (homeTeam.pj + awayTeam.pj || 1);
    const homeAdvantage = 1.1;
    const lambdaHome = homeAttack * awayDefense * homeAdvantage * leagueAvgGoals;
    const lambdaAway = awayAttack * homeDefense * leagueAvgGoals;
    let pHome = 0, pDraw = 0, pAway = 0, pBTTS = 0, pOver25 = 0;
    for (let h = 0; h <= 5; h++) {
        for (let a = 0; a <= 5; a++) {
            const prob = poissonProbability(lambdaHome, h) * poissonProbability(lambdaAway, a);
            if (h > a) pHome += prob;
            else if (h === a) pDraw += prob;
            else pAway += prob;
            if (h > 0 && a > 0) pBTTS += prob;
            if (h + a > 2.5) pOver25 += prob;
        }
    }
    return { pHome, pDraw, pAway, pBTTS, pOver25 };
}

// PARSEAR PRONÓSTICO EN TEXTO PLANO
function parsePlainText(text, homeTeam, awayTeam) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const suggestions = [];
    lines.forEach((line, index) => {
        const match = line.match(/(.+?)\s*:\s*(\d+\.?\d*)/);
        if (match) {
            const bet = match[1].replace(homeTeam, 'Local').replace(awayTeam, 'Visitante');
            const prob = parseFloat(match[2]);
            if (!isNaN(prob)) {
                suggestions.push({ bet, prob, index });
            }
        }
    });
    return suggestions.sort((a, b) => b.prob - a.prob);
}

// OBTENER PRONÓSTICO COMBINADO
function getCombinedPrediction(probabilities, iaText, homeTeam, awayTeam) {
    const iaSuggestions = parsePlainText(iaText, homeTeam, awayTeam);
    const combined = [];
    if (probabilities.pHome > 0.4) combined.push({ bet: 'Local', prob: probabilities.pHome });
    if (probabilities.pDraw > 0.3) combined.push({ bet: 'Empate', prob: probabilities.pDraw });
    if (probabilities.pAway > 0.4) combined.push({ bet: 'Visitante', prob: probabilities.pAway });
    if (probabilities.pBTTS > 0.5) combined.push({ bet: 'Ambos Anotan', prob: probabilities.pBTTS });
    if (probabilities.pOver25 > 0.5) combined.push({ bet: 'Más de 2.5 Goles', prob: probabilities.pOver25 });
    iaSuggestions.forEach(s => {
        if (!combined.some(c => c.bet === s.bet)) {
            combined.push(s);
        }
    });
    return combined.sort((a, b) => b.prob - a.prob).slice(0, 3);
}

// CALCULAR TODO
async function calculateAll() {
    const league = $('leagueSelect').value;
    const homeTeamName = $('teamHome').value;
    const awayTeamName = $('teamAway').value;
    if (!league || !homeTeamName || !awayTeamName || homeTeamName === awayTeamName) {
        clearAll(false);
        return;
    }

    const homeTeam = findTeam(league, homeTeamName);
    const awayTeam = findTeam(league, awayTeamName);
    if (!homeTeam || !awayTeam) {
        clearAll(false);
        $('details').innerHTML = '<div class="error">Error: No se encontraron datos para uno o ambos equipos.</div>';
        return;
    }

    fillTeamData(homeTeam, 'home');
    fillTeamData(awayTeam, 'away');
    const probabilities = dixonColesProbabilities(homeTeam, awayTeam);
    $('pHome').textContent = formatPct(probabilities.pHome);
    $('pDraw').textContent = formatPct(probabilities.pDraw);
    $('pAway').textContent = formatPct(probabilities.pAway);
    $('pBTTS').textContent = formatPct(probabilities.pBTTS);
    $('pO25').textContent = formatPct(probabilities.pOver25);

    // Simular pronóstico de IA (sustituir con API real si es necesario)
    const iaText = `Local: ${formatPct(probabilities.pHome)}\nEmpate: ${formatPct(probabilities.pDraw)}\nVisitante: ${formatPct(probabilities.pAway)}\nAmbos Anotan: ${formatPct(probabilities.pBTTS)}\nMás de 2.5 Goles: ${formatPct(probabilities.pOver25)}`;
    const suggestions = parsePlainText(iaText, homeTeamName, awayTeamName);
    const suggestionList = $('suggestion-list');
    suggestionList.innerHTML = '';
    suggestions.forEach((s, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="rec-rank">${i + 1}</span><span class="rec-bet">${s.bet}</span><span class="rec-prob">${formatPct(s.prob)}</span>`;
        suggestionList.appendChild(li);
    });

    $('ia-prediction-content').innerHTML = `<p>Análisis basado en estadísticas: ${iaText.replace(/\n/g, '<br>')}</p>`;
    const combined = getCombinedPrediction(probabilities, iaText, homeTeamName, awayTeamName);
    const combinedContent = $('combined-prediction-content');
    combinedContent.innerHTML = '';
    combined.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'rec-item';
        div.innerHTML = `<span class="rec-rank">${i + 1}</span><span class="rec-bet">${c.bet}</span><span class="rec-prob">${formatPct(c.prob)}</span>`;
        combinedContent.appendChild(div);
    });
}
