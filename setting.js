const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}
module.exports = {
// Add Your Session Id Start With CyberEagle Hear
SESSION_ID: process.env.SESSION_ID || "CYBEREAGLE~H4sIAAAAAAAAA5VV25KiSBD9l3ptY7gLGNERg7QXwAsINuLGPCAUWgIFFIWIE/77BvZ09zzMTvTyVCSQefKck8lPgAtUQwt2YPQTlARdQgr7I+1KCEZg3CQJJGAA4pCGYATCiXbYOMJZcbVt6hVMTJF9K5fShdd0KlWehrbGU7PCrLB8BvcBKJtDhqK/JGwjh/PECi8WtWKwZNh2wn5/WriNr3MG0bxgdl6dO+2Gcf0M7n3GEBGEj5PyBHNIwsyCnR0i8jX41Xi7rk+M+prisvOiMZura2652/Kb2p4XpShC4ejYzvY2q78G3275NDjLUnyohafjVcWOZKJgYtHYP6haKzKmrYiMaq6Okzf4NTpiGBsxxBTR7su8N7ajOGu1OCtqm59aqTXnfjB145s9DV1TnPuCv3P98JYI4teAj+Oo4ZtJ2KpwvFWaTumW6abQq13h+Vu7XQdDSRLXC0Fhnd+B2+TdK+n/4d1YGtoRNWb1tGh0HV6rzcpYHYaZ2S0XWR6YXtPNLcO1Cn/yNfgvxeSpRbO1V1c5a65Yw2ZRejK5stpVkmTY6w0zRXO4atH2E35IG/I3lK4i7vdnGRs2sU6ZOL057d4fj6MgoDC58GPvxOwVYT/eX5cLUkp7aSjAhjwxDK7ip02GXppim1Skve4Yg9/buJ2eLa19fnSUws6IwYi7DwCBR1RTElJU4D7G88MBCOOLCyMC6YNeYBan7U3yL9NZwoxflPJVovarEbL8eK3JWqWXepLvXF1eCMYzGICSFBGsaxjPUU0L0i1hXYdHWIPRPz8GAMMrfROuL6dwwgAkiNR0i5syK8L4XdaPp2EUFQ2mbocjvT9AAkbsZxhSivCx7plscEiiE7pA/RTSGoySMKvhR4+QwBiMKGngx9zqRdxT73PCXpd4GQxA/pAExWAEVF4QRW4oS7Kgjrjv9be2zxqW5TcMKRiA7PGWMORkfiixssLLvDjivvfh+we8PlsMaYiyGoyAbjIBkVJ9Yi22/FKZzbTJUdOPGvhs590Zb8xzemkxQbq8lSyaX3MLnYb+oagcZrf03Vu3Z7ZBwEptfvGK5z8k6W01PeuCm4UBVoP5JaW79WudwdnZwyYzn5yupnTlnuC66zZ8UzlqytLLtMAvdaFaauNWvmMF59nVl3xUrjeHtUA9xOrac18thhcUwd+LWYLmyE+ByVtOVurjjMbEZLcLku/Pi2ITnOdXplzMi93h1ZMOtqKK3S6PzEULK9FKsaeVncO+4ugl0SqXZZr23C4S7fjm2cfMZL92FXq4qReqv00QfIw+Dnv5/izJO9zeVux98NuXv1bIf64mp3IvvPmyHMbGSdmjooBZPrRSm7tN01rJE242W60jk7BDcL//GIAyC2lSkLz/QeGYFI/ipGh6mxo4Kf5STNdSQ9eO077fLKyp9ml9D+WwpmFeghEny7IssgIvD0DeaWXp0pC+jwzQ+ss6YXD/F+G+qK5PBwAA",
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







