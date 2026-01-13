require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
// Yahan function ka naam change kiya hai
const { usePostgresAuthState } = require("postgres-baileys"); 
const { Pool } = require("pg");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const pino = require("pino");
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// --- 1. Render Keep-Alive Server ---
const PORT = process.env.PORT || 10000; // Render usually uses 10000
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EagleX Pro V3 is Running. Session: EagleX_Pro\n');
}).listen(PORT, () => {
    console.log(`✅ Alive Server listening on port ${PORT}`);
});

// --- 2. Configurations ---
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OWNER_JID = process.env.OWNER_NUMBER + "@s.whatsapp.net";
let botActive = true;

// --- 3. Main Bot Function ---
async function startEagleX() {
    console.log("🔄 Initializing Session: EagleX_Pro...");
    try {
        const { version } = await fetchLatestBaileysVersion();
        
        // Corrected function call here
        const { state, saveCreds } = await usePostgresAuthState(pool, "EagleX_Pro");

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
                console.log(`⚠️ Connection lost. Reconnecting: ${shouldReconnect}`);
                if (shouldReconnect) startEagleX();
            } else if (connection === "open") {
                console.log("✅ EagleX_Pro is officially ONLINE!");
                await sock.sendMessage(OWNER_JID, { text: "*EagleX Pro V3 Connect Ho Chuka Hai!* ✅" });
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
                if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 AI Assistant Paused." }); }
                if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ AI Assistant Active." }); }
                if (body === ".status") return sock.sendMessage(sender, { text: `EagleX Pro is Active.\nID: ${uuidv4()}` });
            }

            if (!botActive || isGroup) return;

            if (msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage) {
                await sock.sendMessage(OWNER_JID, { text: "📸 *View Once Message Found!*" });
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
                    await sock.readMessages([msg.key]);
                }, 1500);

            } catch (error) {
                console.error("AI Error:", error.message);
            }
        });

    } catch (err) {
        console.error("Initialization Error:", err);
        setTimeout(startEagleX, 5000); // Retry after 5s if DB fails
    }
}

startEagleX();
