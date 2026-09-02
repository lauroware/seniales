// test-telegram.js
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function testTelegram() {
  console.log("🔍 INICIANDO PRUEBA DE TELEGRAM");
  console.log("📌 Token:", TELEGRAM_BOT_TOKEN ? "✅ CONFIGURADO" : "❌ FALTA");
  console.log("📌 Chat ID:", TELEGRAM_CHAT_ID ? "✅ CONFIGURADO" : "❌ FALTA");

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("❌ ERROR: Faltan variables de entorno");
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    console.log(`📤 Enviando a: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: "🧪 ¡PRUEBA EXITOSA desde GitHub Actions!",
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();
    console.log("📨 Respuesta de Telegram:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("✅ MENSAJE ENVIADO CORRECTAMENTE");
    } else {
      console.error("❌ ERROR de Telegram:", data);
      if (data.description) console.error("🔴 Descripción:", data.description);
    }
  } catch (error) {
    console.error("❌ ERROR DE RED:", error.message);
  }
}

testTelegram();