require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

// --- 1. Smart Import for postgres-baileys ---
const PostgresBaileys = require("postgres-baileys");
// Ye line har tarah ke export ko handle karegi
const initPostgresAuth = PostgresBaileys.usePostgresAuthState || 
                         PostgresBaileys.PostgresAuthState || 
                         (PostgresBaileys.default && PostgresBaileys.default.usePostgresAuthState) ||
                         PostgresBaileys.default || 
                         PostgresBaileys;

const { Pool } = require("pg");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const pino = require("pino");
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// --- 2. Render Keep-Alive Server ---
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EagleX Pro V3 is Running. ID: ' + uuidv4() + '\n');
}).listen(PORT, () => {
    console.log(`✅ Alive Server listening on port ${PORT}`);
});

// --- 3. Configurations ---
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OWNER_JID = process.env.OWNER_NUMBER + "@s.whatsapp.net";
let botActive = true;

// --- 4. Main Bot Function ---
async function startEagleX() {
    console.log("🔄 Initializing Session: EagleX_Pro...");
    
    try {
        const { version } = await fetchLatestBaileysVersion();
        
        // Dynamic function call
        if (typeof initPostgresAuth !== 'function') {
            throw new Error("Could not find a valid Auth function in postgres-baileys module");
        }

        const { state, saveCreds } = await initPostgresAuth(pool, "EagleX_Pro");

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.ubuntu("Chrome"),
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = reason !== DisconnectReason.loggedOut;
                console.log(`⚠️ Connection lost. Reconnecting in 5s...`);
                if (shouldReconnect) setTimeout(startEagleX, 5000);
            } else if (connection === "open") {
                console.log("✅ EagleX_Pro is officially ONLINE!");
                await sock.sendMessage(OWNER_JID, { text: "*EagleX Pro V3 Online!* ✅\nSystem logic fixed successfully." });
            }
        });

        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const isOwner = sender === OWNER_JID;
            const isGroup = sender.endsWith("@g.us");

            if (isOwner) {
                if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 Assistant Paused." }); }
                if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ Assistant Active." }); }
                if (body === ".status") return sock.sendMessage(sender, { text: `EagleX Pro Status: Active\nSession: EagleX_Pro\nUUID: ${uuidv4()}` });
            }

            if (!botActive || isGroup) return;

            // View Once Bypass
            if (msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage) {
                await sock.sendMessage(OWNER_JID, { text: "📸 *View Once Content:* Forwarding..." });
                await sock.sendMessage(OWNER_JID, { forward: msg }, { quoted: msg });
            }

            await sock.sendPresenceUpdate('composing', sender);
            
            try {
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    systemInstruction: process.env.CUSTOM_PROMPT 
                });

                const result = await model.generateContent(body);
                const aiReply = result.response.text();

                setTimeout(async () => {
                    await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
                }, 1000);

            } catch (error) {
                console.error("Gemini Error:", error.message);
            }
        });

    } catch (err) {
        console.error("Critical Initialization Error:", err.message);
        // Error hone par auto-restart logic
        setTimeout(startEagleX, 10000);
    }
}

// Global error handler
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

startEagleX();
