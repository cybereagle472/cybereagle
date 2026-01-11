const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const axios = require("axios");
const fs = require("fs");
const pino = require("pino");
const express = require("express");

// --- 1. RENDER KEEP-ALIVE SYSTEM ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('EagleX Status: 🟢 Fully Operational'));
app.listen(PORT, () => console.log(`[SYSTEM] Port ${PORT} opened. Render monitoring active.`));

// --- 2. CONFIGURATION ---
const CONFIG = {
    ownerNumber: "9779822691613@s.whatsapp.net", // ⚠️ CHANGE TO YOUR ID
    aiModel: "z-ai/glm-4.5-air:free",
    systemPrompt: `
        Identity: You are EagleX, a world-class AI Personal Assistant.
        Owner: Your owner is [Your Name]. Be loyal and protective.
        Behavior: Professional, efficient, and intelligent.
        Language: Fluent in English, Urdu, and Roman Urdu. Switch naturally.
        Instructions: Provide high-quality reasoning. Do not show internal tags or <reasoning> blocks.
    `
};

let isBotActive = true;

async function startEagleX() {
    console.log("[STARTUP] Initializing EagleX Engine...");

    // Session Management
    if (!fs.existsSync('./session/creds.json')) {
        console.log("[SESSION] No credentials found. Decoding from Environment...");
        const rawId = process.env.SESSION_ID || "";
        const sessionData = rawId.replace("ARSLAN-MD~", "").trim();
        if (sessionData) {
            const decoded = Buffer.from(sessionData, 'base64').toString('utf-8');
            if (!fs.existsSync('./session')) fs.mkdirSync('./session');
            fs.writeFileSync('./session/creds.json', decoded);
            console.log("[SESSION] Credentials successfully written.");
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    // Create Socket with Higher Debug Level
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'info' }), // Shows connection handshakes in logs
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    // Connection Watchdog
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log("✅ [CONNECTED] EagleX is now live on WhatsApp.");
        } else if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ [DISCONNECTED] Code: ${code}. Reconnecting...`);
            if (code !== DisconnectReason.loggedOut) startEagleX();
        }
    });

    // Message Processor
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        
        // DEBUG: Print every message to Render logs
        console.log(`📩 [INCOMING] From: ${sender} | Text: "${text}"`);

        // Owner Command Logic
        if (sender === CONFIG.ownerNumber) {
            if (text.toLowerCase() === ".eagle stop") {
                isBotActive = false;
                return await sock.sendMessage(sender, { text: "⚠️ *EagleX Sleep Mode Activated.*" });
            }
            if (text.toLowerCase() === ".eagle start") {
                isBotActive = true;
                return await sock.sendMessage(sender, { text: "🦅 *EagleX Systems Online.*" });
            }
        }

        if (!isBotActive) return;

        // AI Processing
        try {
            console.log(`🤖 [AI REQUEST] Sending prompt to GLM 4.5 Air...`);
            await sock.sendPresenceUpdate('composing', sender);

            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: CONFIG.aiModel,
                messages: [
                    { role: "system", content: CONFIG.systemPrompt },
                    { role: "user", content: text }
                ]
            }, {
                headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` },
                timeout: 30000 // 30 second timeout
            });

            const aiReply = response.data.choices[0].message.content;
            console.log(`✅ [AI SUCCESS] Sending response to ${sender}`);
            await sock.sendMessage(sender, { text: aiReply });

        } catch (err) {
            const errMsg = err.response?.data?.error?.message || err.message;
            console.error(`❌ [AI ERROR] ${errMsg}`);
            
            // Send error notification to owner
            if (sender !== CONFIG.ownerNumber) {
                await sock.sendMessage(CONFIG.ownerNumber, { text: `⚠️ *Bot Alert:* AI Failed for ${sender}. Error: ${errMsg}` });
            }
        }
    });
}
// Add this at the very bottom of index.js
      if (fs.existsSync('./session')) {
           fs.rmSync('./session', { recursive: true, force: true });
              console.log("[SYSTEM] Old session folder wiped for fresh start.");
}

startEagleX();
            
