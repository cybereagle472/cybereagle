const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const axios = require("axios");
const { File } = require("megajs");
const fs = require("fs");
const pino = require("pino");

// --- CUSTOM CONFIGURATION ---
const CONFIG = {
    name: "EagleX",
    ownerNumber: "923245115847@s.whatsapp.net", // REPLACE WITH YOUR ID
    customData: `
        - You are EagleX, a professional yet chatty personal assistant.
        - Your owner is [Muhammad Nasir].
        - You speak English, Roman Urdu (e.g., "Kya hal hai?"), and Pure Urdu perfectly.
        - You change your behavior based on who you are talking to (friends, family, or relatives).
        - You use a natural human accent, not a robotic one.
        - You can search the internet for info if needed (ask the user to wait a moment).
    `
};

// State variable to track if the bot is active
let isBotActive = true;

async function startEagleX() {
    if (!fs.existsSync('./session/creds.json')) {
        const sessionID = process.env.SESSION_ID.replace("Arslan-MD~", "");
        try {
            const file = File.fromURL(`https://mega.nz/file/${sessionID}`);
            const stream = file.download();
            let data = "";
            for await (const chunk of stream) data += chunk.toString();
            if (!fs.existsSync('./session')) fs.mkdirSync('./session');
            fs.writeFileSync('./session/creds.json', data);
        } catch (e) { console.log("Session Error"); return; }
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isOwner = sender === CONFIG.ownerNumber;

        // --- COMMANDS (ONLY FOR YOU) ---
        if (isOwner) {
            if (text === ".eagle stop") {
                isBotActive = false;
                return await sock.sendMessage(sender, { text: "EagleX has been deactivated. 🛑" });
            }
            if (text === ".eagle start") {
                isBotActive = true;
                return await sock.sendMessage(sender, { text: "EagleX is now active and ready! 🦅" });
            }
        }

        // If bot is stopped, do nothing
        if (!isBotActive) return;

        // --- AI CHAT LOGIC ---
        try {
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "google/gemini-2.0-flash-exp:free",
                messages: [
                    { role: "system", content: CONFIG.customData },
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

    console.log("EagleX is Live!");
}

startEagleX();
                                                       
