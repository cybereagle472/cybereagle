const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const axios = require("axios");
const fs = require("fs");
const pino = require("pino");

// --- EAGLEX CONFIGURATION ---
const CONFIG = {
    name: "EagleX",
    ownerNumber: "923245115847@s.whatsapp.net", // ⚠️ MUST BE: CountryCodeNumber@s.whatsapp.net
    aiModel: "google/gemini-2.0-flash-exp:free", 
    systemPrompt: `
        You are EagleX, a professional and chatty personal assistant.
        - Speak English, Roman Urdu, and Pure Urdu.
        - Switch languages like a Pakistani human.
        - You are designed for friends and family.
    `
};

let isBotActive = true;

async function startEagleX() {
    // 1. SESSION DECODE (Reading your Raw Data)
    if (!fs.existsSync('./session/creds.json')) {
        let rawId = process.env.SESSION_ID || "";
        let sessionData = rawId.replace("ARSLAN-MD~", "").trim();
        
        if (!sessionData) {
            console.error("❌ ERROR: SESSION_ID is missing in Render Settings!");
            return;
        }

        try {
            console.log("EagleX: Decoding Session Data...");
            const decoded = Buffer.from(sessionData, 'base64').toString('utf-8');
            if (!fs.existsSync('./session')) fs.mkdirSync('./session');
            fs.writeFileSync('./session/creds.json', decoded);
            console.log("EagleX: Session loaded! ✅");
        } catch (e) {
            console.error("❌ Session Error: Invalid data format.");
            return;
        }
    }

    // 2. WHATSAPP CONNECTION
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
            console.log('EagleX is officially LIVE! 🦅');
        }
    });

    // 3. MESSAGE HANDLING
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase().trim();
        
        // Use the ID the bot sees to check for Owner
        const isOwner = sender === CONFIG.ownerNumber;

        if (isOwner) {
            if (text === ".eagle stop") {
                isBotActive = false;
                return await sock.sendMessage(sender, { text: "*EagleX Deactivated.* 🛑" });
            }
            if (text === ".eagle start") {
                isBotActive = true;
                return await sock.sendMessage(sender, { text: "*EagleX Activated!* 🦅" });
            }
        }

        if (!isBotActive) return;

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
            console.error("AI Error");
        }
    });
}

// Start the process
startEagleX();
            
