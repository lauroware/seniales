// ============================================================
//  CONFIGURACIÓN
// ============================================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Umbrales (más bajos para ser sensible)
const UMBRAL_CAJA1 = 2;
const UMBRAL_CAJA2 = 4;

// Lista de monedas
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

  return { signal, votes: { bull, bear }, price, rsi, volRatio, atr, atrPercent: atr !== null && price > 0 ? (atr / price) * 100 : null };
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

  let signal = "HOLD";
  if (score >= UMBRAL_CAJA2) signal = "BUY";
  else if (score <= -UMBRAL_CAJA2) signal = "SELL";
  const confidence = Math.min(100, Math.abs(score) * 10);

  return { signal, score, confidence, indicValues: { ...iv, rsi14, rsi21, volRatio, vsEMA200: iv.vsEMA200 } };
}

function analyzeBox3(closes, highs, lows, volumes) {
  const price = closes[closes.length - 1];
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsiW = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const avgVol = calculateSMA(volumes, 50);
  const volRatio = avgVol && avgVol > 0 ? volumes[volumes.length - 1] / avgVol : 1;

  let bull = 0, bear = 0, iv = {};
  if (ema50 !== null && ema200 !== null) {
    if (ema50 > ema200) { bull++; iv.emaCross = 'alcista'; } else { bear++; iv.emaCross = 'bajista'; }
  } else { iv.emaCross = 'sin datos'; }
  if (rsiW !== null) {
    if (rsiW < 40) bull++;
    else if (rsiW > 65) bear++;
  }
  iv.volAno = volRatio;

  let signal = "HOLD";
  if (bull >= 2) signal = "BUY";
  else if (bear >= 2) signal = "SELL";
  return { signal, votes: { bull, bear }, indicValues: iv };
}

function calculateRisk(price, atr, signal) {
  if (!atr || price === undefined) return null;
  const slMult = 1.0, tp1Mult = 1.5;
  if (signal === "BUY") {
    const stop = price - atr * slMult;
    const tp1 = price + atr * tp1Mult;
    return { stop, tp1, ratio: (tp1 - price) / (price - stop) };
  } else if (signal === "SELL") {
    const stop = price + atr * slMult;
    const tp1 = price - atr * tp1Mult;
    return { stop, tp1, ratio: (price - tp1) / (stop - price) };
  }
  return null;
}

// ============================================================
//  OBTENER DATOS DE BINANCE (MULTI-ENDPOINT)
// ============================================================
async function getKlines(symbol, interval, limit, retries = 2) {
  // Lista de endpoints para intentar (algunos pueden estar menos restringidos)
  const endpoints = [
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com',
    'https://api.binance.com'
  ];
  
  let lastError = null;
  
  for (let attempt = 0; attempt < endpoints.length; attempt++) {
    const baseUrl = endpoints[attempt];
    const url = `${baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        // Timeout de 5 segundos
        signal: AbortSignal.timeout(5000)
      });
      
      if (res.status === 451) {
        // Error de restricción geográfica - probamos el siguiente endpoint
        console.log(`📍 ${symbol}: Endpoint ${baseUrl} bloqueado (451), probando siguiente...`);
        continue;
      }
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 100)}`);
      }
      
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error(`respuesta inválida: ${JSON.stringify(data).substring(0, 80)}`);
      }
      if (data.length === 0) {
        throw new Error('sin datos (array vacío)');
      }
      
      return {
        closes: data.map(c => parseFloat(c[4])),
        highs: data.map(c => parseFloat(c[2])),
        lows: data.map(c => parseFloat(c[3])),
        volumes: data.map(c => parseFloat(c[5]))
      };
      
    } catch (err) {
      lastError = err;
      console.log(`⚠️ ${symbol} con ${baseUrl}: ${err.message}`);
      // Esperamos antes de probar el siguiente
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  // Si todos los endpoints fallaron, lanzamos el último error
  throw lastError || new Error(`Todos los endpoints fallaron para ${symbol}`);
}

// ============================================================
//  ENVÍO A TELEGRAM
// ============================================================
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("⚠️ Faltan variables de entorno");
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
  console.log("🔍 Iniciando escaneo con multi-endpoint...");
  const allSignals = [];
  const errors = [];

  for (let i = 0; i < COINS_ACTIVE.length; i++) {
    const symbol = COINS_ACTIVE[i];
    try {
      console.log(`📊 ${symbol} (${i+1}/${COINS_ACTIVE.length})...`);
      
      // Pausa entre peticiones
      if (i > 0) await new Promise(r => setTimeout(r, 250));
      
      const hourly = await getKlines(symbol, '1h', 500);
      const weekly = await getKlines(symbol, '1w', 300);
      
      const price = hourly.closes[hourly.closes.length - 1];
      const b1 = analyzeBox1(hourly.closes, hourly.highs, hourly.lows, hourly.volumes);
      const b2 = analyzeBox2Weighted(hourly.closes, hourly.highs, hourly.lows, hourly.volumes);
      const b3 = analyzeBox3(weekly.closes, weekly.highs, weekly.lows, weekly.volumes);
      
      const ath = Math.max(...weekly.highs);
      const pctFromAth = (price - ath) / ath * 100;
      
      let risk = null;
      if (b1.signal !== "HOLD" && b1.atr !== null) {
        risk = calculateRisk(price, b1.atr, b1.signal);
      }
      
      // Calcular score (igual que tu web)
      let score = 0;
      const reasons = [];
      
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
      
      const signalDir = b1.signal !== "HOLD" ? b1.signal : (b2.signal !== "HOLD" ? b2.signal : b3.signal);
      
      allSignals.push({
        symbol: symbol.replace('USDT', '/USDT'),
        price,
        b1,
        b2,
        b3,
        risk,
        score,
        reasons,
        pctFromAth,
        signalDir
      });
      
      console.log(`✅ ${symbol} -> Score: ${score.toFixed(1)}, Señal: ${signalDir}`);
      
    } catch (err) {
      console.error(`❌ ${symbol}: ${err.message}`);
      errors.push(`${symbol}: ${err.message}`);
    }
  }

  // Ordenar y tomar top 3
  allSignals.sort((a, b) => b.score - a.score);
  const top3 = allSignals.slice(0, 3);

  console.log(`📈 Top 3: ${top3.map(s => s.symbol).join(', ')}`);

  // Construir mensaje
  let message = `<b>📊 TOP 3 OPORTUNIDADES</b>\n`;
  message += `🕒 ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}\n`;
  message += `⚙️ Umbrales: C1=${UMBRAL_CAJA1}, C2=${UMBRAL_CAJA2}\n\n`;

  if (top3.length === 0) {
    message += `⚪ No se encontraron oportunidades destacadas.`;
  } else {
    top3.forEach((item, idx) => {
      const emoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
      const color = item.signalDir === 'BUY' ? '🟢' : item.signalDir === 'SELL' ? '🔴' : '⚪';
      
      message += `${emoji} <b>${item.symbol}</b> ${color} ${item.signalDir || 'HOLD'} · Score: ${item.score.toFixed(1)}\n`;
      message += `💰 Precio: $${item.price.toFixed(item.price < 1 ? 6 : 2)}`;
      if (item.b1.rsi !== null) message += ` 📊 RSI: ${item.b1.rsi.toFixed(1)}`;
      if (item.b1.atrPercent !== null) message += ` ⚡ ATR: ${item.b1.atrPercent.toFixed(1)}%`;
      if (item.risk) {
        message += ` 📈 R:R: ${item.risk.ratio.toFixed(2)}`;
        message += ` 🛑 SL: $${item.risk.stop.toFixed(item.price < 1 ? 6 : 2)}`;
        message += ` 🎯 TP1: $${item.risk.tp1.toFixed(item.price < 1 ? 6 : 2)}`;
      }
      if (item.reasons.length > 0) {
        message += `\n🧠 ${item.reasons.join(' · ')}`;
      }
      message += `\n📉 Desde ATH: ${item.pctFromAth.toFixed(1)}%\n\n`;
    });
  }

  // Si hubo errores, añadir al final
  if (errors.length > 0) {
    message += `\n⚠️ Algunos símbolos fallaron:\n`;
    errors.slice(0, 5).forEach(e => message += `- ${e}\n`);
    if (errors.length > 5) message += `- ... y ${errors.length - 5} más.\n`;
  }

  await sendTelegram(message);
  console.log("✅ Mensaje enviado.");

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: `Escaneo completado. ${top3.length} oportunidades, ${errors.length} errores.` 
    })
  };
};