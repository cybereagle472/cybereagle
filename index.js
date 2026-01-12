const { 
    default: makeWASocket, 
    DisconnectReason, 
    makeCacheableSignalKeyStore, 
    fetchLatestBaileysVersion,
    Browsers
} = require("@whiskeysockets/baileys");
const { usePostgreSQLAuthState } = require("postgres-baileys");
const { Pool } = require("pg");
const axios = require("axios");
const express = require("express");
const pino = require("pino");

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 10000;
const MY_NUMBER = "923441675739";
const SESSION_ID = "EagleX_Main"; 

app.get('/', (req, res) => res.status(200).send("🦅 EagleX Systems: Online"));
app.listen(PORT, () => console.log(`Server live on ${PORT}`));

async function startEagleX() {
    console.log("⚡ [EagleX] Initializing Cloud Memory...");

    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } 
    });

    try {
        // Use the Cloud Auth State
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
            browser: Browsers.macOS("Desktop"), 
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'open') {
                console.log("✅ [EagleX] CONNECTED AND SYNCED");
                await sock.sendMessage(`${MY_NUMBER}@s.whatsapp.net`, { 
                    text: "🦅 *EagleX Assistant Live.*\n\nSync: *Cloud (Supabase)*\nStatus: *Optimal*" 
                });
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log("🔄 Reconnecting in 5s...");
                    setTimeout(() => startEagleX(), 5000);
                }
            }

            // Only request pairing code if Supabase is empty
            if (!sock.authState.creds.registered && !qr) {
                console.log("🆕 Generating One-Time Pairing Code...");
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode(MY_NUMBER);
                        console.log(`\n🔥 PAIRING CODE: ${code}\n`);
                    } catch (err) { console.error("Code Error:", err.message); }
                }, 10000);
            }
        });

        // AI Behavioral Engine
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            
            await sock.sendPresenceUpdate('composing', sender);

            try {
                const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [
                        { role: "system", content: "You are EagleX, an elite AI Assistant. Be precise, helpful, and professional." },
                        { role: "user", content: text }
                    ]
                }, { 
                    headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` } 
                });

                await sock.sendMessage(sender, { text: response.data.choices[0].message.content }, { quoted: msg });
            } catch (e) { console.log("AI Offline"); }
        });

    } catch (err) {
        console.error("❌ Cloud Memory Error:", err.message);
    }
}

startEagleX();
