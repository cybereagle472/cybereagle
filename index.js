const { 
    default: makeWASocket, 
    DisconnectReason, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion,
    Browsers,
    delay
} = require("@whiskeysockets/baileys");
const { usePostgreSQLAuthState } = require("postgres-baileys");
const { Pool } = require("pg");
const axios = require("axios");
const express = require("express");
const pino = require("pino");

const app = express();
const MY_NUMBER = "923245115847";
const OWNER_NAME = "Muhammad Nasir";
const SESSION_ID = "EagleX_Ultra_V10"; // New fresh ID

// --- AI CUSTOM INSTRUCTIONS & MEMORY ---
const AI_PROMPT = `You are EagleX, the elite Digital Twin of ${OWNER_NAME}.
- IDENTITY: You are Nasir's personal assistant. Be professional, direct, and highly intelligent.
- MEMORY: Always remember you are talking to Nasir's contacts. 
- LANGUAGE: Detect and mirror the user (English/Urdu/Roman Urdu).
- STYLE: Use 🦅, ⚡, or 🛡️ rarely. Never act like a generic bot.
- SPECIAL: If Nasir himself (${MY_NUMBER}) speaks, be ultra-obedient.`;

app.get('/', (req, res) => res.status(200).send("EagleX Pro: Active"));
app.listen(process.env.PORT || 10000);

// Simple In-Memory Chat History
const chatMemory = {};

async function startEagleX() {
    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 5,
    });

    try {
        const { state, saveCreds } = await usePostgreSQLAuthState(pool, SESSION_ID);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome")
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                console.log("✅ [EAGLEX] CORE ONLINE & SYNCED");
                await sock.sendMessage(`${MY_NUMBER}@s.whatsapp.net`, { text: "🦅 *EagleX System Online.* Digital Twin Active." });
            }
            if (connection === 'close') {
                if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startEagleX();
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

            // Memory Logic: Keep track of last 3 messages
            if (!chatMemory[sender]) chatMemory[sender] = [];
            chatMemory[sender].push({ role: "user", content: text });
            if (chatMemory[sender].length > 4) chatMemory[sender].shift();

            await sock.sendPresenceUpdate('composing', sender);
            try {
                const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [
                        { role: "system", content: AI_PROMPT },
                        ...chatMemory[sender]
                    ]
                }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` } });

                const aiReply = response.data.choices[0].message.content;
                chatMemory[sender].push({ role: "assistant", content: aiReply });

                await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
            } catch (e) { console.log("AI Error"); }
        });

    } catch (err) { console.log(err); }
}
startEagleX();
            
