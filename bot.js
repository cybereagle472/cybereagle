// ============================================
// FILE: bot.js
// PURPOSE: Main bot that runs 24/7 on Render
// ============================================

console.log('🚀 NASIR\'S WHATSAPP BOT STARTING...');

const { makeWASocket } = require('@whiskeysockets/baileys');
const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

class WhatsAppBot {
  constructor() {
    this.admin = process.env.ADMIN_NUMBER + '@s.whatsapp.net';
    console.log('👑 Admin:', this.admin);
  }

  async start() {
    try {
      console.log('🔗 Connecting to WhatsApp...');
      
      // Load session from database
      const sessionData = await this.loadSession();
      
      if (!sessionData) {
        console.log('❌ No session found in database!');
        console.log('💡 Please link WhatsApp first using Termux');
        process.exit(1);
      }
      
      // Connect to WhatsApp
      this.sock = makeWASocket({
        auth: sessionData,
        printQRInTerminal: false,
        browser: ['Nasir Bot', 'Chrome', '1.0']
      });
      
      this.setupEvents();
      
      console.log('✅ BOT IS READY!');
      console.log('💬 Listening for messages 24/7...');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      setTimeout(() => this.start(), 10000);
    }
  }
  
  async loadSession() {
    try {
      const result = await pool.query(
        'SELECT session_data FROM whatsapp_sessions WHERE id = 1'
      );
      
      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0].session_data);
      }
      return null;
    } catch (error) {
      console.error('Database error:', error.message);
      return null;
    }
  }
  
  setupEvents() {
    // Connection updates
    this.sock.ev.on('connection.update', (update) => {
      const { connection } = update;
      
      if (connection === 'open') {
        console.log('✅ WhatsApp connected!');
        this.sendMessage(this.admin, '🤖 Your WhatsApp bot is now online 24/7!');
      }
      
      if (connection === 'close') {
        console.log('🔌 Reconnecting...');
        setTimeout(() => this.start(), 5000);
      }
    });
    
    // New messages
    this.sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      
      if (!msg.message || msg.key.fromMe) return;
      if (msg.key.remoteJid.endsWith('@g.us')) return; // No groups
      
      await this.handleMessage(msg);
    });
  }
  
  async handleMessage(msg) {
    const sender = msg.key.remoteJid;
    const text = this.getMessageText(msg);
    
    if (!text) return;
    
    console.log('📩 From:', sender.split('@')[0], '| Text:', text);
    
    // Show typing
    await this.sock.sendPresenceUpdate('composing', sender);
    
    // Mark as read
    await this.sock.readMessages([msg.key]);
    
    // Check admin commands
    if (sender === this.admin) {
      if (await this.handleAdminCommand(sender, text)) return;
    }
    
    // Get AI response
    const reply = await this.getAIResponse(text);
    
    // Send reply
    await this.sock.sendMessage(sender, { text: reply });
    
    console.log('📤 Sent reply');
  }
  
  async handleAdminCommand(sender, text) {
    const commands = {
      '!stop': async () => {
        await this.sendMessage(sender, '🛑 Bot stopped. It will auto-restart on Render.');
        process.exit(0);
      },
      '!status': async () => {
        await this.sendMessage(sender, '✅ Bot is running 24/7 on Render');
      },
      '!update': async () => {
        await this.sendMessage(sender, '🔄 Bot updated! Changes applied.');
      }
    };
    
    for (const [cmd, action] of Object.entries(commands)) {
      if (text === cmd) {
        await action();
        return true;
      }
    }
    
    return false;
  }
  
  async getAIResponse(userMessage) {
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: "glm-4.5-air",
          messages: [
            {
              role: "system",
              content: `You are Muhammad Nasir. Talk exactly like him.
IMPORTANT:
1. Reply in SAME LANGUAGE as user (English/Urdu/Roman Urdu)
2. Be natural and human-like
3. Use short replies when needed
4. Be smart and helpful
5. Act like a real person`
            },
            {
              role: "user",
              content: userMessage
            }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      return response.data.choices[0].message.content;
      
    } catch (error) {
      console.error('AI error:', error.message);
      return "Sorry, I'm having trouble thinking right now. Try again?";
    }
  }
  
  getMessageText(msg) {
    const m = msg.message;
    return m.conversation || 
           m.extendedTextMessage?.text || 
           m.imageMessage?.caption || '';
  }
  
  async sendMessage(to, text) {
    try {
      await this.sock.sendMessage(to, { text });
    } catch (error) {
      console.error('Send failed:', error.message);
    }
  }
}

// Start bot
const bot = new WhatsAppBot();
bot.start();

// Auto-restart on crash
process.on('uncaughtException', (error) => {
  console.error('Crash:', error.message);
  setTimeout(() => {
    console.log('🔄 Auto-restarting...');
    bot.start();
  }, 10000);
});
