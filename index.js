const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, AuthenticationState } = require("@whiskeysockets/baileys");
const axios = require("axios");
const fs = require("fs");
const pino = require("pino");
const express = require("express");

// 1. WEB SERVER TO KEEP RENDER HAPPY
const app = express();
app.get('/', (req, res) => res.send('EagleX is Active 🦅'));
app.listen(process.env.PORT || 3000);

// 2. SETTINGS
const CONFIG = {
    owner: "9779822691613@s.whatsapp.net",
    model: "z-ai/glm-4.5-air:free"
};

async function startEagleX() {
    console.log("🚀 Powering up EagleX...");

    // CLEAN START: Always wipe old session data to prevent Code 405
    if (fs.existsSync('./session')) {
        fs.rmSync('./session', { recursive: true, force: true });
    }
    fs.mkdirSync('./session');

    // DECODE SESSION FROM ENV
    const rawId = process.env.SESSION_ID || "";
    const sessionData = rawId.replace("ARSLAN-MD~", "").trim();
    
    if (!sessionData) {
        console.error("❌ NO SESSION_ID FOUND IN RENDER ENV!");
        return;
    }

    try {
        const decoded = Buffer.from(sessionData, 'base64').toString('utf-8');
        fs.writeFileSync('./session/creds.json', decoded);
    } catch (e) {
        console.error("❌ SESSION_ID IS INVALID BASE64!");
        return;
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // Silent to avoid log clutter
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log("✅ EAGLEX IS LIVE!");
            await sock.sendMessage(CONFIG.owner, { text: "🦅 *EagleX is back online and ready!*" });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log("❌ Connection lost. Reason:", reason);
            
            // If the session is totally dead (401 or 405), we stop to avoid loops
            if (reason === DisconnectReason.loggedOut || reason === 405) {
                console.error("‼️ SESSION EXPIRED. GET A NEW CODE FROM PAIRING SITE.");
            } else {
                startEagleX(); // Reconnect for temporary glitches
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        console.log(`📩 Message from ${sender}: ${text}`);

        try {
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: CONFIG.model,
                messages: [
                    { role: "system", content: "You are EagleX, a professional AI assistant. Speak English and Roman Urdu." },
                    { role: "user", content: text }
                ]
            }, {
                headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` }
            });

            const reply = response.data.choices[0].message.content;
            await sock.sendMessage(sender, { text: reply });
        } catch (err) {
            console.error("AI Error");
        }
    });
}

startEagleX();
                                
