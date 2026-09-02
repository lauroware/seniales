// test.js - Prueba completa de secretos y Telegram
console.log("🔍 VERIFICANDO SECRETOS...");
console.log("TELEGRAM_BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "✅ Presente" : "❌ Ausente");
console.log("TELEGRAM_CHAT_ID:", process.env.TELEGRAM_CHAT_ID ? "✅ Presente" : "❌ Ausente");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

async function testTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.log("❌ Faltan secretos, no se puede probar Telegram");
    return;
  }
  
  console.log("📤 Enviando mensaje de prueba a Telegram...");
  
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🧪 ¡Prueba exitosa desde GitHub Actions! 🎉",
        parse_mode: 'HTML'
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      console.log("✅ Mensaje enviado correctamente a Telegram");
      console.log("📨 Respuesta:", JSON.stringify(data, null, 2));
    } else {
      console.log("❌ Error de Telegram:", data.description || data);
    }
  } catch (err) {
    console.log("❌ Error de red:", err.message);
  }
}

// Ejecutar la prueba
testTelegram();