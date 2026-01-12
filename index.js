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

// --- SYSTEM CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 10000;
const MY_NUMBER = "923441675739";
const OWNER_NAME = "Muhammad Nasir";
const SESSION_ID = "EagleX_Ultra"; 

// Keep-Alive Web Server
app.get('/', (req, res) => res.status(200).json({ status: "Active", engine: "EagleX Pro" }));
app.listen(PORT, () => console.log(`🚀 [System] Monitoring Port ${PORT}`));

async function startEagleX() {
    console.log("--------------------------------------------------");
    console.log("🦅 EAGLEX PRO ENGINE: INITIALIZING CLOUD SYNC...");
    console.log("--------------------------------------------------");

    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20
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
            browser: ["Ubuntu", "Chrome", "110.0.5481.177"], // High-compatibility footprint
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false
        });

        // Instant Sync to Supabase
        sock.ev.on('creds.update', saveCreds);

        // --- CONNECTION MANAGEMENT ---
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'open') {
                console.log("✅ [System] CONNECTION ESTABLISHED: CLOUD STORAGE SYNCED");
                await sock.sendMessage(`${MY_NUMBER}@s.whatsapp.net`, { 
                    text: `🦅 *EagleX Ultra Pro V3 Active*\n\nWelcome back, *${OWNER_NAME}*.\nSystem is monitoring all channels.` 
                });
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ [System] Connection Dropped (Reason: ${reason})`);
                
                if (reason !== DisconnectReason.loggedOut) {
                    const retryTime = 5000;
                    console.log(`🔄 [System] Self-Healing in ${retryTime/1000}s...`);
                    setTimeout(() => startEagleX(), retryTime);
                } else {
                    console.log("‼️ [System] Session Terminated. Manual re-pairing required.");
                }
            }

            // --- ADVANCED PAIRING LOGIC (With Visual Alerts) ---
            if (!sock.authState.creds.registered && !qr) {
                console.log("🛠️ [Pairing] Handshaking with WhatsApp Servers...");
                
                // Allow the socket 12 seconds to stabilize before requesting
                await delay(12000); 

                try {
                    const code = await sock.requestPairingCode(MY_NUMBER);
                    console.log("\n************************************************");
                    console.log(`🌟 YOUR PAIRING CODE: ${code}`);
                    console.log("************************************************\n");
                } catch (err) {
                    console.log("⏳ [Pairing] Server Busy. Retrying in 25s...");
                }
            }
        });

        // --- AI INTELLIGENCE & HUMAN-LIKE RESPONSE ---
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            
            // Intelligence: Don't reply to status updates or group notifications
            if (sender === 'status@broadcast') return;

            // Behavior: Simulate Reading & Typing
            await sock.readMessages([msg.key]);
            await sock.sendPresenceUpdate('composing', sender);

            try {
                const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [
                        { 
                            role: "system", 
                            content: `You are EagleX, the personal AI persona of ${OWNER_NAME}. 
                            You are his digital twin. Match the user's language (Urdu/English/Roman Urdu). 
                            Be elite, highly intelligent, and helpful. 
                            If ${OWNER_NAME} (Number: ${MY_NUMBER}) asks you something, prioritize him instantly.` 
                        },
                        { role: "user", content: text }
                    ]
                }, { 
                    headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` },
                    timeout: 20000 
                });

                const aiReply = response.data.choices[0].message.content;

                // Send reply with a slight natural delay
                await delay(1500);
                await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
                await sock.sendPresenceUpdate('paused', sender);

            } catch (e) {
                console.log("⚠️ [AI Engine] Service Interrupted (Timeout or API)");
                await sock.sendPresenceUpdate('paused', sender);
            }
        });

    } catch (err) {
        console.error("❌ [System] Critical Launch Failure:", err.message);
        setTimeout(() => startEagleX(), 20000);
    }
}

// --- ERROR SHIELD ---
process.on('uncaughtException', (err) => {
    console.log('🛡️ [Shield] Crash Prevented:', err.message);
    if (!err.message.includes('Mismatched searchParams')) {
        setTimeout(() => startEagleX(), 10000);
    }
});

startEagleX();
                                                  
