// ============================================================
//  LEE LAS CREDENCIALES DE LAS VARIABLES DE ENTORNO (NETLIFY)
//  Así el token NO queda en el código.
// ============================================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ============================================================
//  LISTA COMPLETA DE MONEDAS (TODAS ACTIVAS)
// ============================================================
const COINS_ACTIVE = [
  // 🔥 Principales
  "BTCUSDT", "ETHUSDT", "BNBUSDT",
  // ⚡ Altcoins
  "SOLUSDT", "XRPUSDT", "ADAUSDT", "LINKUSDT", "LTCUSDT", "DOTUSDT", "AVAXUSDT",
  // 🚀 Especulativas (todas)
  "DOGEUSDT", "PEPEUSDT", "ENAUSDT", "TLMUSDT", "POLUSDT", "HBARUSDT",
  "CHZUSDT", "SHIBUSDT", "TWTUSDT"
];

// ============================================================
//  FUNCIONES DE INDICADORES (copiadas de tu HTML)
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
//  ANÁLISIS DE CAJAS (igual que en tu web)
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

  const THRESHOLD = 3;
  let signal = "HOLD";
  if (bull >= THRESHOLD) signal = "BUY";
  else if (bear >= THRESHOLD) signal = "SELL";

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

  const THRESHOLD = 5;
  let signal = "HOLD";
  if (score >= THRESHOLD) signal = "BUY";
  else if (score <= -THRESHOLD) signal = "SELL";
  const confidence = Math.min(100, Math.abs(score) * 10);

  return {
    signal,
    score,
    confidence,
    indicValues: { ...iv, rsi14, rsi21, volRatio, vsEMA200: iv.vsEMA200 }
  };
}

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
//  FUNCIÓN PRINCIPAL (se ejecuta según el cron)
// ============================================================
exports.handler = async (event, context) => {
  console.log("🔍 Iniciando escaneo automático de MEGAs...");
  let megaDetected = [];

  for (const symbol of COINS_ACTIVE) {
    try {
      const hourly = await getKlines(symbol, '1h', 500);
      const weekly = await getKlines(symbol, '1w', 300);

      const price = hourly.closes[hourly.closes.length - 1];
      const b1 = analyzeBox1(hourly.closes, hourly.highs, hourly.lows, hourly.volumes);
      const b2 = analyzeBox2Weighted(hourly.closes, hourly.highs, hourly.lows, hourly.volumes);

      // ATH semanal
      const ath = Math.max(...weekly.highs);
      const pctFromAth = (price - ath) / ath * 100;
      const isAthGood = pctFromAth < -30;

      let risk = null;
      if (b1.signal !== "HOLD" && b1.atr !== null) {
        risk = calculateRisk(price, b1.atr, b1.signal);
      }

      let isMega = false;
      let megaType = "";

      // MEGA COMPRA
      if (b1.signal === 'BUY' && risk && risk.ratio >= 1.5 &&
          b2.confidence >= 60 && b2.indicValues.vsEMA200 === 'alcista' &&
          b1.volRatio >= 1.2 && b1.rsi !== null && b1.rsi >= 45 && b1.rsi <= 78 &&
          isAthGood) {
        isMega = true;
        megaType = "🚀 MEGA COMPRA";
      }

      // MEGA VENTA
      if (b1.signal === 'SELL' && risk && risk.ratio >= 1.5 &&
          b2.confidence >= 60 && b2.indicValues.vsEMA200 === 'bajista' &&
          b1.volRatio >= 1.2 && b1.rsi !== null && b1.rsi >= 22 && b1.rsi <= 55) {
        isMega = true;
        megaType = "🔴 MEGA VENTA";
      }

      if (isMega) {
        const nombre = symbol.replace('USDT', '/USDT');
        const dec = price < 1 ? 6 : 2;
        const mensaje = `<b>🔥 ${megaType}</b>\n` +
                        `<b>${nombre}</b>\n` +
                        `💰 Precio: $${price.toFixed(dec)}\n` +
                        `📊 RSI: ${b1.rsi !== null ? b1.rsi.toFixed(1) : '--'}\n` +
                        `📈 R:R: ${risk ? risk.ratio.toFixed(2) : '--'}\n` +
                        `📉 Desde ATH: ${pctFromAth.toFixed(1)}%\n` +
                        `🎯 TP1: $${risk ? risk.tp1.toFixed(dec) : '--'}\n` +
                        `🛑 SL: $${risk ? risk.stop.toFixed(dec) : '--'}\n` +
                        `⏰ ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`;
        megaDetected.push(mensaje);
      }
    } catch (err) {
      console.warn(`Error con ${symbol}: ${err.message}`);
    }
  }

  // Enviar resumen si hay MEGAs
  if (megaDetected.length > 0) {
    const titulo = `🚨 <b>${megaDetected.length} SEÑAL(ES) MEGA DETECTADA(S)</b>\n\n`;
    await sendTelegram(titulo + megaDetected.join('\n\n---\n\n'));
    console.log(`✅ ${megaDetected.length} MEGA(s) notificada(s)`);
  } else {
    console.log("🟢 Sin MEGAs en este escaneo.");
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: `Escaneo completado. ${megaDetected.length} MEGAs encontradas.` })
  };
};