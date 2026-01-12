
                                
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const axios = require("axios");
const fs = require("fs");
const pino = require("pino");
const express = require("express");

/** * 1. PERSISTENCE LAYER (Keep Render Alive)
 */
const app = express();
app.get('/', (req, res) => res.status(200).send({ status: "Active", bot: "EagleX Professional" }));
app.listen(process.env.PORT || 10000, () => console.log("--- SYSTEM: SERVER ONLINE ON PORT 10000 ---"));

/**
 * 2. MASTER CONFIGURATION
 */
const CONFIG = {
    owner: "9779822691613@s.whatsapp.net",
    model: "z-ai/glm-4.5-air:free",
    systemPrompt: `
        Identity: You are EagleX, a world-class AI Personal Assistant.
        Personality: Intelligent, professional, loyal, and efficient.
        Capabilities: You switch naturally between English, Urdu, and Roman Urdu.
        Rules: 
        1. Always provide high-value, concise, and helpful responses.
        2. Never show internal <reasoning> tags or thinking process.
        3. Acknowledge your owner as the developer and master.
        4. Be polite but firm in your professional persona.
    `
};

/**
 * 3. CORE BOT ENGINE
 */
async function startEagleX() {
    console.log("--- ENGINE: INITIALIZING EAGLEX ---");

    // CRITICAL: Wipe old session to prevent Error 405 loop
    if (fs.existsSync('./session')) {
        fs.rmSync('./session', { recursive: true, force: true });
        console.log("--- SYSTEM: OLD SESSION WIPED ---");
    }
    fs.mkdirSync('./session');

    // DECODE SESSION FROM RENDER ENV
    const rawId = process.env.SESSION_ID || "";
    const sessionData = rawId.includes('~') ? rawId.split('~')[1] : rawId;
    
    if (!sessionData) {
        return console.error("--- ERROR: NO SESSION_ID FOUND IN ENVIRONMENT ---");
    }

    try {
        const decoded = Buffer.from(sessionData, 'base64').toString('utf-8');
        fs.writeFileSync('./session/creds.json', decoded);
    } catch (e) {
        return console.error("--- ERROR: INVALID SESSION_ID ENCODING ---");
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["EagleX AI", "Safari", "1.0.0"],
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log("✅ EAGLEX CONNECTED SUCCESSFULLY!");
            await sock.sendMessage(CONFIG.owner, { text: "🦅 *EagleX Systems Online.* \n\nI am ready to assist you professionally." });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ CONNECTION CLOSED. REASON: ${reason}`);

            if (reason === 405 || reason === DisconnectReason.loggedOut) {
                console.error("--- SESSION REVOKED: PLEASE GET A NEW CODE ---");
            } else {
                console.log("--- RECONNECTING IN 5 SECONDS... ---");
                setTimeout(startEagleX, 5000);
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        console.log(`📩 INCOMING [${sender}]: ${text}`);

        // Set typing status
        await sock.sendPresenceUpdate('composing', sender);

        try {
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: CONFIG.model,
                messages: [
                    { role: "system", content: CONFIG.systemPrompt },
                    { role: "user", content: text }
                ],
                temperature: 0.7
            }, {
                headers: { 
                    "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
                    "HTTP-Referer": "https://render.com",
                    "X-Title": "EagleX Assistant"
                }
            });

            const reply = response.data.choices[0].message.content;
            await sock.sendMessage(sender, { text: reply });

        } catch (err) {
            console.error("--- AI PROCESSING ERROR ---");
            const errorStatus = err.response?.status;
            if (errorStatus === 401) {
                await sock.sendMessage(CONFIG.owner, { text: "⚠️ *EagleX Alert:* OpenRouter API Key is invalid." });
            }
        }
    });
}

// Start the process
startEagleX();
