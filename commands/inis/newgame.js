const Command = require('../../base/Command.js')
const _ = require('lodash')
const allCards = require('../../db/cards.js')
const InisFormatter = require('../../modules/InisFormatter.js')

const defaultGame = {
    players: [],
    greenDeck: [],
    redDeck: [],
    currentRound: 1,
    order: "Clockwise",
    isClockwise: true, 
}

const defautPlayer = {
    guildId: "1",
    userId: "1",
    order: 1,
    isBrenn: false,
    hand: []
}

class NewGame extends Command {
    constructor(client){
        super(client, {
            name: "inis-newgame",
            description: "Start New Game",
            category: "Inis",
            usage: "use this command to start new game with new players and shuffle everything",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["inis-startgame"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            if (!args[0]) return
            var newGameData = {}
            newGameData = Object.assign({}, _.cloneDeep(defaultGame), {
                greenDeck: [...allCards.seasons],
            })

            if (_.random(0,1) == 0){
                newGameData.order = "Counterclockwise"
                newGameData.isClockwise = false
            }
            var shuffledPlayers = _.shuffle([...args])
            var player1 = this.getUserFromMention(shuffledPlayers[0])
            var player2 = this.getUserFromMention(shuffledPlayers[1])
            var player3 = this.getUserFromMention(shuffledPlayers[2])
            var player4 = this.getUserFromMention(shuffledPlayers[3])

            if (player1) newGameData.players.push(Object.assign({}, defautPlayer, { order:1, guildId: message.guild.id, userId: player1.id, isBrenn: true  }))
            if (player2) newGameData.players.push(Object.assign({}, defautPlayer, { order:2, guildId: message.guild.id, userId: player2.id  }))
            if (player3) newGameData.players.push(Object.assign({}, defautPlayer, { order:3, guildId: message.guild.id, userId: player3.id  }))
            if (player4) newGameData.players.push(Object.assign({}, defautPlayer, { order:4, guildId: message.guild.id, userId: player4.id  }))
            
            if (newGameData.players.length != 4) {
                newGameData.greenDeck = newGameData.greenDeck.filter(c => c.players != "4")
            }
            
            this.client.setGameData("INIS", newGameData)
            await message.channel.send({embeds: [await InisFormatter.gameStatus(this.client, newGameData)]})

        } catch (e) {
            this.client.logger.log(e,'error')
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