/**
 * WhatsApp Limpieza Automática
 * ----------------------------
 * Revisa los mensajes de un chat de WhatsApp y borra automáticamente los que
 * contienen información específica que no quieres dejar guardada
 * (contraseñas, números de tarjeta, correos, teléfonos, palabras clave propias…).
 *
 * - Detección por palabras clave y por patrones (expresiones regulares).
 * - Confirmación opcional con IA (Google Gemini) para reducir falsos positivos.
 * - Modo simulación: muestra lo que borraría sin borrar nada.
 * - Guarda un reporte local de lo borrado.
 */
require('dotenv').config();
const { Client, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const readline = require('readline');

// ================= CONFIGURACIÓN =================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''; // opcional, en el archivo .env
const NOMBRE_ARCHIVO = 'reporte_borrados.txt';
const PAUSA_ENTRE_BORRADOS_MS = 1500;

// Palabras que marcan un mensaje como candidato a borrar (edítalas a tu gusto)
const PALABRAS_CLAVE = [
    'contraseña', 'password', 'clave', 'pin', 'usuario:',
    'cvv', 'tarjeta', 'cuenta bancaria', 'token', 'código de verificación',
    'dirección', 'cédula', 'pasaporte',
];

// Patrones de datos sensibles
const PATRONES = [
    { nombre: 'Tarjeta', regex: /\b(?:\d[ -]?){13,19}\b/ },
    { nombre: 'Correo', regex: /[\w.+-]+@[\w-]+\.[\w.]+/ },
    { nombre: 'Teléfono', regex: /\+?\d{2,3}[ -]?\d{3}[ -]?\d{3,4}[ -]?\d{3,4}/ },
];

// ================= UTILIDADES =================
const model = GEMINI_API_KEY
    ? new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({ model: 'gemini-1.5-flash' })
    : null;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const preguntar = (pregunta) => new Promise(resolve => rl.question(pregunta, resolve));

function registrarBorrado(chatName, motivo) {
    const fecha = new Date().toLocaleString();
    const linea = `[${fecha}] Chat: ${chatName} | Motivo: ${motivo}\n`;
    try {
        fs.appendFileSync(NOMBRE_ARCHIVO, linea, 'utf8');
    } catch (e) {
        console.error('Error escribiendo reporte:', e.message);
    }
}

/** Devuelve el motivo por el que el mensaje es sensible, o null si no lo es. */
function detectarSensible(texto) {
    const t = texto.toLowerCase();
    const palabra = PALABRAS_CLAVE.find(p => t.includes(p));
    if (palabra) return `palabra clave "${palabra}"`;
    const patron = PATRONES.find(p => p.regex.test(texto));
    if (patron) return `patrón ${patron.nombre}`;
    return null;
}

/** Segunda opinión con IA. Sin API key se confía en la detección local. */
async function confirmarConIA(texto) {
    if (!model) return true;
    const prompt = `Analiza este mensaje: "${texto}". Responde BORRAR si contiene datos personales o sensibles ` +
        `(contraseñas, datos bancarios, documentos de identidad, direcciones, códigos). Responde CONSERVAR si no.`;
    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim().toUpperCase().includes('BORRAR');
    } catch (e) {
        return true;
    }
}

const fetchMessagesWithTimeout = (chat, limit) => Promise.race([
    chat.fetchMessages({ limit }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 20000)),
]);

// ================= CLIENTE =================
const client = new Client({
    authStrategy: new NoAuth(),
    puppeteer: {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--disable-gpu', '--disable-extensions'],
    },
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
    console.log('\n✅ Conectado. Cargando chats...');
    await new Promise(r => setTimeout(r, 5000));
    console.log(model ? '🤖 Confirmación con IA: activada' : 'ℹ️  Sin GEMINI_API_KEY: solo detección local');

    try {
        const allChats = await client.getChats();
        const chatsValidos = allChats.filter(c => c.id.server === 'c.us' || c.id.server === 'g.us');

        while (true) {
            console.log('\n' + '='.repeat(40));
            console.log('      LISTA DE CHATS DISPONIBLES');
            console.log('='.repeat(40));
            const mostrar = chatsValidos.slice(0, 50);
            mostrar.forEach((chat, i) => {
                console.log(`${i + 1}. ${chat.name || 'Sin nombre'} (${chat.isGroup ? 'Grupo' : 'Usuario'})`);
            });
            console.log('0. SALIR');

            const seleccion = parseInt(await preguntar('\n👉 Número del chat a limpiar: '));
            if (isNaN(seleccion) || seleccion < 0 || seleccion > mostrar.length) {
                console.log('❌ Opción inválida.');
                continue;
            }
            if (seleccion === 0) break;

            const chat = mostrar[seleccion - 1];
            const profundidad = parseInt(await preguntar('❓ ¿Cuántos mensajes hacia atrás reviso? (100 por defecto): ')) || 100;
            const simulacion = (await preguntar('🧪 ¿Modo simulación, sin borrar nada? (s/n): ')).trim().toLowerCase() === 's';

            console.log(`\n🚀 Revisando "${chat.name}" (${profundidad} mensajes${simulacion ? ', simulación' : ''})...`);
            try {
                const messages = await fetchMessagesWithTimeout(chat, profundidad);
                let borrados = 0;
                for (const msg of messages) {
                    if (!msg.body) continue;
                    const motivo = detectarSensible(msg.body);
                    if (!motivo) continue;

                    process.stdout.write(`   ⚠️ ${motivo}: "${msg.body.substring(0, 20)}..." `);
                    if (!(await confirmarConIA(msg.body))) {
                        console.log('🟢 se conserva');
                        continue;
                    }
                    if (simulacion) {
                        console.log('🧪 se borraría');
                        borrados++;
                        continue;
                    }
                    try {
                        await msg.delete(msg.fromMe); // para todos si es propio, si no solo para mí
                        registrarBorrado(chat.name, motivo);
                        console.log('✅ borrado');
                        borrados++;
                        await new Promise(r => setTimeout(r, PAUSA_ENTRE_BORRADOS_MS));
                    } catch (e) {
                        console.log('❌ no se pudo borrar');
                    }
                }
                console.log(`\n🏁 Listo: ${borrados} mensajes ${simulacion ? 'detectados' : 'borrados'}.`);
            } catch (err) {
                console.error('❌ Error procesando el chat:', err.message);
            }
            await preguntar('\nENTER para volver al menú...');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error fatal:', error);
    }
});

client.initialize();
