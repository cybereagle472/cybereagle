const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const axios = require("axios");
const fs = require("fs");
const pino = require("pino");
const express = require("express");

// --- 1. SOLVE RENDER PORT ISSUE ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('EagleX is Active and Online! 🦅'));
app.listen(PORT, () => console.log(`✅ Port binding successful on: ${PORT}`));

// --- 2. BOT CONFIGURATION ---
const CONFIG = {
    ownerNumber: "9779822691613@s.whatsapp.net", // ⚠️ Update this with your exact WhatsApp ID
    aiModel: "z-ai/glm-4.5-air:free", 
    systemPrompt: `
        You are EagleX, a professional and chatty personal assistant.
        - Speak English, Roman Urdu (Pakistani style), and Pure Urdu.
        - Switch languages naturally like a human.
        - Be friendly with friends/family but maintain a professional tone.
        - You use internet data when asked for news or facts.
    `
};

let isBotActive = true;

async function startEagleX() {
    // 3. SESSION DECODE (Direct from Environment Variable)
    if (!fs.existsSync('./session/creds.json')) {
        const rawId = process.env.SESSION_ID || "";
        const sessionData = rawId.replace("ARSLAN-MD~", "").trim();
        
        if (!sessionData) {
            console.error("❌ ERROR: SESSION_ID is missing!");
            return;
        }

        try {
            console.log("EagleX: Decoding session data...");
            const decoded = Buffer.from(sessionData, 'base64').toString('utf-8');
            if (!fs.existsSync('./session')) fs.mkdirSync('./session');
            fs.writeFileSync('./session/creds.json', decoded);
            console.log("EagleX: Session file created! ✅");
        } catch (e) {
            console.error("❌ Session Error: Invalid Base64 string.");
            return;
        }
    }

    // 4. WHATSAPP CONNECTION
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startEagleX();
        } else if (connection === 'open') {
            console.log('🦅 EagleX is officially LIVE on WhatsApp!');
        }
    });

    // 5. MESSAGE HANDLING
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();
        
        // Log incoming messages for debugging
        console.log(`📩 New Message from [${sender}]: ${text}`);

        // OWNER COMMANDS
        if (sender === CONFIG.ownerNumber) {
            if (text === ".eagle stop") {
                isBotActive = false;
                return await sock.sendMessage(sender, { text: "*EagleX Stopped.* 🛑" });
            }
            if (text === ".eagle start") {
                isBotActive = true;
                return await sock.sendMessage(sender, { text: "*EagleX Started!* 🦅" });
            }
        }

        // AI REPLY LOGIC
        if (isBotActive) {
            try {
                await sock.sendPresenceUpdate('composing', sender);

                const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: CONFIG.aiModel,
                    messages: [
                        { role: "system", content: CONFIG.systemPrompt },
                        { role: "user", content: text }
                    ]
                }, {
                    headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` }
                });

                const aiReply = response.data.choices[0].message.content;
                await sock.sendMessage(sender, { text: aiReply });
            } catch (err) {
                console.error("❌ AI Error: Check your OpenRouter Key or Model ID.");
            }
        }
    });
}

// Start the process
startEagleX();
                
