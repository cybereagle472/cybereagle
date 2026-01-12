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

// --- CONFIG & CONSTANTS ---
const app = express();
const MY_NUMBER = "923245115847"; // Your new number
const OWNER_JID = `${MY_NUMBER}@s.whatsapp.net`;
const SESSION_ID = "EagleX_Final_Handshake_V4"; // New ID to reset Supabase tables

app.get('/', (req, res) => res.status(200).send("🦅 EagleX Pro Engine: 100% Operational"));
app.listen(process.env.PORT || 10000);

async function startEagleX() {
    console.log("🚀 [EagleX] Booting System & Cloud Sync...");

    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20, 
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
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
            browser: Browsers.ubuntu("Chrome"), // Stable browser string
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        sock.ev.on('creds.update', saveCreds);

        // --- INTELLIGENT CONNECTION HANDLER ---
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'open') {
                console.log("✅ [EagleX] SUCCESS: SYSTEM ONLINE");
                await sock.sendMessage(OWNER_JID, { 
                    text: "🦅 *EagleX Assistant: Online.*\n\nOwner: *Muhammad Nasir*\nSync: *Supabase Cloud*" 
                });
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = reason !== DisconnectReason.loggedOut;
                
                console.log(`⚠️ Connection Interrupted. Reason: ${reason}. Auto-Healing: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    setTimeout(() => startEagleX(), 10000);
                }
            }

            // --- STABLE PAIRING LOGIC (Anti-Desync) ---
            if (!sock.authState.creds.registered && !qr) {
                console.log("🛠️ [EagleX] Requesting stable pairing code for " + MY_NUMBER);
                
                // 20-second delay to ensure database tables are fully ready
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode(MY_NUMBER);
                        console.log(`\n🔥 YOUR PAIRING CODE: ${code}\n`);
                    } catch (err) {
                        console.log("⏳ WhatsApp Server busy or Connection Closed. Retrying in 30s...");
                    }
                }, 20000); 
            }
        });

        // --- AI HUMAN-LIKE BEHAVIOR ENGINE ---
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

            // 1. Mark message as "Read"
            await sock.readMessages([msg.key]);

            // 2. Simulate "Human Presence" (Thinking/Typing)
            await sock.sendPresenceUpdate('composing', sender);
            await delay(3000); 

            try {
                const aiResponse = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [
                        { 
                            role: "system", 
                            content: `You are EagleX, the personal AI of Muhammad Nasir. You act as 'half of him'. 
                            Detect the user's language (English/Urdu/Roman Urdu) and respond perfectly in that same style. 
                            Be professional but direct. If Muhammad Nasir messages you from ${MY_NUMBER}, be ultra-obedient.` 
                        },
                        { role: "user", content: body }
                    ]
                }, { 
                    headers: { 
                        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 25000 
                });

                const replyText = aiResponse.data.choices[0].message.content;

                // 3. Send final message
                await sock.sendMessage(sender, { text: replyText }, { quoted: msg });
                await sock.sendPresenceUpdate('paused', sender);

            } catch (error) {
                console.error("AI Engine Timeout.");
                await sock.sendPresenceUpdate('paused', sender);
            }
        });

    } catch (err) {
        console.error("❌ [EagleX] Critical System Error:", err.message);
        setTimeout(() => startEagleX(), 15000);
    }
}

// Keep-Alive for Render
process.on('uncaughtException', (err) => {
    console.log('RECOVERY:', err.message);
    setTimeout(() => startEagleX(), 10000);
});

startEagleX();
    
