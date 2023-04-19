const GameDB = require('../../db/anygame.js')
const { cloneDeep, orderBy } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Pass {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const inputDir = interaction.options.getString('direction')
        if (inputDir != 'asc' && inputDir != 'desc') {
            await interaction.reply({ content: `I don't know how to pass in that direction`, ephemeral: true })
            return
        }

        //Do Stuff
        let playerOne = null
        let PrevHand = null
        orderBy(gameData.players, ['order'], [inputDir]).forEach(play => {
            if (playerOne == null) {
                playerOne = play
                PrevHand = play.hands.draft
                return
            }
            const currentHand = play.hands.draft
            play.hands.draft = PrevHand
            PrevHand = currentHand
        })
        playerOne.hands.draft = PrevHand

        //client.setGameData(`game-${interaction.channel.id}`, gameData)
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        const data = await Formatter.GameStatusV2(gameData, interaction.guild)
        let content = `New Draft Round Has Started! Draft Round Passed ${inputDir == 'asc' ? 'Clockwise' : 'Counter-Clockwise'}\n`
        gameData.players.forEach(play => { content += `<@${play.userId}> ` })
        await interaction.reply({ 
            content: content,
            files: [...data],
        })
        
    }
}

module.exports = new Pass()
