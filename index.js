require('dotenv').config();
const {
    default: makeWASocket,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");

// Database & Session
const { usePostgreSQLAuthState } = require("postgres-baileys");
const { Pool } = require("pg");

// AI & Utils
const Groq = require("groq-sdk");
const pino = require("pino");
const http = require('http');

// 1. Render Health Check
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EagleX Pro V3 Running');
}).listen(PORT);

// 2. Database Config
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 3. Groq AI Setup
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Validate OWNER_NUMBER at startup
const OWNER_NUMBER = process.env.OWNER_NUMBER || "";
const OWNER_JID = OWNER_NUMBER ? (OWNER_NUMBER + "@s.whatsapp.net") : null;

if (!OWNER_NUMBER) {
    console.error("❌ ERROR: OWNER_NUMBER not set in .env file!");
} else {
    console.log(`✅ Owner Number: ${OWNER_NUMBER}`);
}

const FORWARD_TO_NUMBER = process.env.FORWARD_TO_NUMBER || "";
const FORWARD_TO_JID = FORWARD_TO_NUMBER ? (FORWARD_TO_NUMBER + "@s.whatsapp.net") : null;
let botActive = true;

// Command patterns for instant detection
const STOP_PATTERNS = /^\.?stop$/i;
const START_PATTERNS = /^\.?start$/i;

// Command listener function - handles commands instantly
function handleCommand(messageBody, sender, isOwner, sock, msg) {
    const cleanBody = messageBody.trim();

    // INSTANT LISTENER: Stop command
    if (STOP_PATTERNS.test(cleanBody)) {
        console.log(`\n🛑 STOP COMMAND RECEIVED from ${sender}`);
        botActive = false;

        // Update presence to offline
        sock.sendPresenceUpdate('unavailable', sender).catch(() => {});

        // Send confirmation
        sock.sendMessage(sender, { text: "😴 EagleX slept on. OFF" }).catch(err => {
            console.error("Failed to send OFF message:", err.message);
        });

        return true; // Command handled
    }

    // INSTANT LISTENER: Start command
    if (START_PATTERNS.test(cleanBody)) {
        console.log(`\n🚀 START COMMAND RECEIVED from ${sender}`);
        botActive = true;

        // Update presence to online
        sock.sendPresenceUpdate('available', sender).catch(() => {});

        // Send confirmation
        sock.sendMessage(sender, { text: "☀️ EagleX woke up on. ON" }).catch(err => {
            console.error("Failed to send ON message:", err.message);
        });

        return true; // Command handled
    }

    return false; // Not a command
}

// Validate required environment variables at startup
if (!process.env.GROQ_API_KEY) {
    console.error("❌ ERROR: GROQ_API_KEY not set in .env file!");
}
if (!FORWARD_TO_JID) {
    console.warn("⚠️ WARNING: FORWARD_TO_NUMBER not set. View-once forwarding will not work!");
}

// 4. Memory/Context Storage (in-memory, can be enhanced with database)
const chatHistory = new Map();

// Helper to get or create conversation history
function getConversationHistory(sender) {
    if (!chatHistory.has(sender)) {
        chatHistory.set(sender, []);
    }
    return chatHistory.get(sender);
}

// Helper to add message to history
function addToHistory(sender, role, content, senderName) {
    const history = getConversationHistory(sender);
    history.push({
        role,
        content,
        timestamp: Date.now(),
        senderJid: sender,
        senderName: senderName || sender.replace('@s.whatsapp.net', '')
    });
    // Keep only last 20 messages for context
    if (history.length > 20) {
        history.shift();
    }
}

// Helper to format history for Groq
function formatHistoryForGroq(sender) {
    const history = getConversationHistory(sender);
    return history.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
}

// Helper to get all contacts who have chatted with the bot
function getAllChatContacts() {
    const contacts = [];
    const now = Date.now();
    chatHistory.forEach((msgs, jid) => {
        if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            const timeSinceLast = now - lastMsg.timestamp;
            contacts.push({
                jid: jid,
                number: jid.replace('@s.whatsapp.net', ''),
                name: lastMsg.senderName || 'Unknown',
                messageCount: msgs.length,
                lastActivity: lastMsg.timestamp,
                active24h: timeSinceLast < (24 * 60 * 60 * 1000)
            });
        }
    });
    return contacts;
}

// Auto-delete memory for chats inactive for more than 24 hours
function cleanupOldMemories() {
    const now = Date.now();
    const threshold = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    chatHistory.forEach((msgs, jid) => {
        if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            if (now - lastMsg.timestamp > threshold) {
                chatHistory.delete(jid);
                cleaned++;
            }
        }
    });

    if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} old chat memories (>24h inactive)`);
    }
}

// Run cleanup every hour
setInterval(cleanupOldMemories, 60 * 60 * 1000);

async function startEagleX() {
    console.log("🔄 Initializing Session: EagleX_Pro...");

    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await usePostgreSQLAuthState(pool, "EagleX_Pro");

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.ubuntu("Chrome"),
            markOnlineOnConnect: true
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    setTimeout(startEagleX, 5000);
                }
            } else if (connection === "open") {
                console.log("✅ EagleX_Pro is ONLINE!");
            }
        });

        sock.ev.on("messages.upsert", async ({ messages, type }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe || type !== 'notify') return;

            const sender = msg.key.remoteJid;
            const senderNumber = sender.replace('@s.whatsapp.net', '');
            const senderName = msg.pushName || senderNumber;

            // Extract message content based on type
            let body = "";

            // Handle different message types
            if (msg.message.conversation) {
                body = msg.message.conversation;
            } else if (msg.message.extendedTextMessage?.text) {
                body = msg.message.extendedTextMessage.text;
            }

            // Handle View Once messages (ephemeral/view-once)
            // Check multiple ways view-once can appear in Baileys v6
            const isViewOnceMessage = msg.message?.viewOnceMessage;
            const isEphemeralMessage = msg.message?.ephemeralMessage?.message;
            const isViewOnceKey = msg.key?.viewOnce;

            let unwrappedMessage = null;
            let isViewOnce = false;

            // Unwrap viewOnceMessage
            if (isViewOnceMessage?.message) {
                unwrappedMessage = isViewOnceMessage.message;
                isViewOnce = true;
            }
            // Unwrap ephemeralMessage
            else if (isEphemeralMessage) {
                unwrappedMessage = isEphemeralMessage;
                isViewOnce = true;
            }
            // Check viewOnceKey flag
            else if (isViewOnceKey) {
                // For viewOnceKey, the actual content is directly in msg.message
                unwrappedMessage = msg.message;
                isViewOnce = true;
            }

            if (isViewOnce && !msg.key.fromMe) {
                console.log(`📩 View-once detected from ${senderNumber}`);

                // Check if FORWARD_TO_NUMBER is configured
                if (!FORWARD_TO_JID) {
                    console.warn("⚠️ FORWARD_TO_NUMBER not configured. Skipping view-once forward.");
                    addToHistory(sender, "user", "[View-once message - FORWARD_TO_NUMBER not set]", senderName);
                    return;
                }

                // Forward view-once messages to the designated number
                let viewOnceContent = `📩 **View-Once Message from ${senderName} (${senderNumber}):**\n`;

                // Handle view-once image
                if (unwrappedMessage?.imageMessage) {
                    viewOnceContent += "Type: Image";
                    try {
                        const buffer = await sock.downloadMediaMessage(msg);
                        await sock.sendMessage(FORWARD_TO_JID, {
                            image: buffer,
                            caption: viewOnceContent
                        });
                        console.log(`✅ View-once image forwarded`);
                    } catch (e) {
                        console.error("Failed to forward view-once image:", e.message);
                        await sock.sendMessage(FORWARD_TO_JID, { text: viewOnceContent + "\n[Failed to download image]" });
                    }
                }
                // Handle view-once video
                else if (unwrappedMessage?.videoMessage) {
                    viewOnceContent += "Type: Video";
                    try {
                        const buffer = await sock.downloadMediaMessage(msg);
                        await sock.sendMessage(FORWARD_TO_JID, {
                            video: buffer,
                            caption: viewOnceContent
                        });
                        console.log(`✅ View-once video forwarded`);
                    } catch (e) {
                        console.error("Failed to forward view-once video:", e.message);
                        await sock.sendMessage(FORWARD_TO_JID, { text: viewOnceContent + "\n[Failed to download video]" });
                    }
                }
                // Handle view-once audio
                else if (unwrappedMessage?.audioMessage) {
                    viewOnceContent += "Type: Voice Message";
                    try {
                        const buffer = await sock.downloadMediaMessage(msg);
                        await sock.sendMessage(FORWARD_TO_JID, {
                            audio: buffer,
                            mimetype: "audio/ogg; codecs=opus"
                        });
                        console.log(`✅ View-once audio forwarded`);
                    } catch (e) {
                        console.error("Failed to forward view-once audio:", e.message);
                        await sock.sendMessage(FORWARD_TO_JID, { text: viewOnceContent });
                    }
                }
                // Handle view-once document
                else if (unwrappedMessage?.documentMessage) {
                    viewOnceContent += "Type: Document";
                    try {
                        const buffer = await sock.downloadMediaMessage(msg);
                        await sock.sendMessage(FORWARD_TO_JID, {
                            document: buffer,
                            fileName: unwrappedMessage.documentMessage.fileName || "document",
                            mimetype: unwrappedMessage.documentMessage.mimetype || "application/pdf"
                        });
                        console.log(`✅ View-once document forwarded`);
                    } catch (e) {
                        console.error("Failed to forward view-once document:", e.message);
                        await sock.sendMessage(FORWARD_TO_JID, { text: viewOnceContent + "\n[Failed to download document]" });
                    }
                }
                // Handle view-once text
                else if (unwrappedMessage?.conversation || unwrappedMessage?.extendedTextMessage?.text) {
                    const textContent = unwrappedMessage.conversation || unwrappedMessage.extendedTextMessage.text;
                    viewOnceContent += `Type: Text\n\n${textContent}`;
                    await sock.sendMessage(FORWARD_TO_JID, { text: viewOnceContent });
                    console.log(`✅ View-once text forwarded`);
                }
                // Handle view-once location
                else if (unwrappedMessage?.locationMessage) {
                    viewOnceContent += "Type: Location";
                    await sock.sendMessage(FORWARD_TO_JID, { text: viewOnceContent });
                    console.log(`✅ View-once location notification sent`);
                }
                // Handle view-once contact
                else if (unwrappedMessage?.contactsArrayMessage || unwrappedMessage?.contactMessage) {
                    viewOnceContent += "Type: Contact";
                    await sock.sendMessage(FORWARD_TO_JID, { text: viewOnceContent });
                    console.log(`✅ View-once contact notification sent`);
                }
                else {
                    // Generic view-once notification
                    viewOnceContent += "Type: Unknown";
                    await sock.sendMessage(FORWARD_TO_JID, { text: viewOnceContent });
                    console.log(`✅ View-once unknown type notification sent`);
                }

                // Add to history
                addToHistory(sender, "user", "[View-once message received]", senderName);
                return; // Don't process further as it's a view-once message
            }

            const isOwner = sender === OWNER_JID;

            // INSTANT COMMAND LISTENER - Check commands immediately
            const commandHandled = handleCommand(body, sender, isOwner, sock, msg);
            if (commandHandled) return;

            // Only mark messages as seen when bot is ACTIVE
            if (botActive) {
                await sock.readMessages([msg.key]);
                await sock.sendPresenceUpdate('composing', sender);
            } else {
                // Bot is OFF - don't show seen, don't show typing
                return; // Stop processing entirely
            }

            // Check if user wants to send message to owner/nasir
            const sendToOwnerPatterns = [
                /^send message to (owner|nasir|owner number|nasir number)$/i,
                /^tell (owner|nasir|owner number|nasir number)$/i,
                /^message to (owner|nasir|owner number|nasir number)$/i,
                /^send to (owner|nasir|owner number|nasir number)$/i,
                /^forward to (owner|nasir|owner number|nasir number)$/i
            ];

            let messageToForward = null;
            let isAskingToForward = false;

            // Check if message starts with "send to nasir" or similar
            const sendToOwnerMatch = body.match(/^(send|tell|message|forward)\s+(?:message\s+)?(?:to\s+)?(owner|nasir|owner number|nasir number)[\s:](.+)$/i);
            const sendToOwnerSimpleMatch = body.match(/^(send|tell|message|forward)\s+(?:to\s+)?(owner|nasir|owner number|nasir number)[\s:](.+)$/i);

            if (sendToOwnerMatch || sendToOwnerSimpleMatch) {
                isAskingToForward = true;
                messageToForward = sendToOwnerMatch ? sendToOwnerMatch[3] : sendToOwnerSimpleMatch[3];
            }

            // Also check for "send this to nasir" type messages
            if (!isAskingToForward && !body.startsWith('.')) {
                const sendThisMatch = body.match(/^(send|forward|tell|message)\s+(this|that|it)\s+(?:to\s+)?(owner|nasir)[\s:](.+)$/i);
                if (sendThisMatch) {
                    isAskingToForward = true;
                    messageToForward = sendThisMatch[4] || body;
                }
            }

            if (isAskingToForward && messageToForward) {
                // Check if FORWARD_TO_NUMBER is configured
                if (!FORWARD_TO_JID) {
                    await sock.sendMessage(sender, { text: "❌ FORWARD_TO_NUMBER not configured. Cannot send message." });
                    return;
                }

                // Add user message to history first
                addToHistory(sender, "user", body, senderName);
                // Forward the message to owner/forward number
                const forwardMsg = `📨 **Message from ${senderName} (${senderNumber}):**\n\n${messageToForward}`;
                await sock.sendMessage(FORWARD_TO_JID, { text: forwardMsg });
                // Add bot response to history
                addToHistory(sender, "assistant", "✅ Message sent to owner/nasir.", "EagleX");
                return sock.sendMessage(sender, { text: `✅ Message sent to owner/nasir.` });
            }

            // Group messages are ignored
            if (sender.endsWith("@g.us")) return;

            try {
                // Get instruction from environment
                const instruction = process.env.CUSTOM_PROMPT || "You are Muhammad Nasir.";

                // Get conversation history for context
                const history = formatHistoryForGroq(sender);

                // Build contacts list for AI context
                const allContacts = getAllChatContacts();
                const contactsInfo = allContacts.length > 0
                    ? allContacts.map(c => `- ${c.name} (${c.number}) - ${c.messageCount} messages`).join('\n')
                    : "No previous contacts.";

                // Build messages array with system prompt and history
                const messages = [
                    {
                        role: "system",
                        content: `${instruction}\n\nCURRENT USER INFO:\n- WhatsApp Number: ${senderNumber}\n- WhatsApp Name: ${senderName || 'Unknown'}\n\nCONTACTS WHO HAVE CHATTED WITH YOU:\n${contactsInfo}\n\nWhen asked "who am I", "who is this", "who is chatting", tell them their WhatsApp name and number.\nWhen asked about other contacts, tell them the name and number of that person.`
                    },
                    ...history,
                    { role: "user", content: body }
                ];

                // Send to Groq API
                const chatCompletion = await groq.chat.completions.create({
                    messages: messages,
                    model: "groq/compound",
                    temperature: 0.7,
                    max_tokens: 1024,
                });

                const aiReply = chatCompletion.choices[0]?.message?.content || "I couldn't generate a response.";

                if (aiReply) {
                    await delay(800);
                    await sock.sendPresenceUpdate('paused', sender);
                    await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
                }

                // Add bot response to history
                addToHistory(sender, "assistant", aiReply, "EagleX");

            } catch (error) {
                console.error("AI Error:", error.message);
                await sock.sendPresenceUpdate('paused', sender);
                try {
                    await sock.sendMessage(sender, { text: "Sorry, I encountered an error. Please try again." }, { quoted: msg });
                } catch (e) {
                    console.log("Failed to send error message");
                }
            }

            // Add user message to history after AI responds
            addToHistory(sender, "user", body, senderName);
        });

    } catch (err) {
        console.error("Startup Error:", err);
        setTimeout(startEagleX, 10000);
    }
}

startEagleX();
