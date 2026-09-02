// test-telegram.js
async function testTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  console.log("🔍 Probando Telegram...");
  console.log("Token:", token ? "✅" : "❌");
  console.log("Chat ID:", chatId ? "✅" : "❌");
  
  if (!token || !chatId) {
    console.log("❌ Faltan secretos");
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🧪 ¡Prueba exitosa desde GitHub Actions!",
        parse_mode: 'HTML'
      })
    });
    
    const data = await res.json();
    console.log("Respuesta:", data);
    
    if (res.ok) {
      console.log("✅ Mensaje enviado correctamente");
    } else {
      console.log("❌ Error:", data.description);
    }
  } catch (err) {
    console.log("❌ Error de red:", err.message);
  }
}

// test-secrets.js
console.log("🔍 Verificando secretos...");
console.log("TELEGRAM_BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "✅ Presente" : "❌ Ausente");
console.log("TELEGRAM_CHAT_ID:", process.env.TELEGRAM_CHAT_ID ? "✅ Presente" : "❌ Ausente");

testTelegram();