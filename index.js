require('dotenv').config();
  const {                                                        default: makeWASocket,
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
  const DELETED_MESSAGES_FOLDER = __dirname + "/deleted_media";
                                                             // Ensure folders exist
  if (!fs.existsSync(VIEWONCE_FOLDER)) {
      fs.mkdirSync(VIEWONCE_FOLDER, { recursive: true });    }
  if (!fs.existsSync(DELETED_MESSAGES_FOLDER)) {
      fs.mkdirSync(DELETED_MESSAGES_FOLDER, { recursive: true });                                                       }

  // Global bot state
  let botActive = false;
  let botMessage = "The Bot is currently OFF. Send .start to activate.";
  let isProcessing = new Set();
  let deletedMessageCache = new Map();

  async function startEagleX() {                                 const pool = new Pool({
          connectionString: DATABASE_URL
      });                                                  
      // session ID Name
      const { state, saveCreds } = await usePostgreSQLAuthState(pool, "EagleX_Pro");

      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
          version,                                                   auth: state,
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
          fireInitQueries: true,                                     auth: state,
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

              if (shouldReconnect) {                                         console.log("🔄 Reconnecting in 5 seconds...");
                  setTimeout(() => startEagleX(), 5000);
              } else {                                                       console.log("⚠️  Session expired. Please re-scan QR code.");
              }
          } else if (connection === "open") {                            console.log("✅ EagleX Ultra Pro V3 Connected!");
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

      // Handle message deletions (NEW FEATURE)
      sock.ev.on("messages.update", async (updates) => {
          for (const update of updates) {
              if (update.update.pollUpdates || !update.update.message) continue;

              const message = update.update.message;
              const sender = update.key.remoteJid;

              // Check if message was deleted by sender
              if (message.deletion) {
                  try {
                      // Get the original message from cache if available
                      const messageId = update.key.id;
                      const cachedMessage = deletedMessageCache.get(messageId);

                      if (cachedMessage) {
                          console.log(`🗑️  Deleted message detected from: ${sender}`);

                          // Send notification to owner about deleted message                                                                   let notificationText = `🗑️  Message deleted by ${sender}\nTime: ${new Date().toLocaleString()}`;                                                        
                          // Handle different message types
                          if (cachedMessage.type === 'text') {
                              notificationText += `\nContent: "${cachedMessage.content}"`;
                              await sock.sendMessage(OWNER_NUMBER, {
                                  text: notificationText
                              });
                          } else if (cachedMessage.type === 'image') {
                              notificationText += `\nType: Image`;
                              await sock.sendMessage(OWNER_NUMBER, {
                                  text: notificationText
                              });
                              // Also save and forward the image if it was a ViewOnce
                              if (cachedMessage.viewOnce) {                                  const filepath = path.join(DELETED_MESSAGES_FOLDER, `deleted_${messageId}.jpg`);
                                  if (fs.existsSync(cachedMessage.filePath)) {
                                      fs.copyFileSync(cachedMessage.filePath, filepath);
                                      await sock.sendMessage(OWNER_NUMBER, {
                                          image: { url: filepath },
                                          caption: `📸 Deleted ViewOnce Image from ${sender}\nTime: ${new Date().toLocaleString()}`
                                      });                                                    }
                              }
                          } else if (cachedMessage.type === 'video') {
                              notificationText += `\nType: Video`;
                              await sock.sendMessage(OWNER_NUMBER, {
                                  text: notificationText                                 });
                              // Also save and forward the video if it was a ViewOnce                                                               if (cachedMessage.viewOnce) {
                                  const filepath = path.join(DELETED_MESSAGES_FOLDER, `deleted_${messageId}.mp4`);
                                  if (fs.existsSync(cachedMessage.filePath)) {
                                      fs.copyFileSync(cachedMessage.filePath, filepath);
                                      await sock.sendMessage(OWNER_NUMBER, {
                                          video: { url: filepath },
                                          caption: `🎥 Deleted ViewOnce Video from ${sender}\nTime: ${new Date().toLocaleString()}`
                                      });
                                  }
                              }
                          } else if (cachedMessage.type === 'audio') {
                              notificationText += `\nType: Audio`;
                              await sock.sendMessage(OWNER_NUMBER, {
                                  text: notificationText                                 });
                          } else if (cachedMessage.type === 'document') {
                              notificationText += `\nType: Document - ${cachedMessage.fileName}`;
                              await sock.sendMessage(OWNER_NUMBER, {
                                  text: notificationText
                              });
                          }                                
                          console.log(`✅ Deleted message info sent to owner from: ${sender}`);
                      }                                                      } catch (error) {
                      console.error(`❌ Failed to handle deleted message: ${error.message}`);
                  }
              }                                                      }
      });                                                                                                                   sock.ev.on("messages.upsert", async ({ messages, type }) => {
          if (type !== "notify") return;
                                                                     for (const msg of messages) {
              if (!msg.message) continue;

              const sender = msg.key.remoteJid;                          const isGroup = sender.endsWith('@g.us');
              const isOwner = sender === OWNER_NUMBER;

              // 1. Auto-read messages to simulate active presence
              try {                                                          await sock.readMessages([msg.key]);
              } catch (err) {
                  // Ignore read errors
              }

              // 2. Private Chat Only: Ignore group messages to avoid spam                                                          if (isGroup) {
                  console.log(`📨 Group message ignored from: ${sender}`);
                  continue;                                              }

              // 3. Extract message content properly
              const messageType = getContentType(msg.message);
              const messageContent = msg.message.conversation ||
                                    msg.message.extendedTextMessage?.text ||
                                    msg.message.imageMessage?.caption ||
                                    msg.message.videoMessage?.caption ||
                                    msg.message.stickerMessage?.isAnimated ||
                                    msg.message.documentMessage?.fileName ||                                                                              msg.message.audioMessage?.mimetype ||
                                    "";

              // 4. ADMIN CONTROL: Check for .start and .stop commands (IMPROVED)
              if (isOwner) {
                  const command = messageContent.toLowerCase().trim();

                  if (command === '.start') {                                    if (botActive) {
                          await sock.sendMessage(sender, {
                              text: "🤖 Bot is already ACTIVE! �"
                          });
                      } else {                                                       botActive = true;
                          botMessage = "The Bot is now ONLINE. I'm ready to chat with you! 🚀";
                          await sock.sendMessage(sender, {                               text: "� Bot is now ACTIVE! I'm ready to chat with you! 🚀"                                                       });
                      }                                                          continue;
                  }                                        
                  if (command === '.stop') {
                      if (!botActive) {
                          await sock.sendMessage(sender, {
                              text: "🤖 Bot is already INACTIVE! 🔴"                                                                            });
                      } else {
                          botActive = false;
                          botMessage = "The Bot is currently OFF. Send .start to activate.";
                          await sock.sendMessage(sender, {                               text: "🔴 Bot is now INACTIVE! Send .start to reactivate."
                          });
                      }
                      continue;
                  }                                                      }

              // 5. CACHE MESSAGES for deleted message detection
              const messageId = msg.key.id;
              const messageData = {
                  id: messageId,
                  sender: sender,
                  timestamp: msg.messageTimestamp,
                  type: messageType,
                  content: messageContent || "",
                  viewOnce: false,
                  filePath: null
              };                                           
              // Check if this is a ViewOnce message
              if (msg.message.imageMessage?.viewOnce || msg.message.videoMessage?.viewOnce) {
                  messageData.viewOnce = true;
                  messageData.type = msg.message.imageMessage ? 'image' : 'video';
              }
                                                                         deletedMessageCache.set(messageId, messageData);

              // 6. ViewOnce Bypass: Automatically captures and forwards "View Once" media to owner
              if (msg.message.imageMessage?.viewOnce && !isProcessing.has(sender)) {
                  isProcessing.add(sender);
                  try {                                                          console.log(`📸 Capturing ViewOnce image from: ${sender}`);                                                           const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                      let buffer = Buffer.from([]);
                      for await (const chunk of stream) {                            buffer = Buffer.concat([buffer, chunk]);                                                                          }

                      const timestamp = Date.now();
                      const filename = `viewonce_image_${sender.replace('@s.whatsapp.net', '')}_${timestamp}.jpg`;
                      const filepath = path.join(VIEWONCE_FOLDER, filename);

                      fs.writeFileSync(filepath, buffer);  
                      // Update cache with file path                             messageData.filePath = filepath;

                      // Send to owner
                      await sock.sendMessage(OWNER_NUMBER, {
                          image: { url: filepath },                                  caption: `📸 ViewOnce Image captured from ${sender}\nTime: ${new Date().toLocaleString()}`
                      });                                  
                      console.log(`✅ ViewOnce image sent to owner from: ${sender}`);
                  } catch (error) {                                              console.error(`❌ Failed to capture ViewOnce image: ${error.message}`);
                  } finally {                                                    isProcessing.delete(sender);
                  }
              }

              if (msg.message.videoMessage?.viewOnce && !isProcessing.has(sender)) {
                  isProcessing.add(sender);                                  try {
                      console.log(`🎥 Capturing ViewOnce video from: ${sender}`);
                      const stream = await downloadContentFromMessage(msg.message.videoMessage, 'video');
                      let buffer = Buffer.from([]);                              for await (const chunk of stream) {
                          buffer = Buffer.concat([buffer, chunk]);
                      }                                    
                      const timestamp = Date.now();
                      const filename = `viewonce_video_${sender.replace('@s.whatsapp.net', '')}_${timestamp}.mp4`;
                      const filepath = path.join(VIEWONCE_FOLDER, filename);
                                                                                 fs.writeFileSync(filepath, buffer);

                      // Update cache with file path
                      messageData.filePath = filepath;

                      // Send to owner                                           await sock.sendMessage(OWNER_NUMBER, {
                          video: { url: filepath },                                  caption: `🎥 ViewOnce Video captured from ${sender}\nTime: ${new Date().toLocaleString()}`
                      });
                                                                                 console.log(`✅ ViewOnce video sent to owner from: ${sender}`);
                  } catch (error) {                                              console.error(`❌ Failed to capture ViewOnce video: ${error.message}`);
                  } finally {
                      isProcessing.delete(sender);
                  }
              }

              // 7. AI Chatting with Google Gemini (IMPROVED)
              if (!botActive) {
                  await sock.sendMessage(sender, {
                      text: botMessage
                  });
                  continue;
              }

              // Don't respond to media-only messages (no text)
              if (!messageContent && messageType !== 'text') {                                                                          continue;
              }
                                                                         try {
                  // Show typing indicator before sending response
                  await sock.presenceSubscribe(sender);
                  await sock.sendPresenceUpdate('composing', sender);

                  // Wait a bit to simulate human-like typing                                                                           await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

                  const geminiResponse = await getGeminiResponse(messageContent);

                  // Stop typing indicator
                  await sock.sendPresenceUpdate('paused', sender);
                                                                             await sock.sendMessage(sender, {
                      text: geminiResponse
                  }, {                                                           quoted: msg
                  });

              } catch (error) {
                  console.error("AI Error:", error.message);
                  await sock.sendMessage(sender, {
                      text: "🤖 Sorry, I'm having trouble responding right now. Please try again in a moment."
                  });                                                    }
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
          const apiKey = process.env.GEMINI_API_KEY;                 if (!apiKey) {
              throw new Error("GEMINI_API_KEY not found in environment variables");
          }

          const response = await axios.post(
              `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                                                {
