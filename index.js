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

// --- RENDER DUMMY SERVER ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("EagleX Pro System: Online");
}).listen(PORT, '0.0.0.0');

async function startEagleX() {
    const { version } = await fetchLatestBaileysVersion();
    // Unique session ID to ensure a clean handshake
    const { state, saveCreds } = await usePostgreSQLAuthState(pool, "eaglex_pro_max");
    
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: true,
        syncFullHistory: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => startEagleX(), 5000);
            }
        } else if (connection === "open") {
            console.log("🚀 EagleX Pro is Live! 🤖");
            await sock.sendMessage(OWNER_JID, { text: "💎 *EagleX Pro Active*\nForwarding: *Targeted*\nGroups: *Ignored*\nStatus: *Online*" });
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const isGroup = sender.endsWith("@g.us");
        
        // STRICT RULE: No Group Processing
        if (isGroup) return;

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isOwner = sender === OWNER_JID;

        // 1. Presence Control (Typing & Read)
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate('composing', sender);

        // 2. Owner Admin Commands
        if (isOwner && body.startsWith(".")) {
            if (body === ".stop") { botActive = false; return sock.sendMessage(sender, { text: "🚫 *AI Paused.*" }); }
            if (body === ".start") { botActive = true; return sock.sendMessage(sender, { text: "✅ *AI Resumed.*" }); }
        }

        // 3. View-Once Bypass (.vv)
        if (body === ".vv" && msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            const viewOnce = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message;
            
            if (viewOnce) {
                const mediaType = Object.keys(viewOnce)[0];
                const stream = await downloadContentFromMessage(viewOnce[mediaType], mediaType.replace('Message', ''));
                let buffer = Buffer.from([]);
                for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                const mediaKey = mediaType.replace('Message', '');
                const forwardData = { caption: "🔓 *View-Once Decrypted for you Sir*" };
                forwardData[mediaKey] = buffer;
                return await sock.sendMessage(OWNER_JID, forwardData);
            }
        }

        // 4. Targeted Message Forwarding (Specific to "Tell Nasir/Owner")
        const lowerBody = body.toLowerCase();
        const keywords = ["tell nasir", "inform nasir", "tell owner", "inform owner", "to nasir", "tell him"];
        const needsForwarding = keywords.some(key => lowerBody.includes(key));

        if (!isOwner && needsForwarding) {
            const forwardNotice = `📌 *Direct Request for Nasir*\nFrom: @${sender.split('@')[0]}\nMessage: ${body}`;
            await sock.sendMessage(OWNER_JID, { text: forwardNotice, mentions: [sender] });
        }

        // 5. AI Chatting (Disabled in Groups)
        if (!botActive) return;

        try {
            const aiResponse = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "z-ai/glm-4.5-air:free",
                messages: [
                    { role: "system", content: process.env.CUSTOM_PROMPT || "You are Nasir's professional digital twin. Be helpful and polite." },
                    { role: "user", content: body }
                ]
            }, {
                headers: { 
                    "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            const reply = aiResponse.data.choices[0].message.content;
            await sock.sendMessage(sender, { text: reply }, { quoted: msg });
        } catch (error) {
            console.error("AI Error:", error.message);
        }
    });
}

startEagleX().catch(err => console.error("Boot Error:", err));
        
