const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const axios = require("axios");
const { File } = require("megajs");
const fs = require("fs");
const pino = require("pino");

// --- CUSTOMIZE YOUR DATA HERE ---
const MY_CONFIG = {
    assistantName: "EagleX",
    ownerName: "Muhammad Nasir",
    myNumber: "923245115847@s.whatsapp.net", // Replace with your number
    systemPrompt: `You are Jarvis, the personal assistant of [Muhammad Nasir]. 
    Knowledge: You know that your master is a developer and likes coffee. 
    Tone: Professional, helpful, and concise and sometimes funny as a Pakistani boy.`
};

async function startAssistant() {
    // Convert Session ID (from Arslan-MD) to credentials
    if (!fs.existsSync('./session/creds.json')) {
        const sessionID = process.env.SESSION_ID.replace("Arslan-MD~", "");
        try {
            const file = File.fromURL(`https://mega.nz/file/${sessionID}`);
            const stream = file.download();
            let data = "";
            for await (const chunk of stream) data += chunk.toString();
            if (!fs.existsSync('./session')) fs.mkdirSync('./session');
            fs.writeFileSync('./session/creds.json', data);
        } catch (e) { console.log("Invalid Session ID. Check your Render Environment variables."); return; }
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // SECURITY: Only reply to YOU (the owner)
        if (sender !== MY_CONFIG.myNumber) return;

        try {
            // Talk to OpenRouter
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "google/gemini-2.0-flash-exp:free",
                messages: [
                    { role: "system", content: MY_CONFIG.systemPrompt },
                    { role: "user", content: text }
                ]
            }, {
                headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` }
            });

            const reply = response.data.choices[0].message.content;
            await sock.sendMessage(sender, { text: reply });
        } catch (err) {
            console.error("AI Error:", err.message);
        }
    });

    console.log("Assistant is active and waiting for your messages!");
}

startAssistant();
              
