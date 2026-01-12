const { 
    default: makeWASocket, 
    DisconnectReason, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion,
    Browsers,
    delay
} = require("@whiskeysockets/baileys");
const { usePostgreSQLAuthState } = require("postgres-baileys");
const { Pool } = require("pg");
const axios = require("axios");
const express = require("express");
const pino = require("pino");

const app = express();
const MY_NUMBER = "923245115847";
const SESSION_ID = "EagleX_Instant_v1"; // New ID for instant reset

app.get('/', (req, res) => res.status(200).send("EagleX Pro: Online"));
app.listen(process.env.PORT || 10000);

async function startEagleX() {
    // Optimized for the fastest possible DB response
    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 2,
        connectionTimeoutMillis: 2000,
    });

    try {
        const { state, saveCreds } = await usePostgreSQLAuthState(pool, SESSION_ID);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.ubuntu("Chrome"),
            markOnlineOnConnect: true
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // INSTANT PAIRING TRIGGER - No more long delays
            if (!sock.authState.creds.registered && !qr) {
                console.log("⚡ [EagleX] INSTANT HANDSHAKE STARTING...");
                await delay(3000); // Small 3s buffer for socket stability
                try {
                    const code = await sock.requestPairingCode(MY_NUMBER);
                    console.log("\n************************************************");
                    console.log(`🌟 YOUR CODE: ${code}`);
                    console.log("************************************************\n");
                } catch (err) {
                    console.log("❌ Pairing Busy. Restarting...");
                    startEagleX();
                }
            }

            if (connection === 'open') {
                console.log("✅ [System] SUCCESS: LINKED AND ONLINE");
                await sock.sendMessage(`${MY_NUMBER}@s.whatsapp.net`, { text: "🦅 *EagleX Online: Handshake Success.*" });
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log(`🔄 Reconnecting (Reason ${reason})...`);
                    setTimeout(() => startEagleX(), 5000);
                }
            }
        });

        // Professional AI Handling
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            
            await sock.sendPresenceUpdate('composing', sender);
            try {
                const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [
                        { role: "system", content: "You are EagleX, Muhammad Nasir's Digital Twin. Speak naturally in his style." },
                        { role: "user", content: text }
                    ]
                }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` } });

                await sock.sendMessage(sender, { text: res.data.choices[0].message.content }, { quoted: msg });
            } catch (e) { console.log("AI Error"); }
        });

    } catch (err) {
        setTimeout(() => startEagleX(), 10000);
    }
}

startEagleX();
    
