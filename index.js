require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { PostgresAuthState } = require("postgres-baileys");
const { Pool } = require("pg");
const axios = require("axios");
const pino = require("pino");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const OWNER_JID = process.env.OWNER_NUMBER + "@s.whatsapp.net";
let botActive = true;

async function startEagleX() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await PostgresAuthState(pool, "eaglex_session");
    
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
                setTimeout(() => startEagleX(), 5000); // 5 sec delay before reconnect
            }
        } else if (connection === "open") {
            console.log("🚀 EagleX V3 Connected Successfully!");
            await sock.sendMessage(OWNER_JID, { text: "✅ *EagleX V3 Online!* Your digital twin is now active." });
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isOwner = sender === OWNER_JID;

        // --- Admin Commands ---
        if (isOwner && body.startsWith(".")) {
            if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 Bot Deactivated." }); }
            if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ Bot Activated." }); }
        }

        if (!botActive || sender.endsWith("@g.us")) return;

        // --- View Once Bypass ---
        if (msg.message.viewOnceMessageV2 || msg.message.viewOnceMessage) {
            await sock.sendMessage(OWNER_JID, { text: "📸 *View Once Detected:* Forwarding..." });
            await sock.sendMessage(OWNER_JID, { forward: msg }, { quoted: msg });
        }

        // --- AI Processing ---
        await sock.sendPresenceUpdate('composing', sender);
        await sock.readMessages([msg.key]);

        try {
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "glm-4.5-air",
                messages: [
                    { role: "system", content: process.env.CUSTOM_PROMPT },
                    { role: "user", content: body }
                ]
            }, {
                headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` }
            });

            const aiReply = response.data.choices[0].message.content;
            await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
        } catch (error) {
            console.error("AI API Error");
        }
    });
}

startEagleX();
      
