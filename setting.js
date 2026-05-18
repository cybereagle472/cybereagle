const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}
module.exports = {
// Add Your Session Id Start With CyberEagle Hear
SESSION_ID: process.env.SESSION_ID || "CYBEREAGLE~eyJub2lzZUtleSI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiZ0tyR1NLdnlVNitUZHh2cCtpMC96emxLTUdVTkU5ZXNrWWZCK2o2aXhYQT0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiY1Z1RTIxazR4NDRodzQ1NFFKRWhrYjBLZ0lST0twME1rYkMyZGd3bEVTRT0ifX0sInBhaXJpbmdFcGhlbWVyYWxLZXlQYWlyIjp7InByaXZhdGUiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJlSFNMSnhJS1RvWnlmZlpiZ3FmbkhjMDVIdGxkNDlFU2xjemZUaURGZVZJPSJ9LCJwdWJsaWMiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJFOXB6R1lxbktBQVRTdWZVSmRQNmkwZGtXL1BLZS9yN0YzeElwYTFWRm5BPSJ9fSwic2lnbmVkSWRlbnRpdHlLZXkiOnsicHJpdmF0ZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6Im1IR0tNcW5IcXhvMHNIWDhrTGlGOXBZalBWb2ZGa0hLemx5THorU3c3WDA9In0sInB1YmxpYyI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IllvWm04SE1tTFlUTEdpQTRxZXNIUmdQRDlhYlFjeDBpU2ZSYmVBRjVXM0U9In19LCJzaWduZWRQcmVLZXkiOnsia2V5UGFpciI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoibUc1RWxEZUpmZkhzeVNqdm5KTThOQ1BHT2RTY0g1SVRGNFphcWV6TmtGYz0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoidDJRdEI0Mmo1ZHd6ZURjaVpFM2syTzA0QVVyQUFxWnUxckpqSTd1K1ZCaz0ifX0sInNpZ25hdHVyZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6InUxbjlMSHVpdUlEQ1BJUkpqQ2pTb2wrMUJtUFphT3ZuWEF3dTlpaS8yNjY3dGFYT2c0M0d1V0JEa0U3OVNPa0lxV0dZUkdRNGhib2MvSU4rWHY1TmpBPT0ifSwia2V5SWQiOjF9LCJyZWdpc3RyYXRpb25JZCI6MTk4LCJhZHZTZWNyZXRLZXkiOiJGVVNRVndGRGdJaW45N0poN25OQlArY2xoRENmb3U3OXlEdmIxSElCbm40PSIsInByb2Nlc3NlZEhpc3RvcnlNZXNzYWdlcyI6W10sIm5leHRQcmVLZXlJZCI6ODEzLCJmaXJzdFVudXBsb2FkZWRQcmVLZXlJZCI6ODEzLCJhY2NvdW50U3luY0NvdW50ZXIiOjAsImFjY291bnRTZXR0aW5ncyI6eyJ1bmFyY2hpdmVDaGF0cyI6ZmFsc2V9LCJyZWdpc3RlcmVkIjp0cnVlLCJwYWlyaW5nQ29kZSI6IlBQNEJIQVhMIiwibWUiOnsiaWQiOiI5MjMyNDUxMTU4NDc6MjJAcy53aGF0c2FwcC5uZXQiLCJsaWQiOiI3Mzc3MTAyOTM4MTIwNjoyMkBsaWQifSwiYWNjb3VudCI6eyJkZXRhaWxzIjoiQ09DRThQOERFTUd1cmRBR0dBRWdBQ2dBIiwiYWNjb3VudFNpZ25hdHVyZUtleSI6IjV3S3pwMTNxdTc3NXBaMjZYTGtrWThaSnZpdFhWZFduRnlYaXlBZVhkQmM9IiwiYWNjb3VudFNpZ25hdHVyZSI6IkFETU5meTZ5K0F1T3BtbEFhWC9GOE1HTVFmOVMwYm1JSHRNUGg4ajAzK1RTM1N1TVVkWDdnOVgvcVpId3l2aHVyWWxCTnNaV1lwWnFwMDZVVjgzUkRRPT0iLCJkZXZpY2VTaWduYXR1cmUiOiJ0WU1RajgxVUFjdzJiK0Y3WmZqeFRPbDJ6aitZTEorK3RsdmNxeVdidVNkT29kTHVUaDB0TkIwTkE3a094QWtoQUFHSGk3ZlF1QUdnc1lQT0VKMWFpUT09In0sInNpZ25hbElkZW50aXRpZXMiOlt7ImlkZW50aWZpZXIiOnsibmFtZSI6IjczNzcxMDI5MzgxMjA2OjIyQGxpZCIsImRldmljZUlkIjowfSwiaWRlbnRpZmllcktleSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IkJlY0NzNmRkNnJ1KythV2R1bHk1SkdQR1NiNHJWMVhWcHhjbDRzZ0hsM1FYIn19XSwicGxhdGZvcm0iOiJhbmRyb2lkIiwicm91dGluZ0luZm8iOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJDQWtJRWdnTiJ9LCJsYXN0QWNjb3VudFN5bmNUaW1lc3RhbXAiOjE3NzkxMjgxMzcsIm15QXBwU3RhdGVLZXlJZCI6IkFBQUFBRGRoIn0=",
// CyberEagle Api Site Url
API_BASE: process.env.API_BASE || "https://arslan-apis.vercel.app/",
// CyberEagle Api Key -- Add This To Your Api Key Form Api Site
API_KEY: process.env.API_KEY || "arslanmdofficialadmin",
// Auto Status Seen
AUTO_STATUS_SEEN: process.env.AUTO_STATUS_SEEN || "false",
// make true or false status auto seen
AUTO_STATUS_REPLY: process.env.AUTO_STATUS_REPLY || "false",
// make true if you want auto reply on status 
AUTO_STATUS_REACT: process.env.AUTO_STATUS_REACT || "false",
// make true if you want auto reply on status 
AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || "*SEEN YOUR STATUS BY CyberEagle 🤍*",

AUTO_BIO: process.env.AUTO_BIO || "true",
// true if want welcome msg in groups
GOODBYE: process.env.GOODBYE || "false",
// true if want goodbye msg in groups    
ADMIN_EVENTS: process.env.ADMIN_EVENTS || "false",
// make true to know who dismiss or promoted a member in group
PREFIX: process.env.PREFIX || ".",
// add your prifix for bot   
BOT_NAME: process.env.BOT_NAME || "CyberEagle",
// add bot namw here for menu
STICKER_NAME: process.env.STICKER_NAME || "CyberEagle",
// type sticker pack name 
CUSTOM_REACT: process.env.CUSTOM_REACT || "false",
// make this true for custum emoji react    
CUSTOM_REACT_EMOJIS: process.env.CUSTOM_REACT_EMOJIS || "💝,💖,💗,❤️‍🩹,❤️,🧡,💛,💚,💙,💜,🤎,🖤,🤍",
// chose custom react emojis by yourself 
DELETE_LINKS: process.env.DELETE_LINKS || "false",
// automatic delete links witho remove member 
OWNER_NUMBER: process.env.OWNER_NUMBER || "923245115847",
// add your bot owner number
OWNER_NAME: process.env.OWNER_NAME || "| Nasir ™ |",

SEND_WELCOME: process.env.SEND_WELCOME || "true",
// add alive msg here 
READ_MESSAGE: process.env.READ_MESSAGE || "false",
// make true for auto read message
READ_CMD_ONLY: process.env.READ_CMD_ONLY || "true",
// Turn true or false for automatic read msgs
AUTO_REACT: process.env.AUTO_REACT || "false",
// make this true or false for auto react on all msgs
ANTI_BAD: process.env.ANTI_BAD || "true",
// false or true for anti Calls
ANTI_CALL: process.env.ANTI_CALL || "true",
// false or true for anti bad words  
MODE: process.env.MODE || "public",
// make bot public-private-inbox-group 
ANTI_LINK: process.env.ANTI_LINK || "true",
// make anti link true,false for groups 
AUTO_VOICE: process.env.AUTO_VOICE || "false",
// make true for send automatic voices
AUTO_STICKER: process.env.AUTO_STICKER || "false",
// make true for automatic stickers 
AUTO_REPLY: process.env.AUTO_REPLY || "true",
// make true or false automatic text reply 
ALWAYS_ONLINE: process.env.ALWAYS_ONLINE || "false",
// maks true for always online 
 //Bot olways offline
PUBLIC_MODE: process.env.PUBLIC_MODE || "true",
// make false if want private mod
AUTO_TYPING: process.env.AUTO_TYPING || "false",
// true for automatic show typing   
READ_CMD: process.env.READ_CMD || "false",
// true if want mark commands as read 
DEV: process.env.DEV || "923245115847",
//replace with your whatsapp number        
ANTI_VV: process.env.ANTI_VV || "true",

ANTI_BOT: process.env.ANTI_BOT || "true",
// true for anti once view 

ANTI_DELETE: process.env.ANTI_DELETE || "true",
// true for anti delete 
ANTI_DELETE_TYPE: process.env.ANTI_DELETE_TYPE || "same", 
// change it to 'same' if you want to resend deleted message in same chat 
AUTO_RECORDING: process.env.AUTO_RECORDING || "true",
// make it true for auto recoding 
AUTO_BLOCK: process.env.AUTO_BLOCK || "false"
// make it true for auto block
};







