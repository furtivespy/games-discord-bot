const Command = require('../../base/Command.js')
const fetch = require('node-fetch')
const he = require('he')
const _ = require('lodash')

const clean = text => {
    if (typeof(text) === "string")
      return text.replace(/`/g, "`" + String.fromCharCode(8203)).replace(/@/g, "@" + String.fromCharCode(8203)).substring(0,1998);
    else
        return text;
  }

class Test extends Command {
    constructor(client){
        super(client, {
            name: "test",
            description: "Whatever Will is currently Testing",
            category: "Utility",
            usage: "Does something different every time",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["t"],
            permLevel: "Bot Owner"
          })
    }

    async run (message, args, level) {
        try {           
            var gamed = this.client.getGameData("INIS")
            console.log(gamed)
            console.log(gamed.players)
        } catch (e) {
           this.client.logger.log(e,'error')
           message.channel.send(clean(e))
        }
    }

    
}


module.exports = Test
