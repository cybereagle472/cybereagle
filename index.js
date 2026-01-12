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

// --- PERSONALIZATION & AI CORE ---
const OWNER_NAME = "Muhammad Nasir";
const MY_NUMBER = "9779822691613";
const SESSION_ID = "EagleX_UltraPro_1"; 

const AI_SYSTEM_PROMPT = `
You are EagleX, the elite personal AI assistant and "Digital Twin" of ${OWNER_NAME}.
Your mission is to represent ${OWNER_NAME} with high intelligence, professional wit, and absolute efficiency.

RULES OF BEHAVIOR:
1. LANGUAGE: Detect the user's language (English, Urdu, or Roman Urdu) and respond perfectly in that same style. 
2. PERSONALITY: Be direct, helpful, and slightly sophisticated. Do not act like a generic bot.
3. LOYALTY: If ${OWNER_NAME} (Number: ${MY_NUMBER}) messages you, be ultra-obedient and proactive.
4. CONCISION: Keep responses short and impactful. Use bullet points for complex info.
5. EMOJIS: Use professional emojis like 🦅, ⚡, 🛡️, or ✅ sparingly.

If someone asks who you are, say: "I am EagleX, the digital persona of Muhammad Nasir. How can I assist you today?"
`;

// --- SERVER SETUP ---
const app = express();
app.get('/', (req, res) => res.status(200).send("EagleX Pro Engine: Online"));
app.listen(process.env.PORT || 10000);

async function startEagleX() {
    // SUPABASE POOLER OPTIMIZATION (Transaction Mode)
    const pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 3, // Safe limit for Free Tier Pooler
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

        // --- SMART CONNECTION HANDLER ---
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log("✅ [EAGLEX] CORE ONLINE");
                if (!global.isFirstConnect) {
                    await sock.sendMessage(`${MY_NUMBER}@s.whatsapp.net`, { 
                        text: `🦅 *EagleX Ultra Pro: Fully Synchronized.*\n\nDigital Twin of *${OWNER_NAME}* is now active.` 
                    });
                    global.isFirstConnect = true;
                }
            }

            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    console.log(`🔄 Auto-Healing Connection (Reason: ${reason})...`);
                    setTimeout(() => startEagleX(), 10000);
                }
            }
        });

        // --- ADVANCED MESSAGE PROCESSING ---
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const sender = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

            // Behavior Logic: Read -> Wait -> Type -> Send
            await sock.readMessages([msg.key]);
            await sock.sendPresenceUpdate('composing', sender);
            
            // Artificial delay to look human (1.5s - 3s)
            await delay(Math.floor(Math.random() * 1500) + 1500);

            try {
                const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                    model: "z-ai/glm-4.5-air:free",
                    messages: [
                        { role: "system", content: AI_SYSTEM_PROMPT },
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
                console.log("⚠️ AI Engine Busy. Sending Fallback...");
                await sock.sendPresenceUpdate('paused', sender);
            }
        });

    } catch (err) {
        console.error("❌ System Error:", err.message);
        setTimeout(() => startEagleX(), 20000);
    }
}

// Global Crash Protection
process.on('uncaughtException', (e) => console.log("🛡️ Crash Blocked:", e.message));

startEagleX();
            
