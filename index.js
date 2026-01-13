require('dotenv').config();
  const {
      default: makeWASocket,
      DisconnectReason,
      Browsers,
      fetchLatestBaileysVersion,
      downloadContentFromMessage,
      getContentType,
      areJidsSameUser
  } = require("@whiskeysockets/baileys");
  const { usePostgreSQLAuthState } = require("postgres-baileys");
  const { Pool } = require("pg");
  const axios = require("axios");
  const fs = require("fs");
  const path = require("path");

  // Configuration from environment variables
  const OWNER_NUMBER = process.env.OWNER_NUMBER || "923245115847";
  const DATABASE_URL = process.env.DATABASE_URL;
  const CUSTOM_PROMPT = process.env.CUSTOM_PROMPT || "You are Nasir's assistant.";
  const VIEWONCE_FOLDER = __dirname + "/viewonce_media";

  // Ensure viewonce folder exists
  if (!fs.existsSync(VIEWONCE_FOLDER)) {
      fs.mkdirSync(VIEWONCE_FOLDER, { recursive: true });
  }

  // Global bot state
  let botActive = false;
  let botMessage = "The Bot is currently OFF. Send .start to activate.";
  let isProcessing = new Set();

  async function startEagleX() {
      const pool = new Pool({
          connectionString: DATABASE_URL
      });
// session ID Name
      const { state, saveCreds } = await usePostgreSQLAuthState(pool, "EagleX_Pro");

      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
          version,
          auth: state,
          logger: {
              level: "silent",
              stream: fs.createWriteStream('/dev/null')
          },
          printQRInTerminal: true,
          browser: Browsers.ubuntu("Chrome"),
          markOnlineOnConnect: true,
          generateHighQualityLinkPreview: true,
          retryRequestDelayMs: 100,
          maxMsgRetryCount: 10,
          defaultQueryTimeoutMs: undefined,
          keepAliveIntervalMs: 10000,
          emitOwnEvents: true,
          fireInitQueries: true,
          auth: state,
          generateHighQualityLinkPreview: true,
          getMessage: async (key) => {
              if (sock.chats.has(key.remoteJid)) {
                  const response = await sock.fetchMessageFromWA(key.remoteJid, key.id);
                  return response?.message || undefined;
              }
              return undefined;
          }
      });

      sock.ev.on("creds.update", saveCreds);
      sock.ev.on("connection.update", async (update) => {
          const { connection, lastDisconnect, isNewLogin, qr } = update;

          if (qr) {
              console.log("📱 Scan QR Code to connect your WhatsApp!");
          }

          if (connection === "close") {
              const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
              console.log(`❌ Connection lost: ${lastDisconnect?.error?.output?.payload?.message || lastDisconnect?.error?.message}`);

              if (shouldReconnect) {
                  console.log("🔄 Reconnecting in 5 seconds...");
                  setTimeout(() => startEagleX(), 5000);
              } else {
                  console.log("⚠️  Session expired. Please re-scan QR code.");
              }
          } else if (connection === "open") {
              console.log("✅ EagleX Ultra Pro V3 Connected!");
              console.log("🤖 Bot Status: " + (botActive ? "ACTIVE" : "INACTIVE"));

              // Send welcome message to owner
              try {
                  await sock.sendMessage(OWNER_NUMBER, {
                      text: `🚀 EagleX Ultra Pro V3 is now online!\n${botMessage}\n\nCommands:\n.start - Activate bot\n.stop - Deactivate bot`
                  });
              } catch (err) {
                  console.error("Failed to send welcome message:", err.message);
              }
          }
      });

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
          if (type !== "notify") return;

          for (const msg of messages) {
              if (!msg.message) continue;

              const sender = msg.key.remoteJid;
              const isGroup = sender.endsWith('@g.us');
              const isOwner = sender === OWNER_NUMBER;

              // 1. Auto-read messages to simulate active presence
              try {
                  await sock.readMessages([msg.key]);
              } catch (err) {
                  // Ignore read errors
              }

              // 2. Private Chat Only: Ignore group messages to avoid spam
              if (isGroup) {
                  console.log(`📨 Group message ignored from: ${sender}`);
                  continue;
              }

              const body = msg.message.conversation ||
                          msg.message.extendedTextMessage?.text ||
                          msg.message.imageMessage?.caption ||
                          msg.message.videoMessage?.caption ||
                          msg.message.stickerMessage?.isAnimated ||
                          msg.message.documentMessage?.fileName ||
                          msg.message.audioMessage?.mimetype ||
                          "";

              const command = body.toLowerCase().trim();

              // 3. Admin Control: Responds only to .start/.stop from owner
              if (isOwner) {
                  if (command === '.start') {
                      if (botActive) {
                          await sock.sendMessage(sender, {
                              text: "🤖 Bot is already ACTIVE! �",
                              mentions: [sender]
                          });
                      } else {
                          botActive = true;
                          botMessage = "The Bot is now ONLINE. I'm ready to chat with you! 🚀";
                          await sock.sendMessage(sender, {
                              text: "� Bot is now ACTIVE! I'm ready to chat with you! 🚀",
                              mentions: [sender]
                          });
                      }
                      continue;
                  }

                  if (command === '.stop') {
                      if (!botActive) {
                          await sock.sendMessage(sender, {
                              text: "🤖 Bot is already INACTIVE! 🔴",
                              mentions: [sender]
                          });
                      } else {
                          botActive = false;
                          botMessage = "The Bot is currently OFF. Send .start to activate.";
                          await sock.sendMessage(sender, {
                              text: "🔴 Bot is now INACTIVE! Send .start to reactivate.",
                              mentions: [sender]
                          });
                      }
                      continue;
                  }
              }

              // 4. ViewOnce Bypass: Automatically captures and forwards "View Once" media to owner
              if (msg.message.imageMessage?.viewOnce && !isProcessing.has(sender)) {
                  isProcessing.add(sender);
                  try {
                      console.log(`📸 Capturing ViewOnce image from: ${sender}`);
                      const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                      let buffer = Buffer.from([]);
                      for await (const chunk of stream) {
                          buffer = Buffer.concat([buffer, chunk]);
                      }

                      const timestamp = Date.now();
                      const filename = `viewonce_image_${sender}_${timestamp}.jpg`;
                      const filepath = path.join(VIEWONCE_FOLDER, filename);

                      fs.writeFileSync(filepath, buffer);

                      // Send to owner
                      await sock.sendMessage(OWNER_NUMBER, {
                          image: { url: filepath },
                          caption: `📸 ViewOnce Image captured from ${sender}\nTime: ${new Date().toLocaleString()}`
                      });

                      console.log(`✅ ViewOnce image sent to owner from: ${sender}`);
                  } catch (error) {
                      console.error(`❌ Failed to capture ViewOnce image: ${error.message}`);
                  } finally {
                      isProcessing.delete(sender);
                  }
              }

              if (msg.message.videoMessage?.viewOnce && !isProcessing.has(sender)) {
                  isProcessing.add(sender);
                  try {
                      console.log(`🎥 Capturing ViewOnce video from: ${sender}`);
                      const stream = await downloadContentFromMessage(msg.message.videoMessage, 'video');
                      let buffer = Buffer.from([]);
                      for await (const chunk of stream) {
                          buffer = Buffer.concat([buffer, chunk]);
                      }

                      const timestamp = Date.now();
                      const filename = `viewonce_video_${sender}_${timestamp}.mp4`;
                      const filepath = path.join(VIEWONCE_FOLDER, filename);

                      fs.writeFileSync(filepath, buffer);

                      // Send to owner
                      await sock.sendMessage(OWNER_NUMBER, {
                          video: { url: filepath },
                          caption: `🎥 ViewOnce Video captured from ${sender}\nTime: ${new Date().toLocaleString()}`
                      });

                      console.log(`✅ ViewOnce video sent to owner from: ${sender}`);
                  } catch (error) {
                      console.error(`❌ Failed to capture ViewOnce video: ${error.message}`);
                  } finally {
                      isProcessing.delete(sender);
                  }
              }

              // 5. AI Chatting with Google Gemini
              if (!botActive) {
                  await sock.sendMessage(sender, {
                      text: botMessage,
                      mentions: [sender]
                  });
                  continue;
              }

              try {
                  // Show typing indicator before sending response
                  await sock.presenceSubscribe(sender);
                  await sock.sendPresenceUpdate('composing', sender);

                  // Wait a bit to simulate human-like typing
                  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

                  const geminiResponse = await getGeminiResponse(body);

                  // Stop typing indicator
                  await sock.sendPresenceUpdate('paused', sender);

                  await sock.sendMessage(sender, {
                      text: geminiResponse
                  }, {
                      quoted: msg
                  });

              } catch (error) {
                  console.error("AI Error:", error.message);
                  await sock.sendMessage(sender, {
                      text: "🤖 Sorry, I'm having trouble responding right now. Please try again in a moment.",
                      mentions: [sender]
                  });
              }
          }
      });

      // Self-healing: Auto-reconnect on network errors
      sock.ws.on('ws-close', (err) => {
          console.log("WebSocket closed, attempting to reconnect:", err.message);
          setTimeout(() => startEagleX(), 5000);
      });

      sock.ws.on('ws-error', (err) => {
          console.log("WebSocket error:", err.message);
      });
  }

  // Google Gemini API integration
  async function getGeminiResponse(userMessage) {
      try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
              throw new Error("GEMINI_API_KEY not found in environment variables");
          }

          const response = await axios.post(
              `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
              {
                  contents: [{
                      parts: [{
                          text: userMessage
                      }],
                      role: "user"
                  }],
                  generationConfig: {
                      temperature: 0.7,
                      topK: 40,
                      topP: 0.95,
                      maxOutputTokens: 2048,
                      stopSequences: []
                  }
              },
              {
                  headers: {
                      'Content-Type': 'application/json'
                  }
              }
          );

          const candidate = response.data.candidates[0];
          if (candidate && candidate.content && candidate.content.parts[0]) {
              return candidate.content.parts[0].text;
          } else {
              throw new Error("No response from Gemini API");
          }
      } catch (error) {
          console.error("Gemini API Error:", error.message);
          throw error;
      }
  }

  // Start the bot
  startEagleX().catch(err => {
      console.error("Boot Error:", err);
      process.exit(1);
  });
    
