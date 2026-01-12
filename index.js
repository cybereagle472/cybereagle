require('dotenv').config();
const { 
    default: makeWASocket, 
    DisconnectReason, 
    Browsers, 
    fetchLatestBaileysVersion, 
    downloadContentFromMessage,
    getContentType 
} = require("@whiskeysockets/baileys");
const { usePostgreSQLAuthState } = require("postgres-baileys");
const { Pool } = require("pg");
const axios = require("axios");
const pino = require("pino");
const http = require("http");

// --- CONFIGURATION ---
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const OWNER_JID = process.env.OWNER_NUMBER + "@s.whatsapp.net";
let botActive = true;

// --- RENDER ALIVE SYSTEM ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("EagleX Engine: Operational");
}).listen(PORT, '0.0.0.0');

async function startEagleX() {
    const { version } = await fetchLatestBaileysVersion();
    
    // Shared Session ID: Must match what you use in Termux pair.js
    const { state, saveCreds } = await usePostgreSQLAuthState(pool, "EagleX_Pro");
    
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: true,
        syncFullHistory: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`[SYSTEM] Connection lost. Reason: ${reason}`);
            
            // Reconnect if not a logout
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => startEagleX(), 5000);
            } else {
                console.log("❌ Logged out. Please re-pair via Termux.");
            }
        } else if (connection === "open") {
            console.log("🚀 EagleX Pro Max is Live on Render! 🤖");
            await sock.sendMessage(OWNER_JID, { 
                text: "💎 *EagleX Pro Max Engine Started*\n\nMode: *Cloud-Active*\nSession: *Synced from Database*" 
            });
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        if (sender.endsWith("@g.us")) return; // STRICT NO-GROUP RULE

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isOwner = sender === OWNER_JID;

        // 1. Presence & Interaction
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate('composing', sender);

        // 2. View-Once Bypass (.vv)
        if (body === ".vv" && msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            const viewOnce = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message;
            
            if (viewOnce) {
                const mediaType = Object.keys(viewOnce)[0];
                const stream = await downloadContentFromMessage(viewOnce[mediaType], mediaType.replace('Message', ''));
                let buffer = Buffer.from([]);
                for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                const mediaKey = mediaType.replace('Message', '');
                return await sock.sendMessage(OWNER_JID, { 
                    [mediaKey]: buffer, 
                    caption: "🔓 *View-Once Decrypted for you Sir*" 
                });
            }
        }

        // 3. Admin Commands
        if (isOwner && body.startsWith(".")) {
            if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 *AI Paused.*" }); }
            if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ *AI Resumed.*" }); }
        }

        // 4. Targeted Forwarding
        const lowerBody = body.toLowerCase();
        const keywords = ["tell nasir", "inform nasir", "tell owner", "inform owner", "to nasir", "tell him"];
        if (!isOwner && keywords.some(key => lowerBody.includes(key))) {
            await sock.sendMessage(OWNER_JID, { 
                text: `📌 *Direct Request for Nasir*\nFrom: @${sender.split('@')[0]}\nMessage: ${body}`,
                mentions: [sender]
            });
        }

        // 5. AI Chatting
        if (!botActive) return;

        try {
            const aiResponse = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "google/gemma-3n-e2b-it:free",
                messages: [
                    { role: "system", content: process.env.CUSTOM_PROMPT || "You are Nasir's assistant." },
                    { role: "user", content: body }
                ]
            }, {
                headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` }
            });

            await sock.sendMessage(sender, { text: aiResponse.data.choices[0].message.content }, { quoted: msg });
        } catch (error) {
            console.error("AI Error:", error.message);
        }
    });
}

startEagleX().catch(err => console.error("Boot Error:", err));
        
