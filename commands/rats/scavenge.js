const Command = require('../../base/Command.js')
const Discord = require('discord.js')
const Roller = require('roll')
const Sample = require('lodash/sample')
const diceSides = [":die1:",":die2:",":die3:",":die4:",":die5:",":die6:"]

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
Round #1: ||${Scavenge.getDie()} & ${Scavenge.getDie()}||
Round #2: ||${Scavenge.getDie()} & ${Scavenge.getDie()}||
Round #3: ||${Scavenge.getDie()} & ${Scavenge.getDie()}||
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