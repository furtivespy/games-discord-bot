const qs = require( 'querystring' )
const fetch = require('node-fetch')
class Command {
    constructor(client, {
      name = null,
      description = "No description provided.",
      category = "Miscellaneous",
      usage = "No usage provided.",
      enabled = true,
      guildOnly = false,
      allMessages = false,
      showHelp = false,
      aliases = new Array(),
      permLevel = "User"
    }) {
      this.client = client;
      this.conf = { enabled, guildOnly, aliases, permLevel, allMessages, showHelp };
      this.help = { name, description, category, usage };
    }

    pause(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getGoogleImg(searchTerm, isGif, start=1, safeSearch = true){
      var params = {
        q:  searchTerm,
        safe: (safeSearch) ? 'high' : 'off',
        cx: this.client.config.google_cxid,
        key: this.client.config.google_key,
        searchType: 'image',
        start: start
      }
      if (isGif) params.fileType = 'gif';
      var url = 'https://www.googleapis.com/customsearch/v1/?' + qs.stringify( params );
      return await fetch(url).then(res => res.json()).then(json => {
        return json.items
      })
    }

    indexToEmoji(number) {
      switch (number) {
        case 0:
          return "1️⃣"
        case 1:
          return "2️⃣"
        case 2:
          return "3️⃣"
        case 3:
          return "4️⃣"
        case 4:
          return "5️⃣"
        case 5:
          return "6️⃣"
        case 6:
          return "7️⃣"
        case 7:
          return "8️⃣"
        case 8:
          return "9️⃣"
        case 9:
          return "🔟"
      }
    }

    emojiToIndex(emoji) {
      switch (emoji) {
        case "1️⃣":
          return 0 
        case "2️⃣":
          return 1 
        case "3️⃣":
          return 2 
        case "4️⃣":
          return 3 
        case "5️⃣":
          return 4 
        case "6️⃣":
          return 5 
        case "7️⃣":
          return 6 
        case "8️⃣":
          return 7 
        case "9️⃣":
          return 8 
        case "🔟":
          return 9
      }
    }

    TryParseInt(str,defaultValue) {
      var retValue = defaultValue;
      if(str !== null) {
          if(str.length > 0) {
              if (!isNaN(str)) {
                  retValue = parseInt(str);
              }
          }
      }
      return retValue;
    }
  }
  
  module.exports = Command;