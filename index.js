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

// 1. Render Health Check
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EagleX Pro V3 Running');
}).listen(PORT);

// 2. Database Config
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

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;
                // Reason 440 is a stream error, we just need to reconnect
                if (reason !== DisconnectReason.loggedOut) {
                    setTimeout(startEagleX, 5000);
                }
            } else if (connection === "open") {
                console.log("✅ EagleX_Pro is ONLINE!");
            }
        });

        sock.ev.on("messages.upsert", async ({ messages, type }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe || type !== 'notify') return;

            const sender = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const isOwner = sender === OWNER_JID;

            await sock.readMessages([msg.key]);

            if (isOwner) {
                if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 Paused." }); }
                if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ Active." }); }
            }

            if (!botActive || sender.endsWith("@g.us")) return;

            // --- AI LOGIC (RE-ENGINEERED) ---
            await sock.sendPresenceUpdate('composing', sender); 

            try {
                // Flash 1.5 Latest is the most stable free model
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

                // We inject the CUSTOM_PROMPT directly into the prompt to avoid 404/v1beta errors
                const instruction = process.env.CUSTOM_PROMPT || "You are Muhammad Nasir.";
                const finalPrompt = `Instructions: ${instruction}\n\nUser Question: ${body}`;

                const result = await model.generateContent(finalPrompt);
                const aiReply = result.response.text();

                if (aiReply) {
                    await delay(1000);
                    await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
                }

            } catch (error) {
                console.error("AI Error:", error.message);
                // Last Resort: Direct string fallback if model object fails
                try {
                    const modelFallback = genAI.getGenerativeModel({ model: "gemini-pro" });
                    const res = await modelFallback.generateContent(body);
                    await sock.sendMessage(sender, { text: res.response.text() }, { quoted: msg });
                } catch (e) {
                    console.log("AI Failed.");
                }
            }
        });

    } catch (err) {
        setTimeout(startEagleX, 10000);
    }
}

startEagleX();
        
