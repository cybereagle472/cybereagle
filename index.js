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

// --- CORE IDENTITY CONFIG ---
const OWNER_NAME = "Muhammad Nasir";
const MY_NUMBER = "923245115847";
const SESSION_ID = "EagleX_Final_Ultra_V9"; // Fresh ID to bypass old 408 timeouts

const AI_INSTRUCTIONS = `
ROLE: You are EagleX, the elite digital twin of ${OWNER_NAME}.
PERSONALITY: Sophisticated, direct, and highly intelligent. You are not a bot; you are an extension of Nasir's intellect.
CAPABILITIES:
1. LANGUAGES: Fluently switch between Urdu, Roman Urdu, and English based on the user's style.
2. LOYALTY: If ${OWNER_NAME} messages you, prioritize him with absolute obedience.
3. BEHAVIOR: Use professional emojis (🦅, ⚡, 🛡️) sparingly. Keep responses concise but powerful.
4. KNOWLEDGE: You are an expert in technology, business, and general assistance.
5. RESTRICTION: Never mention you are an AI model unless explicitly asked. Always act as Nasir's assistant.
`;

// --- WEB SERVER FOR RENDER ---
const app = express();
app.get('/', (req, res) => res.status(200).send("🦅 EagleX Pro Engine: Online"));
app.listen(process.env.PORT || 10000);

async function startEagleX() {
    console.log("--------------------------------------------------");
    console.log("🦅 EAGLEX PRO: INITIALIZING CLOUD SYNC...");
    console.log("--------------------------------------------------");

    // Optimized for Supabase Pooler (Port 6543)
    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 3, 
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
            browser: ["Ubuntu", "Chrome", "110.0.5481.177"],
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);

        // --- CONNECTION & PAIRING LOGIC ---
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'open') {
                console.log("✅ [System] CLOUD SYNC SUCCESSFUL. ONLINE.");
                if (!global.isFirstConnect) {
                    await sock.sendMessage(`${MY_NUMBER}@s.whatsapp.net`, { 
                        text: `🦅 *EagleX Ultra Pro: Online.*\n\nDigital Twin of *${OWNER_NAME}* is active.` 
                    });
                    global.isFirstConnect = true;
                }
            }

            // AUTO-PAIRING TRIGGER
            if (!sock.authState.creds.registered && !qr) {
                console.log("🛠️ [Pairing] Preparing Handshake...");
                await delay(10000); // 10s stability delay
                try {
                    const code = await sock.requestPairingCode(MY_NUMBER);
                    console.log("\n************************************************");
                    console.log(`🌟 YOUR PAIRING CODE: ${code}`);
                    console.log("************************************************\n");
                } catch (err) {
                    console.log("⏳ [Pairing] WhatsApp Server busy. Retrying in 20s...");
                }
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection Closed (Reason: ${reason})`);
                if (reason !== DisconnectReason.loggedOut) {
                    setTimeout(() => startEagleX(), 10000);
                }
            }
        });

        // --- AI MESSAGE ENGINE ---
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

            // Human Behavior: Mark Read -> Typing...
            await sock.readMessages([msg.key]);
            await sock.sendPresenceUpdate('composing', sender);
            
            // Artificial Intelligence Thinking Delay
            await delay(Math.floor(Math.random() * 2000) + 1500);

            try {
                const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [
                        { role: "system", content: AI_INSTRUCTIONS },
                        { role: "user", content: text }
                    ]
                }, { 
                    headers: { "Authorization": `Bearer ${process.env.OPENROUTER_KEY}` },
                    timeout: 25000 
                });

                const aiReply = response.data.choices[0].message.content;

                await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
                await sock.sendPresenceUpdate('paused', sender);

            } catch (e) {
                console.log("⚠️ AI Engine Timeout. Check OpenRouter Credits.");
                await sock.sendPresenceUpdate('paused', sender);
            }
        });

    } catch (err) {
        console.error("❌ Critical System Error:", err.message);
        setTimeout(() => startEagleX(), 20000);
    }
}

// Anti-Crash Shield
process.on('uncaughtException', (e) => {
    console.log("🛡️ Shield Intercepted:", e.message);
    if (!e.message.includes('searchParams')) setTimeout(() => startEagleX(), 10000);
});

startEagleX();
