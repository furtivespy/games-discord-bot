const fetch = require('node-fetch')

class Event {
    constructor(client, {
      name = null,
      eventType = "",
      qualifier = "",
      description = "No description provided.",
      category = "Miscellaneous",
      usage = "No usage provided.",
      enabled = true,
      guildOnly = false,
      showHelp = false,
      permLevel = "User"
    }) {
      this.client = client;
      this.conf = { enabled, guildOnly, permLevel, showHelp };
      this.help = { name, eventType, qualifier, description, category, usage };
    }

    pause(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getGoogleImg(searchTerm, isGif, start=1, safeSearch = true){
      let query = new URLSearchParams();
      query.set("q", searchTerm);
      query.set("safe", (safeSearch) ? 'high' : 'off');
      query.set("cx", this.client.config.google_cxid);
      query.set("key", this.client.config.google_key);
      query.set("searchType", 'image');
      query.set("start", start);
      if (isGif) query.set("fileType", 'gif');
      var url = 'https://www.googleapis.com/customsearch/v1/?' + query.toString();
      return await fetch(url).then(res => res.json()).then(json => {
        return json.items
      })
    }
  }
  module.exports = Event;