const fetch = require("node-fetch");

const baseUrl = 'https://www.googleapis.com/customsearch/v1/?'

class GoogleSearch {
  constructor(options) {
    this.cx = options.cx;
    this.key = options.key;
  }

  async getGoogleImgs(searchTerm, isGif, start=1, safeSearch = true){
    let query = new URLSearchParams();
    query.set("q", searchTerm);
    query.set("safe", (safeSearch) ? 'high' : 'off');
    query.set("cx", this.cx);
    query.set("key", this.key);
    query.set("searchType", 'image');
    query.set("start", start);
    if (isGif) query.set("fileType",'gif');
    else query.set("fileType",'jpg,png,webp,gif')

    var url = 'https://www.googleapis.com/customsearch/v1/?' + query.toString();
    let items = await fetch(url).then(res => res.json()).then(json => {
      return json.items
    })
    return items
  }

  async getRandomGoogleImg(searchTerm, isGif, safeSearch = true){
    let results = await this.getGoogleImgs(searchTerm, isGif, Math.floor(Math.random() * 25), safeSearch)
    return results[Math.floor(Math.random() * results.length)]
  }

}

module.exports = GoogleSearch