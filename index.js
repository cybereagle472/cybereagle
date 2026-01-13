require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");

// Database & Session
const { usePostgreSQLAuthState } = require("postgres-baileys"); 
const { Pool } = require("pg");

// AI & Utils
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pino = require("pino");
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// 1. Render Health Check Server (Port 10000)
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EagleX Pro V3 Running | UUID: ' + uuidv4());
}).listen(PORT);

// 2. Database & API Config
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OWNER_JID = process.env.OWNER_NUMBER + "@s.whatsapp.net";
let botActive = true;

async function startEagleX() {
    console.log("🔄 Initializing Session: EagleX_Pro...");
    
    try {
        const { version } = await fetchLatestBaileysVersion();
        
        // Session Initialization (Using the confirmed log name)
        const { state, saveCreds } = await usePostgreSQLAuthState(pool, "EagleX_Pro");

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.ubuntu("Chrome"),
            markOnlineOnConnect: true
        });

        sock.ev.on("creds.update", saveCreds);

        // Connection Manager
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed. Reason: ${reason}. Reconnecting...`);
                if (reason !== DisconnectReason.loggedOut) {
                    setTimeout(startEagleX, 5000);
                }
            } else if (connection === "open") {
                console.log("✅ EagleX_Pro is ONLINE!");
                await sock.sendMessage(OWNER_JID, { text: "✅ *EagleX Pro V3 Connected!*\nDatabase Refreshed Successfully." });
            }
        });

        // Message Manager
        sock.ev.on("messages.upsert", async ({ messages, type }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe || type !== 'notify') return;

            const sender = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const isOwner = sender === OWNER_JID;
            const isGroup = sender.endsWith("@g.us");

            // --- 1. Blue Tick (Immediate) ---
            await sock.readMessages([msg.key]);

            // --- 2. Admin Controls ---
            if (isOwner) {
                if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 AI Assistant Paused." }); }
                if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ AI Assistant Active." }); }
                if (body === ".status") return sock.sendMessage(sender, { text: `EagleX Pro Status: Active\nSession: EagleX_Pro\nUUID: ${uuidv4()}` });
            }

            if (!botActive || isGroup) return;

            // --- 3. View Once Bypass ---
            if (msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage) {
                await sock.sendMessage(OWNER_JID, { text: "📸 *View Once Detected!*" });
                await sock.sendMessage(OWNER_JID, { forward: msg }, { quoted: msg });
                return; 
            }

            // --- 4. Gemini AI Logic ---
            await sock.sendPresenceUpdate('composing', sender); // Typing Indicator

            try {
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash" 
                });

                const result = await model.generateContent({
                    contents: [{ 
                        role: "user", 
                        parts: [{ text: (process.env.CUSTOM_PROMPT || "You are Muhammad Nasir") + "\n\nUser: " + body }] 
                    }]
                });

                const aiReply = result.response.text();

                // Human-like delay
                await delay(2000);
                await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });

            } catch (error) {
                console.error("AI Error:", error.message);
            }
        });

    } catch (err) {
        console.error("Critical Error:", err.message);
        setTimeout(startEagleX, 10000);
    }
}

startEagleX();
