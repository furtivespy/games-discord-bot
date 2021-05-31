const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const Roller = require('roll')
const Sample = require('lodash/sample')
const diceSides = ["<:die1:790027072998342666>","<:die2:790028311756668960>","<:die3:790028312167841803>","<:die4:790028312348065842>","<:die5:790028312386076713>","<:die6:790028312495128616>"]

class Scavenge extends Command {
    constructor(client){
        super(client, {
            name: "rats-scavenge",
            description: "RATS game",
            category: "Rats",
            usage: "use this command to roll scavenge rolls",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["rat-scavenge" , "ratsscavenge", "ratscavenge", "rats-scav", "rat-scav", "rat-s"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            await message.channel.send(`
Round #1: || ${Scavenge.getDie()} & ${Scavenge.getDie()} ||
Round #2: || ${Scavenge.getDie()} & ${Scavenge.getDie()} ||
Round #3: || ${Scavenge.getDie()} & ${Scavenge.getDie()} ||
            `)
        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

    static getDie() {
        return Sample([...diceSides])
    }

}

module.exports = Scavenge