import requests
import time
from datetime import datetime

# ---------- CONFIGURACIÓN ----------
TOKEN = '8972257486:AAGDSYa5m2yFEQsc0lPYO_bDAulKGO1qR7g'
CHAT_ID = '1014753754'
MONEDAS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'LINKUSDT', 'LTCUSDT', 'DOGEUSDT', 'PEPEUSDT']
INTERVALO = '1h'  # '1h' para Swing o '5m' para Scalping

# ---------- INDICADORES ----------
def calcular_ema(datos, periodo):
    if len(datos) < periodo:
        return None
    k = 2 / (periodo + 1)
    ema = datos[0]
    for precio in datos[1:]:
        ema = precio * k + ema * (1 - k)
    return ema

def calcular_rsi(datos, periodo=14):
    if len(datos) < periodo + 1:
        return None
    ganancias = 0
    perdidas = 0
    for i in range(1, periodo + 1):
        diff = datos[i] - datos[i-1]
        if diff > 0:
            ganancias += diff
        else:
            perdidas += abs(diff)
    avg_ganancia = ganancias / periodo
    avg_perdida = perdidas / periodo
    for i in range(periodo + 1, len(datos)):
        diff = datos[i] - datos[i-1]
        if diff > 0:
            avg_ganancia = (avg_ganancia * (periodo - 1) + diff) / periodo
            avg_perdida = (avg_perdida * (periodo - 1)) / periodo
        else:
            avg_ganancia = (avg_ganancia * (periodo - 1)) / periodo
            avg_perdida = (avg_perdida * (periodo - 1) + abs(diff)) / periodo
    if avg_perdida == 0:
        return 100
    rs = avg_ganancia / avg_perdida
    return 100 - (100 / (1 + rs))

def calcular_macd(datos):
    ema12 = calcular_ema(datos, 12)
    ema26 = calcular_ema(datos, 26)
    if ema12 is None or ema26 is None:
        return None
    linea_macd = ema12 - ema26
    serie_macd = []
    for i in range(26, len(datos)):
        e12 = calcular_ema(datos[:i+1], 12)
        e26 = calcular_ema(datos[:i+1], 26)
        if e12 is not None and e26 is not None:
            serie_macd.append(e12 - e26)
    if len(serie_macd) < 9:
        return {'linea': linea_macd, 'senal': None}
    senal = calcular_ema(serie_macd, 9)
    return {'linea': linea_macd, 'senal': senal}

def calcular_atr(cierre, maximo, minimo, periodo=14):
    if len(cierre) < periodo + 1:
        return None
    trs = []
    for i in range(1, len(cierre)):
        tr = max(maximo[i] - minimo[i], abs(maximo[i] - cierre[i-1]), abs(minimo[i] - cierre[i-1]))
        trs.append(tr)
    if len(trs) < periodo:
        return None
    return sum(trs[-periodo:]) / periodo

def analizar_moneda(simbolo, intervalo):
    url = f'https://api.binance.com/api/v3/klines?symbol={simbolo}&interval={intervalo}&limit=500'
    try:
        respuesta = requests.get(url, timeout=10)
        if respuesta.status_code != 200:
            return None
        datos = respuesta.json()
        cierre = [float(v[4]) for v in datos]
        maximo = [float(v[2]) for v in datos]
        minimo = [float(v[3]) for v in datos]
        volumen = [float(v[5]) for v in datos]
        precio_actual = cierre[-1]

        rsi14 = calcular_rsi(cierre, 14)
        rsi21 = calcular_rsi(cierre, 21)
        macd = calcular_macd(cierre)
        ema12 = calcular_ema(cierre, 12)
        ema26 = calcular_ema(cierre, 26)
        ema50 = calcular_ema(cierre, 50)
        ema200 = calcular_ema(cierre, 200)
        atr = calcular_atr(cierre, maximo, minimo, 14)

        media_vol = sum(volumen[-50:]) / 50 if len(volumen) >= 50 else 1
        vol_ratio = volumen[-1] / media_vol if media_vol > 0 else 1

        # ----- SISTEMA DE PESOS (Caja 2) -----
        score = 0
        detalles = []

        if ema50 is not None and ema200 is not None:
            if ema50 > ema200:
                score += 3
                detalles.append('EMA50 > EMA200 (+3)')
            else:
                score -= 3
                detalles.append('EMA50 < EMA200 (-3)')

        if macd and macd['senal'] is not None:
            if macd['linea'] > macd['senal']:
                score += 2
                detalles.append('MACD línea > señal (+2)')
            else:
                score -= 2
                detalles.append('MACD línea < señal (-2)')

        if ema12 is not None and ema26 is not None:
            if ema12 > ema26:
                score += 2
                detalles.append('EMA12 > EMA26 (+2)')
            else:
                score -= 2
                detalles.append('EMA12 < EMA26 (-2)')

        if ema200 is not None:
            if precio_actual > ema200:
                score += 3
                detalles.append('Precio sobre EMA200 (+3)')
            else:
                score -= 3
                detalles.append('Precio bajo EMA200 (-3)')

        if rsi14 is not None:
            if rsi14 < 35:
                score += 1
                detalles.append(f'RSI14 {rsi14:.1f} (sobreventa) (+1)')
            elif rsi14 > 65:
                score -= 1
                detalles.append(f'RSI14 {rsi14:.1f} (sobrecompra) (-1)')
            else:
                detalles.append(f'RSI14 {rsi14:.1f} (neutral)')

        if rsi21 is not None:
            if rsi21 < 35:
                score += 1
                detalles.append(f'RSI21 {rsi21:.1f} (sobreventa) (+1)')
            elif rsi21 > 65:
                score -= 1
                detalles.append(f'RSI21 {rsi21:.1f} (sobrecompra) (-1)')
            else:
                detalles.append(f'RSI21 {rsi21:.1f} (neutral)')

        if vol_ratio > 1.3:
            score += 1
            detalles.append(f'Volumen {vol_ratio:.1f}x (alto) (+1)')
        elif vol_ratio < 0.7:
            score -= 1
            detalles.append(f'Volumen {vol_ratio:.1f}x (bajo) (-1)')
        else:
            detalles.append(f'Volumen {vol_ratio:.1f}x (normal)')

        senal = "HOLD"
        if score >= 5:
            senal = "BUY"
        elif score <= -5:
            senal = "SELL"

        confianza = min(100, abs(score) * 10)

        # ----- GESTIÓN DE RIESGO (solo si es BUY) -----
        if senal == "BUY" and atr is not None:
            stop_loss = precio_actual - atr * 1.5
            tp1 = precio_actual + atr * 1.0
            tp2 = precio_actual + atr * 2.0
            ratio = (atr * 1.0) / (atr * 1.5) if atr > 0 else 0

            comision = 0.15
            pct_tp1 = ((tp1 - precio_actual) / precio_actual) * 100
            pct_tp2 = ((tp2 - precio_actual) / precio_actual) * 100
            pct_sl = ((stop_loss - precio_actual) / precio_actual) * 100
            neto_tp1 = pct_tp1 - comision
            neto_tp2 = pct_tp2 - comision

            # ----- NUEVO: DETECTAR SI ES SÚPER FUERTE -----
            es_super_fuerte = False
            if ratio >= 2.0 and neto_tp1 >= 1.0 and confianza >= 70 and vol_ratio >= 1.5:
                # Verificar que el precio esté sobre EMA200 (tendencia alcista)
                if ema200 is not None and precio_actual > ema200:
                    # Verificar RSI en rango saludable (40-75)
                    if rsi14 is not None and 40 <= rsi14 <= 75:
                        es_super_fuerte = True

            # Filtro de calidad base (R:R >= 1.0 y TP1 neto >= 0.5%)
            if ratio >= 1.0 and neto_tp1 >= 0.5:
                return {
                    'simbolo': simbolo.replace('USDT', '/USDT'),
                    'precio': precio_actual,
                    'score': score,
                    'confianza': confianza,
                    'ratio': ratio,
                    'neto_tp1': neto_tp1,
                    'neto_tp2': neto_tp2,
                    'stop_loss': stop_loss,
                    'tp1': tp1,
                    'tp2': tp2,
                    'es_super_fuerte': es_super_fuerte  # <-- NUEVO CAMPO
                }
        return None
    except Exception as e:
        print(f"Error con {simbolo}: {e}")
        return None

# ---------- FUNCIÓN PARA ENVIAR MENSAJE A TELEGRAM ----------
def enviar_telegram(mensaje):
    url = f'https://api.telegram.org/bot{TOKEN}/sendMessage'
    payload = {
        'chat_id': CHAT_ID,
        'text': mensaje,
        'parse_mode': 'Markdown'
    }
    try:
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Error enviando mensaje: {e}")

# ---------- ESCÁNER PRINCIPAL ----------
def escanear_y_alertar():
    print(f"🔄 Escaneando {len(MONEDAS)} monedas en {INTERVALO}...")
    for simbolo in MONEDAS:
        resultado = analizar_moneda(simbolo, INTERVALO)
        if resultado:
            # Si es súper fuerte, añadir encabezado
            super_texto = "🔥 *SUPER FUERTE* 🔥\n" if resultado.get('es_super_fuerte', False) else ""
            mensaje = f"""
{super_texto}📈 *SEÑAL DE RIESGO BAJO DETECTADA!*
Par: {resultado['simbolo']}
Precio: ${resultado['precio']:.4f}
Puntuación: {resultado['score']} (Confianza: {resultado['confianza']}%)
Ratio R:R: 1 : {resultado['ratio']:.2f}

📍 Entrada: ${resultado['precio']:.4f}
🛑 Stop Loss: ${resultado['stop_loss']:.4f} ({((resultado['stop_loss'] - resultado['precio'])/resultado['precio']*100):.2f}%)
🎯 TP1: ${resultado['tp1']:.4f} (Neto Spot: +{resultado['neto_tp1']:.2f}%)
🚀 TP2: ${resultado['tp2']:.4f} (Neto Spot: +{resultado['neto_tp2']:.2f}%)

⏰ {datetime.now().strftime('%H:%M:%S')}
"""
            enviar_telegram(mensaje)
            print(f"✅ Alerta enviada para {resultado['simbolo']}")
        else:
            print(f"   {simbolo}: sin señal buena")
    print("--- Escaneo completado ---")

# ---------- EJECUTAR ----------
if __name__ == "__main__":
    escanear_y_alertar()