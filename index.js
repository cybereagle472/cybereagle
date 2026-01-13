require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

// --- Fixed Import for postgres-baileys v1.5.0 ---
const PGBaileys = require("postgres-baileys");
// Debug: Logs mein dikhayega ke library ke paas kya functions hain
console.log("Module Keys:", Object.keys(PGBaileys));

const usePostgresAuthState = PGBaileys.usePostgresAuthState || PGBaileys.default?.usePostgresAuthState || PGBaileys.default || PGBaileys;

const { Pool } = require("pg");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const pino = require("pino");
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// --- 1. Render Keep-Alive Server ---
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EagleX Pro V3 Running | Session: EagleX_Pro\n');
}).listen(PORT);

// --- 2. Configurations ---
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OWNER_JID = process.env.OWNER_NUMBER + "@s.whatsapp.net";
let botActive = true;

// --- 3. Main Bot Logic ---
async function startEagleX() {
    console.log("🔄 Initializing Session: EagleX_Pro...");
    
    try {
        const { version } = await fetchLatestBaileysVersion();
        
        // Session Initialization
        const { state, saveCreds } = await usePostgresAuthState(pool, "EagleX_Pro");

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            browser: Browsers.ubuntu("Chrome"),
            markOnlineOnConnect: true
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed. Reason: ${reason}`);
                if (reason !== DisconnectReason.loggedOut) {
                    setTimeout(startEagleX, 5000);
                }
            } else if (connection === "open") {
                console.log("✅ EagleX_Pro is ONLINE!");
                await sock.sendMessage(OWNER_JID, { text: "✅ *EagleX Pro Connected Successfully!*" });
            }
        });

        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            
            if (sender === OWNER_JID) {
                if (body === ".status") return sock.sendMessage(sender, { text: `Active | ID: ${uuidv4()}` });
            }

            if (!botActive || sender.endsWith("@g.us")) return;

            // View Once Bypass
            if (msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage) {
                await sock.sendMessage(OWNER_JID, { forward: msg });
            }

            // AI Response
            try {
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    systemInstruction: process.env.CUSTOM_PROMPT 
                });
                const result = await model.generateContent(body);
                await sock.sendMessage(sender, { text: result.response.text() }, { quoted: msg });
            } catch (e) {
                console.log("Gemini Error:", e.message);
            }
        });

    } catch (err) {
        console.error("❌ Fatal Error:", err.message);
        setTimeout(startEagleX, 10000);
    }
}

startEagleX();
            
