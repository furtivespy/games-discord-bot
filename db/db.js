const fs = require("fs");
const path = require("path");
const { Database: Sqlite } = require("bun:sqlite");

const startWord = String.fromCharCode(0x0002)
const endWord = String.fromCharCode(0x0003)

class Database {
    constructor(guildid){
        const dataDir = path.resolve("./data");
        fs.mkdirSync(dataDir, { recursive: true });
        this.db = new Sqlite(path.join(dataDir, `${guildid}.sqlite`), { create: true });

        //DB INIT SECTION
        
    }

}

module.exports = Database;