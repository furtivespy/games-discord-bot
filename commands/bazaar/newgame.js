const Command = require('../../base/Command.js')
const BazaarFormatter = require('../../modules/BazaarFormatter.js')
const bazaarData = require('../../db/bazaar.js')
const Discord = require('discord.js')
const _ = require('lodash')

const defaultGame = {
    players: [],
    objectiveA: [],
    objectiveB: [],
    objectiveC: [],
    objectiveD: [],
    theBazaar: [],
    turn: 1,
    history: undefined,
    turnClaim: false,
    gameOver: false
}

const defautPlayer = {
    guildId: "1",
    userId: "1",
    order: 1,
    score: 0,
    objectives: 0,
    hand: []
}

class NewGame extends Command {
    constructor(client){
        super(client, {
            name: "bazaar-newgame",
            description: "Bazaar New Game",
            category: "Bazaar",
            usage: "use this command to start a new game is the channel",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["bazaar-startgame"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            if (!args[0]) return
            let newGameData = {}
            let shuffledPlayers = _.shuffle([...args])
            let shuffledObjectives = _.shuffle([...bazaarData.objectives])
            let shuffledBazaars = _.shuffle([...bazaarData.bazaars])
            newGameData = Object.assign({}, _.cloneDeep(defaultGame), {
                // objectiveA: shuffledObjectives.slice(0,5),
                // objectiveB: shuffledObjectives.slice(5,10),
                // objectiveC: shuffledObjectives.slice(10,15),
                // objectiveD: shuffledObjectives.slice(15,20),
                objectiveA: shuffledObjectives.slice(0,2),
                objectiveB: shuffledObjectives.slice(5,7),
                objectiveC: shuffledObjectives.slice(10,12),
                objectiveD: shuffledObjectives.slice(15,17),
                theBazaar: shuffledBazaars.slice(0,2)
            })

            let player1 = this.getUserFromMention(shuffledPlayers[0])
            let player2 = this.getUserFromMention(shuffledPlayers[1])
            let player3 = this.getUserFromMention(shuffledPlayers[2])
            let player4 = this.getUserFromMention(shuffledPlayers[3])

            if (player1) newGameData.players.push(Object.assign({},  _.cloneDeep(defautPlayer), { order:1, guildId: message.guild.id, userId: player1.id  }))
            if (player2) newGameData.players.push(Object.assign({},  _.cloneDeep(defautPlayer), { order:2, guildId: message.guild.id, userId: player2.id  }))
            if (player3) newGameData.players.push(Object.assign({},  _.cloneDeep(defautPlayer), { order:3, guildId: message.guild.id, userId: player3.id  }))
            if (player4) newGameData.players.push(Object.assign({},  _.cloneDeep(defautPlayer), { order:4, guildId: message.guild.id, userId: player4.id  }))

            if (newGameData.players.length < 1) {
                await message.reply("Please mention users to start game with them")
                return
            }
            this.client.setGameData(`bazaar-${message.channel.id}`, newGameData)
            await message.channel.send(BazaarFormatter.bazaarEmbed(newGameData))
            await message.channel.send(await BazaarFormatter.gameStatus(this.client, newGameData))

        } catch (e) {
            this.client.logger.error(e, __filename.slice(__dirname.length + 1))
        }
    }

    getUserFromMention(mention) {
        if (!mention) return;
        const matches = mention.match(/^<@!?(\d+)>$/);
        if (!matches) return;
        const id = matches[1];
        return this.client.users.cache.get(id);
    }
}

module.exports = NewGame