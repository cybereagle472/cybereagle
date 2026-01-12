const { default: makeWASocket, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const { usePostgresAuthState } = require("baileys-pg");
const { Pool } = require("pg");
const axios = require("axios");
const express = require("express");
const pino = require("pino");

// 1. Setup Web Server (Keep-Alive)
const app = express();
app.get('/', (req, res) => res.send("EagleX Cloud Engine: ONLINE 🦅"));
app.listen(process.env.PORT || 10000);

async function startEagleX() {
    console.log("🔄 Step 1: Connecting to Supabase Cloud Memory...");

    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } 
    });

    try {
        // 2. Load Login from Supabase
        const { state, saveCreds } = await usePostgresAuthState(pool);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: ["EagleX Pro", "Chrome", "1.0.0"]
        });

        // Save every session update to Supabase automatically
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'open') {
                console.log("✅ SUCCESS: EAGLEX IS LIVE & CLOUD-SYNCED!");
                await sock.sendMessage("923441675739@s.whatsapp.net", { 
                    text: "🦅 *EagleX Systems Online.*\n\nSync complete. Your session is now saved in Supabase. You won't need to pair again!" 
                });
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                if (code !== DisconnectReason.loggedOut) {
                    console.log("🔄 Connection lost. Retrying...");
                    startEagleX();
                } else {
                    console.error("‼️ Logged out. Manual re-pairing required.");
                }
            }

            // 3. Pairing Logic (Only if Supabase is empty)
            if (!sock.authState.creds.registered && !qr) {
                console.log("🆕 No Cloud Session found. Generating One-Time Code...");
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode("923441675739");
                        console.log(`\n🔥 YOUR FINAL PAIRING CODE: ${code}\n`);
                    } catch (err) { console.error("Pairing Error:", err.message); }
                }, 6000);
            }
        });

        // 4. AI Interaction
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

            try {
                const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [{ role: "system", content: "You are EagleX Assistant." }, { role: "user", content: text }]
                }, { headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` } });

                await sock.sendMessage(msg.key.remoteJid, { text: response.data.choices[0].message.content });
            } catch (e) { console.log("AI Error"); }
        });

    } catch (err) {
        console.error("❌ CLOUD ERROR:", err.message);
    }
}

startEagleX();
