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
                await sock.sendMessage(OWNER_JID, { text: "✅ *EagleX Pro V3 Connected!*\nAI Intelligence Activated." });
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
                if (body === ".status") return sock.sendMessage(sender, { text: `EagleX Pro Status: Active\nUUID: ${uuidv4()}` });
            }

            if (!botActive || isGroup) return;

            // --- 3. View Once Bypass ---
            if (msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage) {
                await sock.sendMessage(OWNER_JID, { text: "📸 *View Once Detected!*" });
                await sock.sendMessage(OWNER_JID, { forward: msg }, { quoted: msg });
                return; 
            }

            // --- 4. Intelligent AI Logic (Optimized Gemini 1.5 Flash) ---
            await sock.sendPresenceUpdate('composing', sender); 

            try {
                // Hum 'gemini-1.5-flash' use kar rahe hain jo fastest aur conversational hai
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    // Yahan environment variable ki instructions integrate ho rahi hain
                    systemInstruction: process.env.CUSTOM_PROMPT || "You are a helpful and witty AI assistant."
                });

                // Chat structure for better conversation flow
                const chat = model.startChat({
                    history: [],
                    generationConfig: {
                        maxOutputTokens: 1000,
                    },
                });

                const result = await chat.sendMessage(body);
                const aiReply = result.response.text();

                if (aiReply) {
                    await delay(1500); // Natural delay
                    await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
                }

            } catch (error) {
                console.error("AI Error:", error.message);
                
                // Fallback Logic: Agar Flash 404 de ya fail ho, to alternate endpoint try karein
                try {
                    const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro" });
                    const fbPrompt = `${process.env.CUSTOM_PROMPT}\n\nUser: ${body}`;
                    const fbResult = await fallbackModel.generateContent(fbPrompt);
                    await sock.sendMessage(sender, { text: fbResult.response.text() }, { quoted: msg });
                } catch (e) {
                    console.log("AI completely failed to respond.");
                }
            }
        });

    } catch (err) {
        console.error("Critical Error:", err.message);
        setTimeout(startEagleX, 10000);
    }
}

startEagleX();
