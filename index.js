const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const axios = require("axios");
const fs = require("fs");
const pino = require("pino");

// --- EAGLEX CONFIGURATION ---
const CONFIG = {
    name: "EagleX",
    ownerNumber: "923245115847@s.whatsapp.net", // ⚠️ CHANGE THIS: Your number + @s.whatsapp.net
    aiModel: "google/gemini-2.0-flash-exp:free", 
    systemPrompt: `
        You are EagleX, a highly professional yet chatty personal assistant of [ Muhammad Nasir ]. 
        - Speak in English, Roman Urdu, and Pure Urdu.
        - Switch languages naturally like a Pakistani human.
        - Use a friendly human accent for friends and family.
        - You have access to internet data.
    `
};

let isBotActive = true;

async function startEagleX() {
    // 1. SESSION DECODE (Base64 to File)
    if (!fs.existsSync('./session/creds.json')) {
        let rawId = process.env.SESSION_ID || "";
        let sessionData = rawId.replace("ARSLAN-MD~", "").trim();
        
        if (!sessionData) {
            console.error("❌ ERROR: SESSION_ID Environment Variable is empty!");
            return;
        }

        try {
            console.log("EagleX: Decoding Session Data...");
            const decoded = Buffer.from(sessionData, 'base64').toString('utf-8');
            if (!fs.existsSync('./session')) fs.mkdirSync('./session');
            fs.writeFileSync('./session/creds.json', decoded);
            console.log("EagleX: Session loaded! ✅");
        } catch (e) {
            console.error("❌ Session Error: Invalid Base64 data.");
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
        const isOwner = sender === CONFIG.ownerNumber;

        // OWNER COMMANDS
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

        // AI LOGIC
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

startEagleX();
            console.log("EagleX: Attempting to download session...");
            const file = File.fromURL(`https://mega.nz/file/${sessionID}`);
            
            // Load attributes before downloading
            await file.loadAttributes();
            const data = await file.downloadBuffer();
            
            if (!fs.existsSync('./session')) fs.mkdirSync('./session');
            fs.writeFileSync('./session/creds.json', data);
            console.log("EagleX: Session downloaded successfully! ✅");
        } catch (e) { 
            console.error("❌ Session Error: Could not download from Mega. Check your ID."); 
            console.error("Details:", e.message);
            return; 
        }
    }

    // 2. WHATSAPP CONNECTION
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    // Connection updates (Auto-reconnect)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
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
        const isOwner = sender === CONFIG.ownerNumber;

        // OWNER COMMANDS: Start/Stop
        if (isOwner) {
            if (text === ".eagle stop") {
                isBotActive = false;
                return await sock.sendMessage(sender, { text: "*EagleX Deactivated.* 🛑\nMain ab kisi ko jawab nahi dunga." });
            }
            if (text === ".eagle start") {
                isBotActive = true;
                return await sock.sendMessage(sender, { text: "*EagleX Activated!* 🦅\nMain ab active hoon aur sabka jawab dunga." });
            }
        }

        // Ignore messages if bot is deactivated
        if (!isBotActive) return;

        // AI CHAT LOGIC (OpenRouter)
        try {
            // Typing effect
            await sock.sendPresenceUpdate('composing', sender);

            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: CONFIG.aiModel,
                messages: [
                    { role: "system", content: CONFIG.systemPrompt },
                    { role: "user", content: text }
                ]
            }, {
                headers: { 
                    "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            const aiReply = response.data.choices[0].message.content;
            
            // Stop typing effect and send
            await sock.sendPresenceUpdate('paused', sender);
            await sock.sendMessage(sender, { text: aiReply });

        } catch (err) {
            console.error("AI Error:", err.response?.data || err.message);
        }
    });
}

// RUN THE BOT
startEagleX();
        
