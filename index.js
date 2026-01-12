const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const { usePostgreSQLAuthState } = require("postgres-baileys");
const { Pool } = require("pg");
const axios = require("axios");
const express = require("express");
const pino = require("pino");

const app = express();
const SESSION_ID = "EagleX_Master_Session"; 

// --- AI INTELLIGENCE ---
const AI_PROMPT = `You are EagleX, the Digital Twin of Muhammad Nasir. 
- Identity: Elite Personal Assistant. 
- Memory: Track conversation context. 
- Tone: Sophisticated and helpful.`;

app.get('/', (req, res) => res.send("EagleX Engine: Waiting for Session..."));
app.listen(process.env.PORT || 10000);

const chatMemory = {};

async function startEagleX() {
    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL, 
        ssl: { rejectUnauthorized: false },
        max: 5 
    });

    try {
        const { state, saveCreds } = await usePostgreSQLAuthState(pool, SESSION_ID);
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome")
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (up) => {
            const { connection } = up;
            if (connection === 'open') {
                console.log("✅ SESSION FOUND: EagleX is now LIVE.");
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

            if (!chatMemory[sender]) chatMemory[sender] = [];
            chatMemory[sender].push({ role: "user", content: text });
            if (chatMemory[sender].length > 6) chatMemory[sender].shift();

            try {
                const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [{ role: "system", content: AI_PROMPT }, ...chatMemory[sender]]
                }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` } });

                await sock.sendMessage(sender, { text: res.data.choices[0].message.content }, { quoted: msg });
            } catch (e) { console.log("AI Error"); }
        });
    } catch (err) { setTimeout(startEagleX, 10000); }
}
startEagleX();
            
