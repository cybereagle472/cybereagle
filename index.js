require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

// --- FIXED: Using the exact name from your logs ---
const { usePostgreSQLAuthState } = require("postgres-baileys"); 

const { Pool } = require("pg");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const pino = require("pino");
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// 1. Render Keep-Alive Server (Port 10000)
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EagleX Pro V3 is Online | Session: EagleX_Pro\n');
}).listen(PORT, () => {
    console.log(`✅ Render Health Check Server active on port ${PORT}`);
});

// 2. Database Connection (PostgreSQL)
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

// 3. AI Configuration (Gemini)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OWNER_JID = process.env.OWNER_NUMBER + "@s.whatsapp.net";
let botActive = true;

async function startEagleX() {
    console.log("🔄 Initializing Session: EagleX_Pro...");
    
    try {
        const { version } = await fetchLatestBaileysVersion();
        
        // Corrected based on your specific module logs
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

        // Connection Handling
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = reason !== DisconnectReason.loggedOut;
                console.log(`⚠️ Connection closed (Reason: ${reason}). Reconnecting: ${shouldReconnect}`);
                if (shouldReconnect) {
                    setTimeout(startEagleX, 5000); // 5 sec wait before reconnect
                }
            } else if (connection === "open") {
                console.log("✅ EagleX_Pro is now ONLINE!");
                await sock.sendMessage(OWNER_JID, { text: "✅ *EagleX Pro V3 Connect Ho Chuka Hai!*" });
            }
        });

        // Message Handling
        sock.ev.on("messages.upsert", async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const isOwner = sender === OWNER_JID;
            const isGroup = sender.endsWith("@g.us");

            // --- Admin Commands ---
            if (isOwner) {
                if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 Bot Paused." }); }
                if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ Bot Active." }); }
                if (body === ".status") return sock.sendMessage(sender, { text: `Status: Active\nID: ${uuidv4()}\nSession: EagleX_Pro` });
            }

            if (!botActive || isGroup) return;

            // --- View Once Bypass ---
            if (msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage) {
                await sock.sendMessage(OWNER_JID, { text: "📸 *View Once Detected:* Forwarding..." });
                await sock.sendMessage(OWNER_JID, { forward: msg }, { quoted: msg });
            }

            // --- Gemini AI Logic ---
            await sock.sendPresenceUpdate('composing', sender);
            
            try {
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    systemInstruction: process.env.CUSTOM_PROMPT || "You are Muhammad Nasir, be witty and helpful."
                });

                const result = await model.generateContent(body);
                const aiReply = result.response.text();

                await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
                await sock.readMessages([msg.key]); // Auto-read message

            } catch (error) {
                console.error("AI Error:", error.message);
            }
        });

    } catch (err) {
        console.error("Critical Initialization Error:", err.message);
        setTimeout(startEagleX, 10000);
    }
}

// Global Process Handlers
process.on('uncaughtException', (err) => console.error('Uncaught:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));

startEagleX();
                
