// ============================================================
//  LEE LAS CREDENCIALES DE LAS VARIABLES DE ENTORNO (NETLIFY)
// ============================================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ============================================================
//  UMBRALES CONFIGURABLES (por defecto 2 y 4 para ser más sensible)
//  Puedes cambiarlos en Netlify con:
//    UMBRAL_CAJA1 = 2
//    UMBRAL_CAJA2 = 4
// ============================================================
const UMBRAL_CAJA1 = parseInt(process.env.UMBRAL_CAJA1) || 2;
const UMBRAL_CAJA2 = parseInt(process.env.UMBRAL_CAJA2) || 4;

console.log(`🔧 Umbral Caja1: ${UMBRAL_CAJA1}, Umbral Caja2: ${UMBRAL_CAJA2}`);

// ============================================================
//  LISTA COMPLETA DE MONEDAS (TODAS ACTIVAS)
// ============================================================
const COINS_ACTIVE = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT",
  "SOLUSDT", "XRPUSDT", "ADAUSDT", "LINKUSDT", "LTCUSDT", "DOTUSDT", "AVAXUSDT",
  "DOGEUSDT", "PEPEUSDT", "ENAUSDT", "TLMUSDT", "POLUSDT", "HBARUSDT",
  "CHZUSDT", "SHIBUSDT", "TWTUSDT"
];

// ============================================================
//  FUNCIONES DE INDICADORES (idénticas a tu web)
// ============================================================
function calculateEMA(data, period) {
  if (!data || data.length < period) return null;
  const k = 2 / (period + 1);
  let sum = 0; for (let i = 0; i < period; i++) sum += data[i];
  let ema = sum / period;
  for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
}

function calculateRSI(data, period) {
  if (!data || data.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) { const d = data[i] - data[i - 1]; if (d > 0) gains += d; else losses += Math.abs(d); }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i] - data[i - 1];
    if (d > 0) { avgGain = (avgGain * (period - 1) + d) / period; avgLoss = (avgLoss * (period - 1)) / period; }
    else { avgGain = (avgGain * (period - 1)) / period; avgLoss = (avgLoss * (period - 1) + Math.abs(d)) / period; }
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calculateMACD(data) {
  if (!data || data.length < 35) return null;
  const ema = (arr, p) => {
    const k = 2 / (p + 1);
    let s = 0;
    for (let i = 0; i < p; i++) s += arr[i];
    let e = s / p;
    const out = [];
    for (let i = 0; i < p - 1; i++) out.push(null);
    out.push(e);
    for (let i = p; i < arr.length; i++) {
      e = arr[i] * k + e * (1 - k);
      out.push(e);
    }
    return out;
  };
  const e12 = ema(data, 12), e26 = ema(data, 26);
  const macdArr = [];
  for (let i = 0; i < data.length; i++) {
    if (e12[i] !== null && e26[i] !== null) macdArr.push(e12[i] - e26[i]);
  }
  if (macdArr.length === 0) return null;
  const line = macdArr[macdArr.length - 1];
  if (macdArr.length < 9) return { line, signal: null };
  const sig = ema(macdArr, 9);
  return { line, signal: sig[sig.length - 1] };
}

function calculateATR(closes, highs, lows, period = 14) {
  if (closes.length < period + 1) return null;
  const tr = [];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (tr.length < period) return null;
  let sum = 0;
  for (let i = tr.length - period; i < tr.length; i++) sum += tr[i];
  return sum / period;
}

function calculateSMA(data, period) {
  if (!data || data.length < period) return null;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) sum += data[i];
  return sum / period;
}

// ============================================================
//  ANÁLISIS DE CAJA 1
// ============================================================
function analyzeBox1(closes, highs, lows, volumes) {
  const price = closes[closes.length - 1];
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const ema50 = calculateEMA(closes, 50);
  const avgVol = calculateSMA(volumes, 20);
  const volRatio = avgVol && avgVol > 0 ? volumes[volumes.length - 1] / avgVol : 1;
  const atr = calculateATR(closes, highs, lows, 14);

  let bull = 0, bear = 0;
  if (rsi !== null) { if (rsi >= 50) bull++; else bear++; }
  if (macd && macd.signal !== null) { if (macd.line > macd.signal) bull++; else bear++; }
  if (ema12 !== null && ema26 !== null) { if (ema12 > ema26) bull++; else bear++; }
  if (ema50 !== null) { if (price > ema50) bull++; else bear++; }

  let signal = "HOLD";
  if (bull >= UMBRAL_CAJA1) signal = "BUY";
  else if (bear >= UMBRAL_CAJA1) signal = "SELL";

  return {
    signal,
    votes: { bull, bear },
    price,
    rsi,
    ema12,
    ema26,
    ema50,
    volRatio,
    atr,
    atrPercent: atr !== null && price > 0 ? (atr / price) * 100 : null
  };
}

// ============================================================
//  ANÁLISIS DE CAJA 2
// ============================================================
function analyzeBox2Weighted(closes, highs, lows, volumes) {
  const price = closes[closes.length - 1];
  const rsi14 = calculateRSI(closes, 14);
  const rsi21 = calculateRSI(closes, 21);
  const macd = calculateMACD(closes);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const avgVol = calculateSMA(volumes, 50);
  const volRatio = avgVol && avgVol > 0 ? volumes[volumes.length - 1] / avgVol : 1;

  let score = 0;
  const iv = {};
  if (ema50 !== null && ema200 !== null) {
    if (ema50 > ema200) { score += 3; iv.ema50_200 = 'alcista'; } else { score -= 3; iv.ema50_200 = 'bajista'; }
  }
  if (macd && macd.signal !== null) {
    if (macd.line > macd.signal) { score += 2; iv.macd = 'alcista'; } else { score -= 2; iv.macd = 'bajista'; }
  }
  if (ema12 !== null && ema26 !== null) {
    if (ema12 > ema26) { score += 2; iv.ema12_26 = 'alcista'; } else { score -= 2; iv.ema12_26 = 'bajista'; }
  }
  if (ema200 !== null) {
    if (price > ema200) { score += 3; iv.vsEMA200 = 'alcista'; } else { score -= 3; iv.vsEMA200 = 'bajista'; }
  }
  if (rsi14 !== null) {
    if (rsi14 < 35) score += 1;
    else if (rsi14 > 65) score -= 1;
  }
  if (rsi21 !== null) {
    if (rsi21 < 35) score += 1;
    else if (rsi21 > 65) score -= 1;
  }
  if (volRatio > 1.3) score += 1;
  else if (volRatio < 0.7) score -= 1;

  let signal = "HOLD";
  if (score >= UMBRAL_CAJA2) signal = "BUY";
  else if (score <= -UMBRAL_CAJA2) signal = "SELL";
  const confidence = Math.min(100, Math.abs(score) * 10);

  return {
    signal,
    score,
    confidence,
    indicValues: { ...iv, rsi14, rsi21, volRatio, vsEMA200: iv.vsEMA200 }
  };
}

// ============================================================
//  ANÁLISIS DE CAJA 3 (contexto semanal)
// ============================================================
function analyzeBox3(closes, highs, lows, volumes) {
  const price = closes[closes.length - 1];
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsiW = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const avgVol = calculateSMA(volumes, 50);
  const volRatio = avgVol && avgVol > 0 ? volumes[volumes.length - 1] / avgVol : 1;

  let divergence = "No detectada";
  if (closes.length > 40 && macd && macd.line !== null) {
    const lb = 10, lastP = closes[closes.length - 1], prevP = closes[closes.length - 1 - lb];
    const prevMacd = calculateMACD(closes.slice(0, closes.length - lb));
    if (prevMacd && prevMacd.line !== null) {
      if (lastP < prevP && macd.line > prevMacd.line) divergence = "Alcista (posible)";
      else if (lastP > prevP && macd.line < prevMacd.line) divergence = "Bajista (posible)";
    }
  }

  let bull = 0, bear = 0, details = [], iv = {};
  if (ema50 !== null && ema200 !== null) {
    if (ema50 > ema200) { bull++; iv.emaCross = 'alcista'; } else { bear++; iv.emaCross = 'bajista'; }
  } else { iv.emaCross = 'sin datos'; }
  if (rsiW !== null) {
    if (rsiW < 40) bull++;
    else if (rsiW > 65) bear++;
  }
  iv.divergence = divergence;
  iv.volAno = volRatio;
  iv.halving = "Halving 2024 · próx. ~2028";

  let signal = "HOLD";
  if (bull >= 2) signal = "BUY";
  else if (bear >= 2) signal = "SELL";
  return { signal, votes: { bull, bear }, details, indicValues: iv, hasLongData: ema50 !== null && ema200 !== null };
}

// ============================================================
//  CÁLCULO DE RIESGO
// ============================================================
function calculateRisk(price, atr, signal) {
  if (!atr || price === undefined) return null;
  const slMult = 1.0, tp1Mult = 1.5, tp2Mult = 3.0;
  if (signal === "BUY") {
    const stop = price - atr * slMult;
    const tp1 = price + atr * tp1Mult;
    const tp2 = price + atr * tp2Mult;
    return { stop, tp1, tp2, ratio: (tp1 - price) / (price - stop) };
  } else if (signal === "SELL") {
    const stop = price + atr * slMult;
    const tp1 = price - atr * tp1Mult;
    const tp2 = price - atr * tp2Mult;
    return { stop, tp1, tp2, ratio: (price - tp1) / (stop - price) };
  }
  return null;
}

// ============================================================
//  OBTENER DATOS DE BINANCE
// ============================================================
async function getKlines(symbol, interval, limit) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`${symbol}: sin datos`);
  return {
    closes: data.map(c => parseFloat(c[4])),
    highs: data.map(c => parseFloat(c[2])),
    lows: data.map(c => parseFloat(c[3])),
    volumes: data.map(c => parseFloat(c[5]))
  };
}

// ============================================================
//  ENVÍO A TELEGRAM
// ============================================================
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("⚠️ Faltan las variables de entorno TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error("Error enviando a Telegram:", e.message);
  }
}

// ============================================================
//  FUNCIÓN PRINCIPAL
// ============================================================
exports.handler = async (event, context) => {
  console.log("🔍 Iniciando escaneo automático (modo depuración)...");
  let allSignals = [];
  let megaAlerts = [];
  let debugInfo = [];

  for (const symbol of COINS_ACTIVE) {
    try {
      const hourly = await getKlines(symbol, '1h', 500);
      const weekly = await getKlines(symbol, '1w', 300);

      const price = hourly.closes[hourly.closes.length - 1];
      const b1 = analyzeBox1(hourly.closes, hourly.highs, hourly.lows, hourly.volumes);
      const b2 = analyzeBox2Weighted(hourly.closes, hourly.highs, hourly.lows, hourly.volumes);
      const b3 = analyzeBox3(weekly.closes, weekly.highs, weekly.lows, weekly.volumes);

      const ath = Math.max(...weekly.highs);
      const pctFromAth = (price - ath) / ath * 100;
      const isAthGood = pctFromAth < -30;

      let risk = null;
      if (b1.signal !== "HOLD" && b1.atr !== null) {
        risk = calculateRisk(price, b1.atr, b1.signal);
      }

      // Depuración: guardar estado de cada moneda
      debugInfo.push(`${symbol}: C1=${b1.signal} (${b1.votes.bull}/${b1.votes.bear}), C2=${b2.signal} (score ${b2.score}), C3=${b3.signal}`);

      // Detectar MEGA C1
      let isMega1 = false;
      let megaType1 = "";
      if (b1.signal === 'BUY' && risk && risk.ratio >= 1.5 &&
          b2.confidence >= 60 && b2.indicValues.vsEMA200 === 'alcista' &&
          b1.volRatio >= 1.2 && b1.rsi !== null && b1.rsi >= 45 && b1.rsi <= 78 &&
          isAthGood) {
        isMega1 = true;
        megaType1 = "🚀 MEGA COMPRA (C1)";
      }
      if (b1.signal === 'SELL' && risk && risk.ratio >= 1.5 &&
          b2.confidence >= 60 && b2.indicValues.vsEMA200 === 'bajista' &&
          b1.volRatio >= 1.2 && b1.rsi !== null && b1.rsi >= 22 && b1.rsi <= 55) {
        isMega1 = true;
        megaType1 = "🔴 MEGA VENTA (C1)";
      }

      // MEGA C3
      let isMega3 = false;
      let megaType3 = "";
      if (b3.signal === 'BUY' && b3.votes.bull >= 2) {
        isMega3 = true;
        megaType3 = "🟢 MEGA CONTEXTO (C3) - ALCISTA";
      } else if (b3.signal === 'SELL' && b3.votes.bear >= 2) {
        isMega3 = true;
        megaType3 = "🔴 MEGA CONTEXTO (C3) - BAJISTA";
      }

      // Calcular score igual que en tu web
      let score = 0;
      let reasons = [];
      if (b1.signal === 'BUY') { score += 3; reasons.push('C1 alcista (+3)'); }
      else if (b1.signal === 'SELL') { score -= 3; reasons.push('C1 bajista (-3)'); }
      if (b2.signal === 'BUY') { score += 4; reasons.push('C2 alcista (+4)'); }
      else if (b2.signal === 'SELL') { score -= 4; reasons.push('C2 bajista (-4)'); }
      if (b3.signal === 'BUY') { score += 2; reasons.push('C3 alcista (+2)'); }
      else if (b3.signal === 'SELL') { score -= 2; reasons.push('C3 bajista (-2)'); }
      if (risk && risk.ratio >= 1.5) {
        score += 0.5;
        reasons.push(`R:R excelente (${risk.ratio.toFixed(2)}) +0.5`);
      }

      // Guardar señal si tiene algún voto o es MEGA
      if (b1.signal !== "HOLD" || b2.signal !== "HOLD" || b3.signal !== "HOLD" || isMega1 || isMega3) {
        allSignals.push({
          symbol: symbol.replace('USDT', '/USDT'),
          price,
          b1,
          b2,
          b3,
          risk,
          score,
          reasons,
          isMega1,
          megaType1,
          isMega3,
          megaType3,
          ath,
          pctFromAth
        });
      }

      if (isMega1 || isMega3) {
        const nombre = symbol.replace('USDT', '/USDT');
        let mensaje = `<b>🔥 ALERTA MEGA</b>\n<b>${nombre}</b>\n`;
        if (isMega1) mensaje += `${megaType1}\n`;
        if (isMega3) mensaje += `${megaType3}\n`;
        mensaje += `💰 Precio: $${price.toFixed(price < 1 ? 6 : 2)}\n`;
        if (risk) {
          mensaje += `🎯 TP1: $${risk.tp1.toFixed(price < 1 ? 6 : 2)}\n`;
          mensaje += `🛑 SL: $${risk.stop.toFixed(price < 1 ? 6 : 2)}\n`;
          mensaje += `📈 R:R: ${risk.ratio.toFixed(2)}\n`;
        }
        mensaje += `📉 Desde ATH: ${pctFromAth.toFixed(1)}%\n`;
        mensaje += `⏰ ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`;
        megaAlerts.push(mensaje);
      }

    } catch (err) {
      console.warn(`Error con ${symbol}: ${err.message}`);
      debugInfo.push(`${symbol}: ERROR - ${err.message}`);
    }
  }

  // Ordenar y tomar top 3
  allSignals.sort((a, b) => b.score - a.score);
  const top3 = allSignals.slice(0, 3);

  // Construir mensaje principal
  let message = `<b>📊 TOP 3 OPORTUNIDADES</b>\n`;
  message += `🕒 ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}\n`;
  message += `⚙️ Umbrales: C1=${UMBRAL_CAJA1}, C2=${UMBRAL_CAJA2}\n\n`;

  if (top3.length === 0) {
    message += `⚪ No se encontraron oportunidades destacadas.\n\n`;
    message += `<b>🔍 Estado de cada moneda (depuración):</b>\n`;
    message += debugInfo.join('\n');
  } else {
    top3.forEach((item, idx) => {
      const emoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
      let signalDir = item.b1.signal !== "HOLD" ? item.b1.signal : 
                     (item.b2.signal !== "HOLD" ? item.b2.signal : item.b3.signal);
      const color = signalDir === 'BUY' ? '🟢' : signalDir === 'SELL' ? '🔴' : '⚪';
      let megaTag = "";
      if (item.isMega1 || item.isMega3) {
        megaTag = " 🔥MEGA";
      }

      message += `${emoji} <b>${item.symbol}</b> ${color} ${signalDir}${megaTag} · Score: ${item.score.toFixed(1)}\n`;
      message += `💰 Precio: $${item.price.toFixed(item.price < 1 ? 6 : 2)}`;
      if (item.b1.rsi !== null) message += ` 📊 RSI (14): ${item.b1.rsi.toFixed(1)}`;
      if (item.b1.atrPercent !== null) message += ` ⚡ ATR: ${item.b1.atrPercent.toFixed(1)}%`;
      if (item.risk) {
        message += ` 📈 R:R: ${item.risk.ratio.toFixed(2)}`;
        message += ` 🛑 SL: $${item.risk.stop.toFixed(item.price < 1 ? 6 : 2)}`;
        message += ` 🎯 TP1: $${item.risk.tp1.toFixed(item.price < 1 ? 6 : 2)}`;
      }
      message += `\n🧠 Justificación: ${item.reasons.join(' · ')}`;
      if (item.isMega1) message += `\n   ${item.megaType1}`;
      if (item.isMega3) message += `\n   ${item.megaType3}`;
      message += `\n📉 Desde ATH: ${item.pctFromAth.toFixed(1)}%\n\n`;
    });
  }

  // Enviar mensaje principal
  await sendTelegram(message);

  // Enviar alertas MEGA
  if (megaAlerts.length > 0) {
    for (const alert of megaAlerts) {
      await sendTelegram(alert);
    }
    console.log(`✅ ${megaAlerts.length} alertas MEGA enviadas.`);
  } else {
    console.log("🟢 Sin MEGAs en este escaneo.");
  }

  // También registrar en logs de Netlify
  console.log(`📊 Total señales: ${allSignals.length}, MEGAs: ${megaAlerts.length}`);
  console.log(`🔍 Debug info:`, debugInfo.join(' | '));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Escaneo completado. ${top3.length} oportunidades, ${megaAlerts.length} MEGAs.` })
  };
};