const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const axios = require("axios");
const fs = require("fs");
const pino = require("pino");
const express = require("express");

// --- 1. PREVENT SLEEP (Render) ---
const app = express();
app.get('/', (req, res) => res.status(200).send({ status: "EagleX Online" }));
app.listen(process.env.PORT || 10000);

// --- 2. CONFIGURATION ---
const CONFIG = {
    myNumber: "9779822691613", // Your number for pairing
    owner: "9779822691613@s.whatsapp.net",
    model: "z-ai/glm-4.5-air:free",
    systemPrompt: "You are EagleX, a world-class AI Assistant. Speak English and Roman Urdu."
};

async function startEagleX() {
    console.log("--- SYSTEM: INITIALIZING EAGLEX ENGINE ---");

    // Only wipe if not registered to allow pairing a fresh start
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // --- AUTOMATIC PAIRING CODE GENERATOR ---
    if (!sock.authState.creds.registered) {
        console.log(`\n🚀 REQUESTING PAIRING CODE FOR: ${CONFIG.myNumber}`);
        
        // Short delay to ensure socket is ready
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(CONFIG.myNumber);
                console.log(`\n🔥 YOUR PAIRING CODE: ${code}`);
                console.log("-----------------------------------------");
                console.log("1. Open WhatsApp > Linked Devices > Link a Device.");
                console.log("2. Select 'Link with phone number instead'.");
                console.log("3. Enter the code shown above in your phone.");
                console.log("-----------------------------------------\n");
            } catch (err) {
                console.error("❌ Failed to get pairing code:", err);
            }
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log("✅ EAGLEX IS LIVE ON WHATSAPP!");
            await sock.sendMessage(CONFIG.owner, { text: "🦅 *EagleX Systems Operational.* \nConnected via internal pairing engine." });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Connection glitch. Reconnecting...");
                startEagleX();
            } else {
                console.error("‼️ Session logged out. Please wipe /session folder and restart.");
            }
        }
    });

    // --- AI MESSAGE PROCESSING ---
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        try {
            await sock.sendPresenceUpdate('composing', sender);
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: CONFIG.model,
                messages: [
                    { role: "system", content: CONFIG.systemPrompt },
                    { role: "user", content: text }
                ]
            }, {
                headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` }
            });

            await sock.sendMessage(sender, { text: response.data.choices[0].message.content });
        } catch (e) {
            console.log("AI Error or Timeout");
        }
    });
}

startEagleX();
      
