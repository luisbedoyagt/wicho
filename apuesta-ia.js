// RESTRINGIR SELECCIÓN DEL MISMO EQUIPO
function restrictSameTeam() {
    const teamHome = $('teamHome').value;
    const teamAway = $('teamAway').value;
    if (teamHome && teamAway && teamHome === teamAway) {
        const details = $('details');
        if (details) {
            details.innerHTML = '<div class="error"><strong>Error:</strong> No puedes seleccionar el mismo equipo para local y visitante.</div>';
            setTimeout(() => {
                details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
            }, 5000);
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

// LIMPIAR DATOS DE EQUIPO
function clearTeamData(type) {
    const typeLower = type.toLowerCase();
    $(`pos${type}`).textContent = '--';
    $(`gf${type}`).textContent = '--';
    $(`ga${type}`).textContent = '--';
    $(`winRate${type}`).textContent = '--';
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
    const logoImg = cardHeader ? cardHeader.querySelector('.team-logo') : null;
    if (logoImg) logoImg.remove();
}

// LLENAR DATOS DE EQUIPO
function fillTeamData(teamName, leagueCode, type) {
    const t = findTeam(leagueCode, teamName);
    const typeLower = type.toLowerCase();
    if (!t) {
        const details = $('details');
        if (details) details.innerHTML = `<div class="error"><strong>Error:</strong> Equipo ${teamName} no encontrado en la liga seleccionada.</div>`;
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
            if (h3) h3.insertAdjacentElement('beforebegin', logoImg);
        }
        logoImg.src = t.logoUrl || '';
        logoImg.style.display = t.logoUrl ? 'inline-block' : 'none';
    }
}

// LIMPIAR TODO
function clearAll() {
    document.querySelectorAll('.stat-value').forEach(el => el.textContent = '--');
    document.querySelectorAll('select').forEach(s => s.selectedIndex = 0);
    ['pHome', 'pDraw', 'pAway', 'pBTTS', 'pO25'].forEach(id => {
        const el = $(id);
        if (el) el.textContent = '--';
    });
    const detailedPrediction = $('detailed-prediction');
    if (detailedPrediction) detailedPrediction.innerHTML = '<p>Esperando pronóstico detallado...</p>';
    const details = $('details');
    if (details) details.innerHTML = '<div class="info"><strong>Instrucciones:</strong> Selecciona una liga y los equipos local y visitante para obtener el pronóstico.</div>';
    const suggestion = $('suggestion');
    if (suggestion) suggestion.innerHTML = '<p>Esperando datos...</p>';
    const combinedPrediction = $('combined-prediction');
    if (combinedPrediction) combinedPrediction.innerHTML = '<p>Esperando pronóstico combinado...</p>';
    clearTeamData('Home');
    clearTeamData('Away');
    displaySelectedLeagueEvents('');
}

// CÁLCULO DE PROBABILIDADES CON DIXON-COLES
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
    const homeDefenseRaw = (tH.gaHome || 0) / (tH.pjHome || 1);
    const awayAttackRaw = (tA.gfAway || 0) / (tA.pjAway || 1);
    const awayDefenseRaw = (tA.gaAway || 0) / (tA.pjAway || 1);
    const homeAttack = (homeAttackRaw / leagueAvgGfHome) * shrinkageFactor;
    const homeDefense = (homeDefenseRaw / leagueAvgGaHome) * shrinkageFactor;
    const awayAttack = (awayAttackRaw / leagueAvgGfAway) * shrinkageFactor;
    const awayDefense = (awayDefenseRaw / leagueAvgGaAway) * shrinkageFactor;
    const expectedHomeGoals = homeAttack * awayDefense * leagueAvgGfHome;
    const expectedAwayGoals = awayAttack * homeDefense * leagueAvgGfAway;
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
    const pBTTSH = 1 - poissonProbability(expectedHomeGoals, 0) - poissonProbability(expectedAwayGoals, 0) + poissonProbability(expectedHomeGoals, 0) * poissonProbability(expectedAwayGoals, 0);
    const pO25H = 1 - (poissonProbability(expectedHomeGoals, 0) + poissonProbability(expectedHomeGoals, 1) + poissonProbability(expectedHomeGoals, 2)) * (poissonProbability(expectedAwayGoals, 0) + poissonProbability(expectedAwayGoals, 1) + poissonProbability(expectedAwayGoals, 2));
    return {
        finalHome: homeWin,
        finalDraw: adjustedDraw,
        finalAway: awayWin,
        pBTTSH,
        pO25H
    };
}

// PARSEO DE PRONÓSTICO DE TEXTO PLANO
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
        }
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
    }
    return {
        "1X2": {
            victoria_local: { probabilidad: (aiProbs.home * 100 || 0).toFixed(0) + '%', justificacion: aiJustification.home },
            empate: { probabilidad: (aiProbs.draw * 100 || 0).toFixed(0) + '%', justificacion: aiJustification.draw },
            victoria_visitante: { probabilidad: (aiProbs.away * 100 || 0).toFixed(0) + '%', justificacion: aiJustification.away }
        },
        "BTTS": {
            si: { probabilidad: (text.match(/BTTS.*Sí:\s*(\d+)%/)?.[1] || '0') + '%', justificacion: "" },
            no: { probabilidad: (text.match(/BTTS.*No:\s*(\d+)%/)?.[1] || '0') + '%', justificacion: "" }
        },
        "Goles": {
            mas_2_5: { probabilidad: (text.match(/Más de 2\.5:\s*(\d+)%/)?.[1] || '0') + '%', justificacion: "" },
            menos_2_5: { probabilidad: (text.match(/Menos de 2\.5:\s*(\d+)%/)?.[1] || '0') + '%', justificacion: "" }
        }
    };
}

// COMBINACIÓN DE PRONÓSTICOS
function getCombinedPrediction(stats, event, matchData) {
    const combined = {};
    const ai = event.pronostico_json || parsePlainText(event.pronostico || '', matchData);
    if (!ai || !ai["1X2"] || Object.values(ai["1X2"]).every(p => !p?.probabilidad)) {
        combined.header = "Análisis Estadístico Principal";
        combined.body = `<p>No se encontró un pronóstico de IA válido. El análisis se basa únicamente en datos estadísticos.</p>`;
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
        body += `<p>Ambos modelos coinciden en que la **${resultText}** es el resultado más probable.</p>`;
        body += `<p><strong>Justificación de la IA:</strong> ${reason}</p>`;
    } else {
        const statResult = statBest === 'home' ? `Victoria ${matchData.local}` : statBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
        const aiResult = aiBest === 'home' ? `Victoria ${matchData.local}` : aiBest === 'draw' ? 'Empate' : `Victoria ${matchData.visitante}`;
        header = "Discrepancia en Pronósticos ⚠️";
        body += `<p>El modelo estadístico (${formatPct(statMax)}) favorece la **${statResult}**, mientras que la IA (${formatPct(aiMax)}) se inclina por la **${aiResult}**.</p>`;
        body += `<p><strong>Análisis de la IA:</strong> ${ai["1X2"][aiBest === 'home' ? 'victoria_local' : aiBest === 'draw' ? 'empate' : 'victoria_visitante']?.justificacion || "Sin justificación detallada."}</p>`;
        body += `<p>Se recomienda cautela. Analiza la justificación de la IA para entender los factores externos que no considera el modelo estadístico.</p>`;
    }
    combined.header = header;
    combined.body = body;
    return combined;
}

// CÁLCULO COMPLETO
function calculateAll() {
    const leagueSelect = $('leagueSelect');
    const teamHomeSelect = $('teamHome');
    const teamAwaySelect = $('teamAway');
    if (!leagueSelect || !teamHomeSelect || !teamAwaySelect) {
        const details = $('details');
        if (details) details.innerHTML = '<div class="error"><strong>Error:</strong> Problema con la interfaz HTML. Verifica los elementos select.</div>';
        return;
    }
    const leagueCode = leagueSelect.value;
    const teamHome = teamHomeSelect.value;
    const teamAway = teamAwaySelect.value;
    if (!leagueCode || !teamHome || !teamAway) {
        const details = $('details');
        if (details) details.innerHTML = '<div class="warning"><strong>Advertencia:</strong> Selecciona una liga y ambos equipos para calcular el pronóstico.</div>';
        return;
    }
    const tH = findTeam(leagueCode, teamHome);
    const tA = findTeam(leagueCode, teamAway);
    if (!tH || !tA) {
        const details = $('details');
        if (details) details.innerHTML = `<div class="error"><strong>Error:</strong> Uno o ambos equipos no encontrados en la liga seleccionada.</div>`;
        return;
    }
    const stats = dixonColesProbabilities(tH, tA, leagueCode);
    const ligaName = leagueCodeToName[leagueCode];
    const event = allData.calendario[ligaName]?.find(e => e.local.trim().toLowerCase() === teamHome.trim().toLowerCase() && e.visitante.trim().toLowerCase() === teamAway.trim().toLowerCase());
    const matchData = { local: teamHome, visitante: teamAway };
    const probabilities = [
        { label: 'Local', value: stats.finalHome, id: 'pHome', type: 'Resultado' },
        { label: 'Empate', value: stats.finalDraw, id: 'pDraw', type: 'Resultado' },
        { label: 'Visitante', value: stats.finalAway, id: 'pAway', type: 'Resultado' },
        { label: 'Ambos Anotan', value: event?.pronostico_json ? parseFloat(event.pronostico_json.BTTS.si.probabilidad) / 100 : stats.pBTTSH, id: 'pBTTS', type: 'Mercado' },
        { label: 'Más de 2.5 goles', value: event?.pronostico_json ? parseFloat(event.pronostico_json.Goles.mas_2_5.probabilidad) / 100 : stats.pO25H, id: 'pO25', type: 'Mercado' }
    ];
    probabilities.forEach(p => {
        const el = $(p.id);
        if (el) el.textContent = formatPct(p.value);
    });
    const recommendations = probabilities.filter(p => p.value >= 0.3).sort((a, b) => b.value - a.value).slice(0, 3);
    let suggestionText = '<h3>Recomendaciones de Apuesta</h3><ul>';
    recommendations.forEach(r => {
        suggestionText += `<li><strong>${r.label} (${formatPct(r.value)})</strong> - ${r.type}</li>`;
    });
    suggestionText += '</ul>';
    const suggestion = $('suggestion');
    if (suggestion) suggestion.innerHTML = suggestionText;
    const detailedPredictionBox = $('detailed-prediction');
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
        if (detailedPredictionBox) detailedPredictionBox.innerHTML = html;
    } else if (event && event.pronostico) {
        const formattedPrediction = event.pronostico.replace(/\n/g, '<br>').replace(/###\s*(.*)/g, '<h4>$1</h4>');
        if (detailedPredictionBox) detailedPredictionBox.innerHTML = `<h3>Análisis de la IA</h3><div class="ia-prediction">${formattedPrediction}</div>`;
    } else if (detailedPredictionBox) {
        detailedPredictionBox.innerHTML = `<p>No hay un pronóstico de la IA disponible para este partido en la hoja de cálculo.</p>`;
    }
    const combined = getCombinedPrediction(stats, event || {}, matchData);
    const combinedPrediction = $('combined-prediction');
    if (combinedPrediction) combinedPrediction.innerHTML = `<h3>${combined.header}</h3>${combined.body}`;
}
