const fs = require('fs');
if (fs.existsSync('bot.env')) require('dotenv').config({ path: './bot.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}
module.exports = {
BOT_URL: process.env.BOT_URL || "https://raw.githubusercontent.com/ArslanMDofficial/ARSLAN-MD-DATA/refs/heads/main/datafile.json",
AUTO_SITE: process.env.AUTO_SITE || "https://arslan-apis.vercel.app",
BAND_URL: process.env.BAND_URL || "https://raw.githubusercontent.com/ArslanMDofficial/ARSLAN-MD-DATA/refs/heads/main/bandusers.json",
REPO_LINK: process.env.REPO_LINK || "https://github.com/cybereagle472",
REPO_NAME: process.env.REPO_NAME || "CyberEagle",
BOT_NAME: process.env.BOT_NAME || "CyberEagle",
DESCRIPTION: process.env.DESCRIPTION || "CyberEagle PAKISTANI POWERFULL WHATSAPP BOT",
OWNER_NUMBER: process.env.OWNER_NUMBER || "923245115847",
OWNER_NAME: process.env.OWNER_NAME || "Nasir 🎭",
ST_SAVE: process.env.ST_SAVE || "CyberEagle-STATUS-SERVER",
BIO_TEXT: process.env.BIO_TEXT || "CyberEagle 🦅 Developed by Nasir™",
AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || "*`STATUS SEEN BY CyberEagle`* _*POWERD BY*_ *Nasir ™🎭 Whtsapp Bot*",
FOOTER: process.env.FOOTER || "CyberEagle",
COPYRIGHT: process.env.COPYRIGHT || "*㋛ CyberEagle BY Nasir ™ OFFICIAL*",
VERSION: process.env.VERSION || "9.0.0",
//NEWSLETTER: process.env.NEWSLETTER || "120363348739987203@newsletter",
//WA_CHANNEL: process.env.WA_CHANNEL || "https://whatsapp.com/channel/0029VarfjW04tRrmwfb8x306",
//INSTA: process.env.INSTA || "https://Instagram.com/arslanmdofficial",
ALIVE_IMG: process.env.ALIVE_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
OWNER_IMG: process.env.OWNER_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
CONVERT_IMG: process.env.CONVERT_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
AI_IMG: process.env.AI_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
SEARCH_IMG: process.env.SEARCH_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
DOWNLOAD_IMG: process.env.DOWNLOAD_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
MAIN_IMG: process.env.MAIN_IMG || "https://i.ibb.co/s9Cr1VSX/file-000000006d207207b33a182396f1a27f.png",
GROUP_IMG: process.env.GROUP_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
FUN_IMG: process.env.FUN_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
TOOLS_IMG: process.env.TOOLS_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
OTHER_IMG: process.env.OTHER_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
MOVIE_IMG: process.env.MOVIE_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
NEWS_IMG: process.env.NEWS_IMG || "https://n.uguu.se/BlGoHUJU.jpg",
PP_IMG: process.env.PP_IMG || "https://n.uguu.se/BlGoHUJU.jpg"
};
