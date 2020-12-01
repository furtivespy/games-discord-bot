const sqlite = require('better-sqlite3')

const startWord = String.fromCharCode(0x0002)
const endWord = String.fromCharCode(0x0003)

class Database {
    constructor(guildid){
        this.db = new sqlite(`./data/${guildid}.sqlite`)

        //DB INIT SECTION
        
    }

}

module.exports = Database;