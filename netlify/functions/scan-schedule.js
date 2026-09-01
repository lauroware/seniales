// ============================================================
//  VERSIÓN CON LOGS DETALLADOS Y MENSAJE DE PRUEBA
// ============================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const UMBRAL_CAJA1 = parseInt(process.env.UMBRAL_CAJA1) || 3;
const UMBRAL_CAJA2 = parseInt(process.env.UMBRAL_CAJA2) || 5;

const COINS_ACTIVE = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT",
  "SOLUSDT", "XRPUSDT", "ADAUSDT", "LINKUSDT", "LTCUSDT", "DOTUSDT", "AVAXUSDT",
  "DOGEUSDT", "PEPEUSDT", "ENAUSDT", "TLMUSDT", "POLUSDT", "HBARUSDT",
  "CHZUSDT", "SHIBUSDT", "TWTUSDT"
];

// ... (todas las funciones de indicadores igual que antes) ...

// ============================================================
//  FUNCIÓN PRINCIPAL CON LOGS MEJORADOS
// ============================================================
exports.handler = async (event, context) => {
  console.log(`🔍 Iniciando escaneo (umbral C1=${UMBRAL_CAJA1}, C2=${UMBRAL_CAJA2})`);
  
  let allSignals = [];
  let debugInfo = [];

  for (const symbol of COINS_ACTIVE) {
    try {
      const hourly = await getKlines(symbol, '1h', 500);
      const weekly = await getKlines(symbol, '1w', 300);

      const price = hourly.closes[hourly.closes.length - 1];
      const b1 = analyzeBox1(hourly.closes, hourly.highs, hourly.lows, hourly.volumes);
      const b2 = analyzeBox2Weighted(hourly.closes, hourly.highs, hourly.lows, hourly.volumes);
      const b3 = analyzeBox3(weekly.closes, weekly.highs, weekly.lows, weekly.volumes);

      // Log detallado para cada moneda
      const logEntry = `${symbol}: C1=${b1.signal} (votos: ${b1.votes.bull}/${b1.votes.bear}), C2=${b2.signal} (score: ${b2.score}), C3=${b3.signal}`;
      debugInfo.push(logEntry);
      console.log(logEntry);

      // Calcular score
      let score = 0;
      let reasons = [];
      if (b1.signal === 'BUY') { score += 3; reasons.push('C1 alcista (+3)'); }
      else if (b1.signal === 'SELL') { score -= 3; reasons.push('C1 bajista (-3)'); }
      if (b2.signal === 'BUY') { score += 4; reasons.push('C2 alcista (+4)'); }
      else if (b2.signal === 'SELL') { score -= 4; reasons.push('C2 bajista (-4)'); }
      if (b3.signal === 'BUY') { score += 2; reasons.push('C3 alcista (+2)'); }
      else if (b3.signal === 'SELL') { score -= 2; reasons.push('C3 bajista (-2)'); }

      // Si hay alguna señal o score significativo, guardar
      if (b1.signal !== "HOLD" || b2.signal !== "HOLD" || b3.signal !== "HOLD" || Math.abs(score) >= 2) {
        allSignals.push({
          symbol: symbol.replace('USDT', '/USDT'),
          price,
          b1,
          b2,
          b3,
          score,
          reasons,
          risk: (b1.signal !== "HOLD" && b1.atr) ? calculateRisk(price, b1.atr, b1.signal) : null,
          pctFromAth: ((price - Math.max(...weekly.highs)) / Math.max(...weekly.highs)) * 100
        });
      }

    } catch (err) {
      console.warn(`Error con ${symbol}: ${err.message}`);
    }
  }

  // Ordenar y tomar top 3
  allSignals.sort((a, b) => b.score - a.score);
  const top3 = allSignals.slice(0, 3);

  // Construir mensaje
  let message = `<b>📊 TOP 3 OPORTUNIDADES</b>\n`;
  message += `🕒 ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}\n`;
  message += `⚙️ Umbrales: C1=${UMBRAL_CAJA1}, C2=${UMBRAL_CAJA2}\n\n`;

  if (top3.length === 0) {
    message += `⚪ No se encontraron oportunidades destacadas.\n\n`;
    message += `📋 Resumen de señales (logs):\n${debugInfo.slice(0, 5).join('\n')}`;
    if (debugInfo.length > 5) message += `\n... y ${debugInfo.length - 5} más.`;
  } else {
    top3.forEach((item, idx) => {
      const emoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
      const signalDir = item.b1.signal !== "HOLD" ? item.b1.signal : 
                       (item.b2.signal !== "HOLD" ? item.b2.signal : item.b3.signal);
      const color = signalDir === 'BUY' ? '🟢' : signalDir === 'SELL' ? '🔴' : '⚪';
      
      message += `${emoji} <b>${item.symbol}</b> ${color} ${signalDir} · Score: ${item.score.toFixed(1)}\n`;
      message += `💰 $${item.price.toFixed(item.price < 1 ? 6 : 2)}`;
      if (item.b1.rsi) message += ` | RSI: ${item.b1.rsi.toFixed(1)}`;
      if (item.risk) message += ` | R:R: ${item.risk.ratio.toFixed(2)}`;
      message += `\n🧠 ${item.reasons.join(' · ')}`;
      if (item.pctFromAth) message += `\n📉 Desde ATH: ${item.pctFromAth.toFixed(1)}%`;
      message += `\n\n`;
    });
  }

  // Enviar mensaje
  await sendTelegram(message);

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      message: `Escaneo completado. ${top3.length} oportunidades encontradas.`,
      debug: debugInfo.slice(0, 10) // devolvemos los primeros 10 logs para depuración
    })
  };
};