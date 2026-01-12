require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { usePostgreSQLAuthState } = require("postgres-baileys");
const { Pool } = require("pg");
const axios = require("axios");
const pino = require("pino");
const http = require("http"); // Added for Render fix

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const OWNER_JID = process.env.OWNER_NUMBER + "@s.whatsapp.net";
let botActive = true;

// --- DUMMY SERVER FOR RENDER ---
// This prevents the "No open ports detected" error
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EagleX Bot is running...');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Port binding successful on ${PORT}`);
});

async function startEagleX() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await usePostgreSQLAuthState(pool, "eaglex_session");
    
    const sock = makeWASocket({
        version,
        auth: state,
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
            console.log(`Connection closed. Reason: ${reason}`);
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => startEagleX(), 5000);
            }
        } else if (connection === "open") {
            console.log("🚀 EagleX V3 Connected Successfully!");
            await sock.sendMessage(OWNER_JID, { text: "✅ *EagleX V3 Online!*" });
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isOwner = sender === OWNER_JID;

        if (isOwner && body.startsWith(".")) {
            if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 Bot Deactivated." }); }
            if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ Bot Activated." }); }
        }

        if (!botActive || sender.endsWith("@g.us")) return;

        // --- AI Processing ---
        await sock.sendPresenceUpdate('composing', sender);
        
        try {
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "z-ai/glm-4.5-air:free", // Corrected model name
                messages: [
                    { role: "system", content: process.env.CUSTOM_PROMPT || "You are a helpful assistant." },
                    { role: "user", content: body }
                ]
            }, {
                headers: { 
                    "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://render.com", // Optional but recommended by OpenRouter
                }
            });

            const aiReply = response.data.choices[0].message.content;
            await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
        } catch (error) {
            // This will tell you exactly what is wrong (e.g., Insufficient Credits or Invalid Key)
            console.error("AI API Error:", error.response?.data || error.message);
        }
    });
}

startEagleX();
