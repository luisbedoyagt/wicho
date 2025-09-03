/**
 * @fileoverview Google Apps Script para descargar estadísticas y pronósticos de fútbol,
 * con un sistema agresivo de caché, control de cuota, verificación en hojas para evitar fetches innecesarios,
 * y limpieza de TODOS los sufijos entre paréntesis en los nombres de los equipos para todas las ligas.
 * Evita borrar datos existentes a menos que haya nuevos datos válidos.
 */

// ----------------------
// CONFIGURACIÓN DE LIGAS
// ----------------------
const ligas = {
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
  "usa.1": "EstadosUnidos_MLS",
  "bra.1": "Brasil_Brasileirao",
  "gua.1": "Guatemala_LigaNacional",
  "crc.1": "CostaRica_LigaPromerica",
  "hon.1": "Honduras_LigaNacional",
  "ksa.1": "Arabia_Saudi_ProLeague",
  "fifa.worldq.conmebol": "Eliminatorias_CONMEBOL",
  "fifa.worldq.concacaf": "Eliminatorias_CONCACAF",
  "fifa.worldq.uefa": "Eliminatorias_UEFA"
};

// ----------------------
// CONFIGURACIÓN GENERAL
// ----------------------
const CALENDAR_SHEET_NAME = "Calendario_Futbol";
const CACHE_EXPIRATION = 6 * 3600; // 6 horas para stats
const CACHE_CALENDAR_EXP = 2 * 3600; // 2 horas para calendario
const CACHE_PREDICTION_EXP = 24 * 3600; // 24 horas para pronósticos Gemini
const CACHE_LIMIT_BYTES = 90000;
const QUOTA_LIMIT = 1500;
const QUOTA_THRESHOLD = 500;
const PRIORITY_LEAGUES = ["eng.1", "esp.1", "ita.1", "ger.1", "fra.1"];
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const FRESHNESS_THRESHOLD = 6 * 3600 * 1000; // 6 horas en ms

// ----------------------
// SISTEMA DE CUOTAS
// ----------------------
function checkQuota() {
  const props = PropertiesService.getScriptProperties();
  let count = Number(props.getProperty("fetchCount")) || 0;
  const remaining = QUOTA_LIMIT - count;
  Logger.log(`📊 UrlFetch usados: ${count} | Restantes: ${remaining}`);
  return remaining > QUOTA_THRESHOLD;
}

function increaseQuota(by = 1) {
  const props = PropertiesService.getScriptProperties();
  let count = Number(props.getProperty("fetchCount")) || 0;
  props.setProperty("fetchCount", count + by);
}

function resetQuota() {
  PropertiesService.getScriptProperties().deleteProperty("fetchCount");
  Logger.log("🔄 Contador de cuota reiniciado");
}

function crearTriggerResetQuota() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "resetQuota") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("resetQuota").timeBased().atHour(0).everyDays(1).create();
}

// ----------------------
// LIMPIEZA DE NOMBRES
// ----------------------
function cleanTeamName(name) {
  if (!name || typeof name !== "string") {
    Logger.log(`⚠️ Nombre inválido: ${name}. Devolviendo 'Equipo Desconocido'`);
    return "Equipo Desconocido";
  }
  const cleanName = name.replace(/\s*\([^)]*\)/g, "").trim();
  const finalName = cleanName || "Equipo Desconocido";
  Logger.log(`🧹 Nombre original: ${name} → Limpio: ${finalName}`);
  return finalName;
}

// ----------------------
// HELPERS: Fecha/Hora
// ----------------------
function formatearGT(isoDate) {
  const d = new Date(isoDate);
  return {
    isoDate: d.toISOString(),
    fecha: Utilities.formatDate(d, "America/Guatemala", "yyyy-MM-dd"),
    hora: Utilities.formatDate(d, "America/Guatemala", "HH:mm")
  };
}

function isHoraFutura(horaPartido, horaActual) {
  if (!horaPartido || !horaActual) return false;
  const [hP, mP] = horaPartido.split(':').map(Number);
  const [hA, mA] = horaActual.split(':').map(Number);
  if ([hP, mP, hA, mA].some(isNaN)) return false;
  return (hP * 60 + mP) > (hA * 60 + mA);
}

function isDataFresh(lastUpdated) {
  if (!lastUpdated) return false;
  const lastTime = new Date(lastUpdated).getTime();
  const now = new Date().getTime();
  return now - lastTime < FRESHNESS_THRESHOLD;
}

// ----------------------
// FETCH CON CACHÉ AGRESIVO
// ----------------------
function fetchWithCacheAggressive(url, cacheKey, exp = CACHE_EXPIRATION) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached && cached !== "null") {
    Logger.log(`✅ Usando caché para ${cacheKey}`);
    return JSON.parse(cached);
  }
  if (!checkQuota()) {
    Logger.log(`⚠️ Cuota insuficiente para ${url}`);
    return null;
  }
  try {
    Logger.log(`📡 Fetching URL: ${url}`);
    const resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true
    });
    increaseQuota();
    if (resp.getResponseCode() === 200) {
      const dataText = resp.getContentText();
      if (dataText.length <= CACHE_LIMIT_BYTES) {
        cache.put(cacheKey, dataText, exp);
        Logger.log(`✅ Datos almacenados en caché para ${cacheKey}`);
      }
      return JSON.parse(dataText);
    } else {
      Logger.log(`❌ Respuesta no válida (${resp.getResponseCode()}) para ${url}`);
      cache.put(cacheKey, JSON.stringify(null), 300); // Caché de error corto
      return null;
    }
  } catch (e) {
    Logger.log(`❌ Error al hacer fetch a ${url}: ${e}`);
    cache.put(cacheKey, JSON.stringify(null), 300); // Caché de error corto
    return null;
  }
}

// ----------------------
// OBTENER DATOS DE LA API DE IA
// ----------------------
function setApiKeys() {
  const primaryKey = 'TU_PRIMERA_API_KEY_AQUI'; // ⚠️ Reemplaza esto con tu clave principal
  const secondaryKey = 'TU_SEGUNDA_API_KEY_AQUI'; // ⚠️ Reemplaza esto con tu clave de respaldo
  const props = PropertiesService.getScriptProperties();
  props.setProperty('PRIMARY_GEMINI_API_KEY', primaryKey);
  props.setProperty('SECONDARY_GEMINI_API_KEY', secondaryKey);
  Logger.log('✅ Ambas claves API guardadas con éxito.');
}

function getPredictionFromApi(matchData) {
  const props = PropertiesService.getScriptProperties();
  const primaryKey = props.getProperty('PRIMARY_GEMINI_API_KEY');
  const secondaryKey = props.getProperty('SECONDARY_GEMINI_API_KEY');
  const keysToUse = [primaryKey, secondaryKey].filter(Boolean);
  if (keysToUse.length === 0) {
    Logger.log('❌ Error: No se encontraron claves API configuradas.');
    return "N/A";
  }
  const prompt = `Actúa como un analista de fútbol experto.
  Genera un pronóstico detallado en formato JSON para el partido entre ${matchData.local} (local) y ${matchData.visitante} (visitante) en ${matchData.liga} el ${matchData.fecha}.
  Antes de generar el JSON, investiga los siguientes datos:
  1. Rendimiento reciente (últimos 5 partidos) de ${matchData.local} y ${matchData.visitante}.
  2. Historial de enfrentamientos directos (head-to-head) entre ambos equipos.
  3. Tendencias de goles por partido y goles concedidos para cada equipo.
  4. Promedio de tiros de esquina por partido para cada equipo.
  El JSON debe tener la siguiente estructura estricta.
  {
    "1X2": {
      "victoria_local": {"probabilidad": "XX%", "justificacion": "Basado en [dato 1] y [dato 2]"},
      "empate": {"probabilidad": "XX%", "justificacion": "Breve justificación"},
      "victoria_visitante": {"probabilidad": "XX%", "justificacion": "Basado en [dato 1] y [dato 2]"}
    },
    "BTTS": {
      "si": {"probabilidad": "XX%", "justificacion": "Breve justificación basada en tendencias de goles"},
      "no": {"probabilidad": "XX%", "justificacion": "Breve justificación basada en tendencias de goles"}
    },
    "Goles": {
      "mas_2_5": {"probabilidad": "XX%", "justificacion": "Breve justificación basada en promedios de goles"},
      "menos_2_5": {"probabilidad": "XX%", "justificacion": "Breve justificación basada en promedios de goles"}
    },
    "Esquinas": {
      "mas_8_5": {"probabilidad": "XX%", "justificacion": "Breve justificación basada en promedios de tiros de esquina"},
      "menos_8_5": {"probabilidad": "XX%", "justificacion": "Breve justificación basada en promedios de tiros de esquina"}
    }
  }
  Asegúrate de que la suma de las probabilidades en cada sección sea 100%. No incluyas ningún texto fuera del objeto JSON.`;
  const payload = JSON.stringify({
    contents: [{
      role: "user",
      parts: [{
        text: prompt
      }]
    }],
    tools: [{
      "google_search": {}
    }],
    systemInstruction: {
      parts: [{
        text: "Eres un analista de fútbol. Tu única tarea es devolver la predicción en el formato JSON solicitado. No des texto introductorio, ni explicaciones adicionales, ni formato markdown. Solo el JSON."
      }]
    },
    generationConfig: {
      temperature: 0.5,
      topP: 0.8,
      topK: 40
    }
  });
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': payload,
    'muteHttpExceptions': true
  };
  for (const apiKey of keysToUse) {
    const urlWithKey = `${GEMINI_API_URL}?key=${apiKey}`;
    try {
      Logger.log(`📡 Solicitando pronóstico a Gemini para ${matchData.local} vs ${matchData.visitante}`);
      const response = UrlFetchApp.fetch(urlWithKey, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      if (responseCode !== 200) {
        Logger.log(`❌ Error de la API (${responseCode}): ${responseText}`);
        if (responseCode === 429) {
          Logger.log(`❌ Cuota excedida para esta clave. Intentando con la siguiente...`);
          continue;
        }
        return `Error API: ${responseCode}`;
      }
      const predictionData = JSON.parse(responseText);
      const jsonText = predictionData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!jsonText) {
        Logger.log('❌ La respuesta JSON no contiene el campo de texto esperado.');
        Logger.log(`Respuesta completa: ${responseText}`);
        return "Error de formato de respuesta";
      }
      const cleanedText = jsonText.substring(jsonText.indexOf('{'), jsonText.lastIndexOf('}') + 1);
      try {
        const json = JSON.parse(cleanedText);
        // NUEVA LÓGICA DE SALIDA
        return `Análisis del Partido: ${matchData.local} vs. ${matchData.visitante}\n\n${matchData.local}: ${json["1X2"].victoria_local.justificacion}\nEmpate: ${json["1X2"].empate.justificacion}\n${matchData.visitante}: ${json["1X2"].victoria_visitante.justificacion}\n\nProbabilidades:\n${json["1X2"].victoria_local.probabilidad} para ${matchData.local}\n${json["1X2"].empate.probabilidad} para el Empate\n${json["1X2"].victoria_visitante.probabilidad} para ${matchData.visitante}\n\nAmbos Anotan (BTTS):\nSí: ${json.BTTS.si.probabilidad}\nNo: ${json.BTTS.no.probabilidad}\n\nGoles Totales (Más/Menos 2.5):\nMás de 2.5: ${json.Goles.mas_2_5.probabilidad}\nMenos de 2.5: ${json.Goles.menos_2_5.probabilidad}`;
      } catch (e) {
        Logger.log(`❌ Error al analizar JSON: ${e.message}. Texto recibido: ${cleanedText}`);
        return `Error al analizar JSON`;
      }
    } catch (e) {
      Logger.log('❌ Error de la solicitud: ' + e.message + " | URL: " + urlWithKey);
      return "Error de solicitud";
    }
  }
  Logger.log('❌ Todas las claves de la API han fallado o agotado la cuota.');
  return "Cuota Agotada";
}

function getPredictionWithCache(matchData) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `gemini_prediction_${matchData.local}_${matchData.visitante}_${matchData.fecha}`;
  const cachedPrediction = cache.get(cacheKey);
  if (cachedPrediction) {
    Logger.log(`✅ Pronóstico en caché para ${matchData.local} vs ${matchData.visitante}`);
    return cachedPrediction;
  } else {
    const newPrediction = getPredictionFromApi(matchData);
    if (newPrediction && newPrediction !== "Error API" && newPrediction !== "Error de solicitud" && newPrediction !== "Cuota Agotada") {
      cache.put(cacheKey, newPrediction, CACHE_PREDICTION_EXP);
      Logger.log(`✅ Nuevo pronóstico almacenado en caché para ${cacheKey}`);
    }
    return newPrediction;
  }
}

// ----------------------
// OBTENER DATOS DE HOJA
// ----------------------
function getSheetData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = {
    calendario: {},
    ligas: {}
  };

  // Calendario
  const calSheet = ss.getSheetByName(CALENDAR_SHEET_NAME);
  if (calSheet) {
    const values = calSheet.getDataRange().getValues();
    const calData = {};
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0]) continue;
      const liga = row[0];
      if (!calData[liga]) calData[liga] = [];
      calData[liga].push({
        liga,
        fecha: row[1],
        local: cleanTeamName(row[2]),
        visitante: cleanTeamName(row[3]),
        estadio: row[4] || "Por confirmar",
        pronostico: row[5] || "",
        lastUpdated: row[6] || ""
      });
    }
    data.calendario = calData;
  }

  // Ligas
  for (const ligaId in ligas) {
    const sheet = ss.getSheetByName(ligas[ligaId]);
    if (!sheet) continue;
    const values = sheet.getDataRange().getValues();
    const leagueData = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0]) continue;
      leagueData.push({
        name: cleanTeamName(row[0]),
        rank: row[1],
        gamesPlayed: row[2],
        wins: row[3],
        ties: row[4],
        losses: row[5],
        points: row[6],
        goalsFor: row[7],
        goalsAgainst: row[8],
        goalsDiff: row[9],
        form: row[10] || "",
        gamesPlayedHome: row[11],
        winsHome: row[12],
        tiesHome: row[13],
        lossesHome: row[14],
        goalsForHome: row[15],
        goalsAgainstHome: row[16],
        gamesPlayedAway: row[17],
        winsAway: row[18],
        tiesAway: row[19],
        lossesAway: row[20],
        goalsForAway: row[21],
        goalsAgainstAway: row[22],
        logoUrl: row[23] || "",
        lastUpdated: row[24] || ""
      });
    }
    data.ligas[ligaId] = leagueData;
  }

  return data;
}

// ----------------------
// CALENDARIO (partidos futuros de hoy y mañana)
// ----------------------
function actualizarCalendario() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CALENDAR_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CALENDAR_SHEET_NAME);
    ss.moveActiveSheet(1);
  }
  const headers = ["Liga", "Fecha", "Equipo Local", "Equipo Visitante", "Estadio", "Pronóstico IA", "Last Updated"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f0f0f0");

  const now = new Date();
  const horaActual = Utilities.formatDate(now, "America/Guatemala", "HH:mm");
  const todayFecha = Utilities.formatDate(now, "America/Guatemala", "yyyy-MM-dd");

  // Leer datos existentes y crear mapa por clave única
  const existingValues = sheet.getDataRange().getValues();
  const matchMap = {};
  const rowsToDelete = [];
  for (let i = 1; i < existingValues.length; i++) {
    const row = existingValues[i];
    if (!row[0]) continue;
    const key = `${row[0]}_${row[1]}_${cleanTeamName(row[2])}_${cleanTeamName(row[3])}`.toLowerCase();
    matchMap[key] = {
      rowIndex: i + 1,
      estadio: row[4],
      pronostico: row[5],
      lastUpdated: row[6]
    };
    if (row[1] < todayFecha) {
      rowsToDelete.push(i + 1);
    }
  }
  rowsToDelete.sort((a, b) => b - a);
  rowsToDelete.forEach(row => sheet.deleteRow(row));

  const partidosSemana = [];
  let needsWrite = false;

  for (let i = 0; i < 1; i++) {
    const tempDate = new Date(now);
    tempDate.setDate(now.getDate() + i);
    const fecha = Utilities.formatDate(tempDate, "America/Guatemala", "yyyy-MM-dd");
    const fechaUrl = Utilities.formatDate(tempDate, "America/Guatemala", "yyyyMMdd");

    for (const ligaId in ligas) {
      const ligaName = ligas[ligaId];
      const url = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${ligaId}/scoreboard?dates=${fechaUrl}`;
      const cacheKey = `scoreboard_${ligaId}_${fechaUrl}`;
      
      let data = fetchWithCacheAggressive(url, cacheKey, CACHE_CALENDAR_EXP);
      if (!data?.events?.length) {
        Logger.log(`⚠️ No hay eventos para ${ligaName} en ${fecha}`);
        continue;
      }

      data.events.forEach(ev => {
        const comp = ev.competitions?.[0];
        if (!comp) return;
        const { isoDate, fecha: matchFecha, hora } = formatearGT(ev.date);

        if (i === 0 && !isHoraFutura(hora, horaActual)) return;

        const home = comp.competitors?.find(c => c.homeAway === "home")?.team?.displayName || "";
        const away = comp.competitors?.find(c => c.homeAway === "away")?.team?.displayName || "";
        const venue = comp.venue?.fullName || "Por confirmar";

        const homeName = cleanTeamName(home);
        const awayName = cleanTeamName(away);

        const matchKey = `${ligaName}_${matchFecha}_${homeName}_${awayName}`.toLowerCase();
        const existing = matchMap[matchKey];

        let pronostico = existing?.pronostico || "";
        let estadio = venue;

        const isFresh = isDataFresh(existing?.lastUpdated);
        if (!pronostico || !isFresh) {
          const matchData = {
            local: homeName,
            visitante: awayName,
            liga: ligaId,
            fecha: matchFecha
          };
          pronostico = getPredictionWithCache(matchData);
          needsWrite = true;
        }

        if (existing && existing.estadio !== venue) {
          estadio = venue;
          needsWrite = true;
        }

        partidosSemana.push({
          liga: ligaName,
          isoDate,
          home: homeName,
          away: awayName,
          venue: estadio,
          pronostico,
          hora,
          fecha: matchFecha
        });
      });
    }
  }

  if (partidosSemana.length === 0 && Object.keys(matchMap).length === 0) {
    sheet.getRange(2, 1).setValue("⚠️ No se encontraron partidos futuros");
    Logger.log("⚠️ No se encontraron partidos futuros para ninguna liga");
    return;
  }

  if (needsWrite || partidosSemana.length > 0) {
    partidosSemana.sort((a, b) => new Date(`${a.fecha}T${a.hora}:00`).getTime() - new Date(`${b.fecha}T${b.hora}:00`).getTime());
    const nowStr = new Date().toISOString();
    partidosSemana.forEach(p => {
      const matchKey = `${p.liga}_${p.fecha}_${p.home}_${p.away}`.toLowerCase();
      const rowData = [p.liga, p.isoDate, p.home, p.away, p.venue, p.pronostico, nowStr];
      const existing = matchMap[matchKey];
      if (existing) {
        sheet.getRange(existing.rowIndex, 1, 1, headers.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
    });
    const dataRange = sheet.getDataRange();
    dataRange.sort({column: 2, ascending: true});
    Logger.log("✅ Calendario actualizado con nuevos datos");
  } else {
    Logger.log("✅ No se requiere actualizar el calendario (datos frescos)");
  }

  sheet.autoResizeColumns(1, headers.length);
  sheet.getRange(1, 1, sheet.getLastRow(), headers.length).setBorder(true, true, true, true, true, true);
}

// ----------------------
// STANDINGS: todas las ligas
// ----------------------
function actualizarLigasCompleto(ligasSubset = Object.keys(ligas), useCacheOnly = false, force = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const ligaId of ligasSubset) {
    const sheetName = ligas[ligaId];
    let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    const headers = [
      "Equipo", "Rank", "PJ", "Victorias", "Empates", "Derrotas", "Puntos", "GF", "GC", "GD", "Forma",
      "PJ Local", "Victorias Local", "Empates Local", "Derrotas Local", "GF Local", "GC Local",
      "PJ Visitante", "Victorias Visitante", "Empates Visitante", "Derrotas Visitante", "GF Visitante", "GC Visitante", "Logo URL",
      "Last Updated"
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f0f0f0");

    // Leer datos existentes y crear mapa por equipo
    const existingValues = sheet.getDataRange().getValues();
    const teamMap = {};
    let allFresh = true;
    let hasData = false;
    for (let i = 1; i < existingValues.length; i++) {
      const row = existingValues[i];
      if (!row[0]) continue;
      hasData = true;
      const teamName = cleanTeamName(row[0]);
      teamMap[teamName.toLowerCase()] = {
        rowIndex: i + 1,
        data: row.slice(0, 24),
        lastUpdated: row[24]
      };
      if (!force && isDataFresh(row[24])) {
        // Solo considera fresco si la fila tiene datos válidos
      } else {
        allFresh = false;
      }
    }

    // Si no hay datos o force=true, no saltar fetch
    if (force || !hasData || !allFresh) {
      Logger.log(`🔄 Actualizando ${sheetName} (force=${force}, hasData=${hasData}, allFresh=${allFresh})`);
    } else {
      Logger.log(`✅ Datos frescos en hoja para ${sheetName}. Saltando fetch.`);
      continue;
    }

    const output = [];
    let hasChanges = false;

    const teamsUrl = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${ligaId}/teams`;
    const teamsCacheKey = `teams_${ligaId}`;
    let teamsData = fetchWithCacheAggressive(teamsUrl, teamsCacheKey);
    
    if (!teamsData?.sports?.[0]?.leagues?.[0]?.teams?.length) {
      Logger.log(`❌ No se encontraron datos válidos para ${sheetName} en API o caché. Manteniendo datos existentes.`);
      if (!hasData) {
        sheet.getRange(2, 1).setValue(`⚠️ No se encontraron datos para ${sheetName}`);
      }
      continue;
    }

    const teams = teamsData.sports[0].leagues[0].teams;
    const teamUrls = teams.map(t => `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${ligaId}/teams/${t.team.id}`);
    const teamCacheKeys = teams.map(t => `team_${ligaId}_${t.team.id}`);

    if (!useCacheOnly && checkQuota()) {
      const responses = UrlFetchApp.fetchAll(teamUrls.map(url => ({ url, muteHttpExceptions: true })));
      increaseQuota(responses.length);
      responses.forEach((resp, index) => {
        const cacheKey = teamCacheKeys[index];
        if (resp.getResponseCode() === 200) {
          const dataText = resp.getContentText();
          if (dataText.length <= CACHE_LIMIT_BYTES) {
            CacheService.getScriptCache().put(cacheKey, dataText, CACHE_EXPIRATION);
            Logger.log(`✅ Datos de equipo almacenados en caché para ${cacheKey}`);
          }
        } else {
          Logger.log(`❌ Error fetching team data for ${teamUrls[index]}: ${resp.getResponseCode()}`);
        }
      });
    }

    teams.forEach((t, index) => {
      const cacheKey = teamCacheKeys[index];
      const cached = CacheService.getScriptCache().get(cacheKey);
      let teamData = cached ? JSON.parse(cached) : null;
      if (!teamData?.team?.record?.items?.[0]?.stats) {
        Logger.log(`❌ No stats available for team ${t.team.displayName} in ${sheetName}`);
        return;
      }

      const stats = teamData.team.record.items[0].stats;
      const getStat = name => stats.find(st => st.name === name)?.value || 0;
      const cleanName = cleanTeamName(teamData.team.displayName);
      if (cleanName === "Equipo Desconocido") {
        Logger.log(`⚠️ Nombre inválido para equipo en ${sheetName}. Original: ${teamData.team.displayName}`);
        return;
      }

      const newData = [
        cleanName,
        getStat("rank"),
        getStat("gamesPlayed"),
        getStat("wins"),
        getStat("ties"),
        getStat("losses"),
        getStat("points"),
        getStat("pointsFor"),
        getStat("pointsAgainst"),
        getStat("pointsFor") - getStat("pointsAgainst"),
        "",
        getStat("homeGamesPlayed"), getStat("homeWins"), getStat("homeTies"), getStat("homeLosses"), getStat("homePointsFor"), getStat("homePointsAgainst"),
        getStat("awayGamesPlayed"), getStat("awayWins"), getStat("awayTies"), getStat("awayLosses"), getStat("awayPointsFor"), getStat("awayPointsAgainst"),
        teamData.team.logos?.[0]?.href || ""
      ];

      const teamNameKey = cleanName.toLowerCase();
      const existing = teamMap[teamNameKey];

      let isSame = true;
      if (existing) {
        for (let j = 0; j < newData.length; j++) {
          if (newData[j] !== existing.data[j]) {
            isSame = false;
            break;
          }
        }
      } else {
        isSame = false;
      }

      if (!isSame) hasChanges = true;
      output.push({ data: newData, isNewOrChanged: !isSame });
    });

    if (output.length === 0) {
      Logger.log(`❌ No se generaron datos válidos para ${sheetName}. Manteniendo datos existentes.`);
      if (!hasData) {
        sheet.getRange(2, 1).setValue(`⚠️ No se encontraron datos para ${sheetName}`);
      }
      continue;
    }

    // Solo limpiar la hoja si hay datos válidos para escribir
    if (hasChanges || force || !hasData) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
        Logger.log(`🧹 Datos existentes limpiados en ${sheetName} (filas 2 a ${lastRow})`);
      } else {
        Logger.log(`ℹ️ No hay datos para limpiar en ${sheetName} (solo encabezados)`);
      }

      output.sort((a, b) => (a.data[1] || 9999) - (b.data[1] || 9999));
      const nowStr = new Date().toISOString();

      const dataStartRow = 2;
      output.forEach((item, idx) => {
        Logger.log(`✍️ Escribiendo equipo: ${item.data[0]} en ${sheetName}`);
        sheet.getRange(dataStartRow + idx, 1, 1, headers.length).setValues([[...item.data, nowStr]]);
      });
      Logger.log(`✅ Actualizados datos para ${sheetName} (cambios detectados o forzado).`);
    } else {
      Logger.log(`✅ No cambios en ${sheetName}. Saltando update.`);
    }

    sheet.autoResizeColumns(1, headers.length);
    sheet.getRange(1, 1, sheet.getLastRow(), headers.length).setBorder(true, true, true, true, true, true);
  }
}

// ----------------------
// DO GET (para web app)
// ----------------------
function doGet(e) {
  const tipo = e.parameter.tipo || "todo";
  const ligaParam = e.parameter.liga || null;
  const update = e.parameter.update === "true";
  const force = e.parameter.force === "true";
  
  // Si se pide una actualización, ejecutarla antes de leer los datos.
  if (update) {
    if (tipo === "calendario") {
      actualizarCalendario();
    } else if (tipo === "liga" && ligaParam && ligas[ligaParam]) {
      actualizarLigasCompleto([ligaParam], false, force);
    } else {
      actualizarTodo(force);
    }
  }
  
  // Después de la posible actualización, leer los datos y enviarlos.
  const data = getSheetData();
  
  // La línea siguiente asegura que la respuesta tenga el formato correcto y se entregue al cliente.
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function actualizarTodo(force = false) {
  // Limpiar caché al inicio para evitar datos corruptos
  clearCache();
  if (!checkQuota()) {
    Logger.log("⚠️ Cuota baja. Solo calendario y standings de ligas prioritarias con caché.");
    actualizarCalendario();
    actualizarLigasCompleto(PRIORITY_LEAGUES, true, force);
    return;
  }
  actualizarCalendario();
  actualizarLigasCompleto(Object.keys(ligas), false, force);
}

// ----------------------
// UTILIDADES PARA DEPURACIÓN
// ----------------------
function clearCache() {
  const cache = CacheService.getScriptCache();
  const keys = [];
  for (const ligaId in ligas) {
    keys.push(`teams_${ligaId}`);
    keys.push(`standings_${ligaId}`);
    const teamsUrl = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${ligaId}/teams`;
    const teamsData = fetchWithCacheAggressive(teamsUrl, `teams_${ligaId}`);
    if (teamsData?.sports?.[0]?.leagues?.[0]?.teams) {
      teamsData.sports[0].leagues[0].teams.forEach(t => {
        keys.push(`team_${ligaId}_${t.team.id}`);
      });
    }
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const tempDate = new Date(now);
      tempDate.setDate(now.getDate() + i);
      const fechaUrl = Utilities.formatDate(tempDate, "America/Guatemala", "yyyyMMdd");
      keys.push(`scoreboard_${ligaId}_${fechaUrl}`);
    }
  }
  cache.removeAll(keys);
  Logger.log("✅ Caché limpiado para todas las ligas");
}

// ----------------------
// LIMPIAR HOJAS (PARA PRUEBA)
// ----------------------
function clearTestSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const ligaId in ligas) {
    const sheetName = ligas[ligaId];
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 25).clearContent();
        Logger.log(`🧹 Hoja ${sheetName} limpiada`);
      } else {
        Logger.log(`ℹ️ Hoja ${sheetName} ya está vacía (solo encabezados)`);
      }
    }
  }
}
