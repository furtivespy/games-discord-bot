const path = require("path");
const { Database: Sqlite } = require("bun:sqlite");
const { ensureDataDir } = require("./dataDir.js");

const startWord = String.fromCharCode(0x0002)
const endWord = String.fromCharCode(0x0003)

class Database {
    constructor(guildid){
        const dataDir = ensureDataDir();
        this.db = new Sqlite(path.join(dataDir, `${guildid}.sqlite`), { create: true });

        //DB INIT SECTION
        
    }

}

module.exports = Database;