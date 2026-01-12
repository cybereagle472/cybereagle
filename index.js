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

const app = express();
const PORT = process.env.PORT || 10000;
const MY_NUMBER = "923441675739";
const SESSION_ID = "EagleX_Main"; 

app.get('/', (req, res) => res.status(200).send("🦅 EagleX Systems Online"));
app.listen(PORT, () => console.log(`Server live on ${PORT}`));

async function startEagleX() {
    console.log("⚡ [EagleX] Initializing Cloud Memory...");

    // PRO FIX: This handles special characters in passwords automatically
    const connectionString = process.env.DATABASE_URL;

    const pool = new Pool({ 
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
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
            browser: Browsers.macOS("Desktop"),
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'open') {
                console.log("✅ [EagleX] CLOUD SYNC SUCCESSFUL");
                await sock.sendMessage(`${MY_NUMBER}@s.whatsapp.net`, { 
                    text: "🦅 *EagleX Systems Operational.*\n\nSync: *Supabase Cloud*\nProtection: *Active*" 
                });
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log("🔄 Reconnecting...");
                    setTimeout(() => startEagleX(), 5000);
                }
            }

            if (!sock.authState.creds.registered && !qr) {
                console.log("🆕 [EagleX] Requesting Pairing Code...");
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode(MY_NUMBER);
                        console.log(`\n🔥 YOUR FINAL PAIRING CODE: ${code}\n`);
                    } catch (err) { console.error("Pairing Error:", err.message); }
                }, 10000);
            }
        });

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
                        { role: "system", content: "You are EagleX Assistant Of Muhammad Nasir. Reply professionally and funny plus smartly.Use human tone and style like Pakistani peoples talk in roman urdu, English and pure Urdu. change according to the situation or on demand." },
                        { role: "user", content: text }
                    ]
                }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` } });

                await sock.sendMessage(sender, { text: response.data.choices[0].message.content }, { quoted: msg });
            } catch (e) { console.log("AI API Error"); }
        });

    } catch (err) {
        console.error("❌ Cloud Memory Error:", err.message);
    }
}

startEagleX();
                                   
