// scan.js
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const UMBRAL_CAJA1 = 2;
const UMBRAL_CAJA2 = 4;

const COINS_ACTIVE = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
  "ADAUSDT", "LINKUSDT", "LTCUSDT", "DOTUSDT", "AVAXUSDT",
  "DOGEUSDT", "PEPEUSDT", "ENAUSDT", "TLMUSDT", "POLUSDT", "HBARUSDT",
  "CHZUSDT", "SHIBUSDT", "TWTUSDT"
];

// ============================================================
//  FUNCIONES DE INDICADORES (todas iguales)
// ============================================================
// ... (aquí van todas las funciones de indicadores que ya tienes)
// calculateEMA, calculateRSI, calculateMACD, etc.

// ============================================================
//  OBTENER DATOS DE BINANCE (CON PROXY)
// ============================================================
async function getKlines(symbol, interval, limit) {
  // Intenta con múltiples proxies
  const proxies = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ];
  
  for (const proxyUrl of proxies) {
    try {
      const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const url = proxyUrl + encodeURIComponent(binanceUrl);
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('Datos vacíos');
      
      return {
        closes: data.map(c => parseFloat(c[4])),
        highs: data.map(c => parseFloat(c[2])),
        lows: data.map(c => parseFloat(c[3])),
        volumes: data.map(c => parseFloat(c[5]))
      };
    } catch (err) {
      console.log(`⚠️ Proxy ${proxyUrl} falló, probando siguiente...`);
    }
  }
  throw new Error('Todos los proxies fallaron');
}

// ============================================================
//  ENVÍO A TELEGRAM
// ============================================================
async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("⚠️ Faltan variables de entorno");
    console.log("Token:", TELEGRAM_BOT_TOKEN ? "✅ Configurado" : "❌ FALTA");
    console.log("Chat ID:", TELEGRAM_CHAT_ID ? "✅ Configurado" : "❌ FALTA");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error Telegram: ${res.status} - ${errorText}`);
    } else {
      console.log("✅ Mensaje enviado a Telegram");
    }
  } catch (e) {
    console.error("Error enviando a Telegram:", e.message);
  }
}

// ============================================================
//  FUNCIÓN PRINCIPAL (con verificación de secretos)
// ============================================================
async function main() {
  console.log("🔍 Iniciando escaneo automático...");
  console.log("📌 Token:", TELEGRAM_BOT_TOKEN ? "✅ Configurado" : "❌ FALTA");
  console.log("📌 Chat ID:", TELEGRAM_CHAT_ID ? "✅ Configurado" : "❌ FALTA");
  
  // Resto del código igual...
}

main().catch(console.error);