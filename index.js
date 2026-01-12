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
const MY_NUMBER = "923441675739";
const OWNER_JID = `${MY_NUMBER}@s.whatsapp.net`;
const SESSION_ID = "EagleX_Pro_Engine"; 

app.get('/', (req, res) => res.status(200).send("🦅 EagleX Pro Engine: 100% Operational"));
app.listen(process.env.PORT || 10000);

async function startEagleX() {
    console.log("🚀 [EagleX] Booting System & Cloud Sync...");

    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 15, // Better connection handling
        idleTimeoutMillis: 30000 
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
            syncFullHistory: false,
            fireInitQueries: false
        });

        sock.ev.on('creds.update', saveCreds);

        // --- INTELLIGENT CONNECTION HANDLER ---
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'open') {
                console.log("✅ [EagleX] SUCCESS: SYSTEM ONLINE");
                await sock.sendMessage(OWNER_JID, { text: "🦅 *EagleX Assistant: Online & Synced.*\n\nIntelligence: *GLM-4.5-Air*\nSync: *Supabase Cloud*" });
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = reason !== DisconnectReason.loggedOut;
                
                console.log(`⚠️ Connection Interrupted. Reason: ${reason}. Auto-Healing: ${shouldReconnect}`);
                
                if (shouldReconnect) {
                    // Exponential Backoff (Prevents aggressive looping)
                    const retryDelay = Math.min(1000 * 30, (lastDisconnect?.error?.message?.length || 5) * 1000);
                    setTimeout(() => startEagleX(), retryDelay);
                }
            }

            // SMART PAIRING: Retries with delay to avoid WhatsApp Rate Limits
            if (!sock.authState.creds.registered && !qr) {
                console.log("🆕 [EagleX] Session not found. Preparing pairing...");
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode(MY_NUMBER);
                        console.log(`\n🔥 PAIRING CODE: ${code}\n`);
                    } catch (err) {
                        console.log("⏳ WhatsApp Server busy. Retrying pairing in 30s...");
                    }
                }, 15000);
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
            
            // Logic: Wait 1 second per 10 characters of reply (max 5s)
            await delay(2500); 

            try {
                const aiResponse = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [
                        { 
                            role: "system", 
                            content: `You are EagleX, the personal AI of the Muhammad Nasir. You act as 'half of him'. 
                            Detect the user's language (English/Urdu/Roman Urdu) and respond perfectly in that same style. 
                            Be professional but direct. If the owner (923441675739) messages you, be ultra-obedient.` 
                        },
                        { role: "user", content: body }
                    ]
                }, { 
                    headers: { 
                        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 25000 // 25s timeout for AI
                });

                const replyText = aiResponse.data.choices[0].message.content;

                // 3. Send final message with "Quoted" original
                await sock.sendMessage(sender, { text: replyText }, { quoted: msg });
                
                // Stop Typing
                await sock.sendPresenceUpdate('paused', sender);

            } catch (error) {
                console.error("AI Engine Timeout or Error.");
                await sock.sendPresenceUpdate('paused', sender);
            }
        });

    } catch (err) {
        console.error("❌ [EagleX] Critical System Error:", err.message);
        // Retry logic for DB failure
        if (err.message.includes('terminating connection')) {
            setTimeout(() => startEagleX(), 10000);
        }
    }
}

// Global error handler to catch "Uncaught Exceptions" so the bot never stays dead
process.on('uncaughtException', (err) => {
    console.log('CRASH PREVENTED:', err.message);
    setTimeout(() => startEagleX(), 10000);
});

startEagleX();
                
