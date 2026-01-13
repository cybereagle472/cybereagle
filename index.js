require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const { PostgresAuthState } = require("postgres-baileys");
const { Pool } = require("pg");
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const pino = require("pino");
const http = require('http');

// --- 1. Render Keep-Alive Server ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EagleX Pro V3 is Online and Active 🚀\n');
}).listen(PORT, () => {
    console.log(`✅ Alive Server listening on port ${PORT}`);
});

// --- 2. Database & AI Configuration ---
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const OWNER_JID = process.env.OWNER_NUMBER + "@s.whatsapp.net";
let botActive = true;

// --- 3. Main Bot Logic ---
async function startEagleX() {
    console.log("🔄 Initializing EagleX Pro Session...");
    const { version } = await fetchLatestBaileysVersion();
    
    // Aapka session name 'EagleX_Pro' set kiya hai
    const { state, saveCreds } = await PostgresAuthState(pool, "EagleX_Pro");

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
        markOnlineOnConnect: true,
        defaultQueryTimeoutMs: undefined
    });

    sock.ev.on("creds.update", saveCreds);

    // Connection Handling
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            console.log(`⚠️ Connection closed. Reason: ${reason}. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) startEagleX();
        } else if (connection === "open") {
            console.log("🚀 EagleX_Pro is now Online on WhatsApp!");
            await sock.sendMessage(OWNER_JID, { text: "✅ *EagleX_Pro Online!*\nYour Digital Twin is ready to chat." });
        }
    });

    // Message Handling
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith("@g.us");
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isOwner = sender === OWNER_JID;

        // Admin Commands
        if (isOwner) {
            if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 Bot Paused." }); }
            if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ Bot Active." }); }
            if (body === ".ping") return sock.sendMessage(sender, { text: "Pong! 🏓 EagleX is running perfectly." });
        }

        // Filters: Active check & No Groups
        if (!botActive || isGroup) return;

        // --- View Once Bypass ---
        if (msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage) {
            await sock.sendMessage(OWNER_JID, { text: "📸 *View Once Content Detected:* Forwarding to you..." });
            await sock.sendMessage(OWNER_JID, { forward: msg }, { quoted: msg });
        }

        // --- Gemini AI Interaction ---
        await sock.sendPresenceUpdate('composing', sender);
        await sock.readMessages([msg.key]);

        try {
            const model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                systemInstruction: process.env.CUSTOM_PROMPT 
            });

            const generationConfig = {
                temperature: 0.9,
                topP: 0.95,
                maxOutputTokens: 500,
            };

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: body }] }],
                generationConfig,
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                ],
            });

            const reply = result.response.text();
            
            // Artificial delay to feel more human
            setTimeout(async () => {
                await sock.sendMessage(sender, { text: reply }, { quoted: msg });
            }, 2000);

        } catch (err) {
            console.error("AI Error:", err.message);
        }
    });
}

// Start the bot
startEagleX().catch(err => console.error("Initialization Error:", err));
  
