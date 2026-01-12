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
const SESSION_ID = "EagleX_Main"; // Unique ID for Supabase storage

app.get('/', (req, res) => res.status(200).send("🦅 EagleX Systems: Online & Cloud-Synced"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function startEagleX() {
    console.log("⚡ [EagleX] Initializing Cloud Memory (Supabase)...");

    // 1. Database Connection with Session Pooler
    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } 
    });

    try {
        // 2. Setup PostgreSQL Auth State
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
            browser: Browsers.macOS("Desktop"), // Mimics a real computer to avoid bans
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false,
        });

        // Auto-save changes to Supabase
        sock.ev.on('creds.update', saveCreds);

        // 3. Connection Handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'open') {
                console.log("✅ [EagleX] CONNECTED TO WHATSAPP");
                await sock.sendMessage(`${MY_NUMBER}@s.whatsapp.net`, { 
                    text: "🦅 *EagleX Assistant Live.*\n\nCloud Sync: *Active*\nAI Model: *GLM-4.5-Air*" 
                });
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`❌ [EagleX] Connection Closed. Reason: ${reason}`);
                
                if (reason !== DisconnectReason.loggedOut) {
                    console.log("🔄 Re-syncing with Cloud...");
                    setTimeout(() => startEagleX(), 5000);
                } else {
                    console.log("‼️ Session Destroyed. You must pair again.");
                }
            }

            // 4. One-Time Pairing Code (Triggers only if database is empty)
            if (!sock.authState.creds.registered && !qr) {
                console.log("🆕 [EagleX] New Session Detected. Generating Code...");
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode(MY_NUMBER);
                        console.log(`\n🔥 YOUR FINAL PAIRING CODE: ${code}\n`);
                    } catch (err) { console.error("Pairing Error:", err.message); }
                }, 10000);
            }
        });

        // 5. AI Behavioral Engine
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            
            // "Pre-typing" indicator for human feel
            await sock.sendPresenceUpdate('composing', sender);

            try {
                const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [
                        { role: "system", content: "You are EagleX, an elite AI. You are helpful, precise, and professional. Respond in the user's language (Urdu/English/Roman Urdu)." },
                        { role: "user", content: text }
                    ]
                }, { 
                    headers: { 
                        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
                        "Content-Type": "application/json"
                    } 
                });

                const aiReply = response.data.choices[0].message.content;
                await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });

            } catch (e) {
                console.log("AI API Error or Timeout.");
            }
        });

    } catch (err) {
        console.error("❌ [EagleX] Database Connection Failed:", err.message);
    }
}

startEagleX();
