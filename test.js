// test.js - Prueba de Telegram
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
        text: "🧪 ¡Prueba exitosa desde GitHub Actions! 🎉",
        parse_mode: 'HTML'
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      console.log("✅ Mensaje enviado correctamente");
      console.log("📨 Respuesta:", JSON.stringify(data, null, 2));
    } else {
      console.log("❌ Error:", data.description);
    }
  } catch (err) {
    console.log("❌ Error de red:", err.message);
  }
}

testTelegram();