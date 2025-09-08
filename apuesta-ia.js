function poissonProbability(lambda, k) {
    if (lambda <= 0 || k < 0) return 0;
    return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function factorial(n) {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

function dixonColesProbabilities(tH, tA, league) {
    if (!tH || !tA || tH.pjHome <= 0 || tA.pjAway <= 0 || !teamsByLeague[league] || teamsByLeague[league].length === 0) {
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

    // Calcular tasas de ataque y defensa con valor mínimo para defensa
    const homeAttackRaw = (tH.gfHome || 0) / (tH.pjHome || 1);
    const homeDefenseRaw = Math.max((tH.gaHome || 0) / (tH.pjHome || 1), 0.1);
    const awayAttackRaw = (tA.gfAway || 0) / (tA.pjAway || 1);
    const awayDefenseRaw = Math.max((tA.gaAway || 0) / (tA.pjAway || 1), 0.1);

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

function parsePlainText(text, matchData) {
    console.log('[parsePlainText] Texto:', text);
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
            // Validar que las probabilidades sumen aproximadamente 100%
            if (Math.abs(aiProbs.home + aiProbs.draw + aiProbs.away - 1) > 0.05) {
                console.warn('[parsePlainText] Probabilidades 1X2 no suman 100%:', aiProbs);
                aiProbs.home = aiProbs.draw = aiProbs.away = 1/3;
            }
        } else {
            aiProbs.home = aiProbs.draw = aiProbs.away = 1/3;
        }
    } else {
        aiProbs.home = aiProbs.draw = aiProbs.away = 1/3;
    }

    const bttsSiMatch = text.match(/BTTS.*Sí:\s*(\d+)%/);
    const bttsNoMatch = text.match(/BTTS.*No:\s*(\d+)%/);
    const over25Match = text.match(/Más de 2\.5:\s*(\d+)%/);
    const under25Match = text.match(/Menos de 2\.5:\s*(\d+)%/);

    let bttsSi = bttsSiMatch ? parseFloat(bttsSiMatch[1]) : 50;
    let bttsNo = bttsNoMatch ? parseFloat(bttsNoMatch[1]) : 50;
    let over25 = over25Match ? parseFloat(over25Match[1]) : 50;
    let under25 = under25Match ? parseFloat(under25Match[1]) : 50;

    // Validar BTTS
    if (Math.abs(bttsSi + bttsNo - 100) > 5) {
        console.warn('[parsePlainText] BTTS Sí + No no suma 100%:', { bttsSi, bttsNo });
        bttsSi = bttsNo = 50;
    }

    // Validar Más/Menos 2.5
    if (Math.abs(over25 + under25 - 100) > 5) {
        console.warn('[parsePlainText] Goles Más/Menos 2.5 no suma 100%:', { over25, under25 });
        over25 = under25 = 50;
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
            victoria_local: { probabilidad: (aiProbs.home * 100).toFixed(0) + '%', justificacion: aiJustification.home },
            empate: { probabilidad: (aiProbs.draw * 100).toFixed(0) + '%', justificacion: aiJustification.draw },
            victoria_visitante: { probabilidad: (aiProbs.away * 100).toFixed(0) + '%', justificacion: aiJustification.away }
        },
        "BTTS": {
            si: { probabilidad: bttsSi.toFixed(0) + '%', justificacion: "" },
            no: { probabilidad: bttsNo.toFixed(0) + '%', justificacion: "" }
        },
        "Goles": {
            mas_2_5: { probabilidad: over25.toFixed(0) + '%', justificacion: "" },
            menos_2_5: { probabilidad: under25.toFixed(0) + '%', justificacion: "" }
        }
    };
}

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
    console.log('Stats:', stats);
    console.log('Pronóstico IA:', event?.pronostico_json);

    // Obtener probabilidades de la IA
    const iaHome = event?.pronostico_json ? parseFloat(event.pronostico_json["1X2"].victoria_local.probabilidad) / 100 : stats.finalHome;
    const iaDraw = event?.pronostico_json ? parseFloat(event.pronostico_json["1X2"].empate.probabilidad) / 100 : stats.finalDraw;
    const iaAway = event?.pronostico_json ? parseFloat(event.pronostico_json["1X2"].victoria_visitante.probabilidad) / 100 : stats.finalAway;
    const iaBTTS = event?.pronostico_json ? parseFloat(event.pronostico_json.BTTS.si.probabilidad) / 100 : stats.pBTTSH;
    const iaO25 = event?.pronostico_json ? parseFloat(event.pronostico_json.Goles.mas_2_5.probabilidad) / 100 : stats.pO25H;

    // Promediar probabilidades
    const probabilities = [
        { label: 'Local', value: event?.pronostico_json ? (stats.finalHome + iaHome) / 2 : stats.finalHome, id: 'pHome', type: 'Resultado' },
        { label: 'Empate', value: event?.pronostico_json ? (stats.finalDraw + iaDraw) / 2 : stats.finalDraw, id: 'pDraw', type: 'Resultado' },
        { label: 'Visitante', value: event?.pronostico_json ? (stats.finalAway + iaAway) / 2 : stats.finalAway, id: 'pAway', type: 'Resultado' },
        { label: 'Ambos Anotan', value: event?.pronostico_json ? (stats.pBTTSH + iaBTTS) / 2 : stats.pBTTSH, id: 'pBTTS', type: 'Mercado' },
        { label: 'Más de 2.5 goles', value: event?.pronostico_json ? (stats.pO25H + iaO25) / 2 : stats.pO25H, id: 'pO25', type: 'Mercado' }
    ];

    probabilities.forEach(p => {
        const el = dom[p.id];
        if (el) el.textContent = formatPct(p.value);
    });

    // Actualizar análisis detallado
    const justifications = event?.pronostico_json ? {
        Local: event.pronostico_json["1X2"].victoria_local.justificacion,
        Empate: event.pronostico_json["1X2"].empate.justificacion,
        Visitante: event.pronostico_json["1X2"].victoria_visitante.justificacion
    } : {
        Local: 'Sin análisis detallado de la IA.',
        Empate: 'Sin análisis detallado de la IA.',
        Visitante: 'Sin análisis detallado de la IA.'
    };

    const detailsHTML = `
        <h3>Análisis del Partido</h3>
        <p><strong>${teamHome}:</strong> ${justifications.Local}</p>
        <p><strong>Empate:</strong> ${justifications.Empate}</p>
        <p><strong>${teamAway}:</strong> ${justifications.Visitante}</p>
    `;
    if (dom.details) dom.details.innerHTML = detailsHTML;

    // Actualizar otras visualizaciones si es necesario
    // ...
}
