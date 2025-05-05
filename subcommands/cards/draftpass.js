const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, orderBy } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Pass {
    async execute(interaction, client) {
        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const inputDir = interaction.options.getString('direction')
        if (inputDir != 'asc' && inputDir != 'desc') {
            await interaction.editReply({ content: `I don't know how to pass in that direction`, ephemeral: true })
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
        let content = `New Draft Round Has Started! Draft Round Passed ${inputDir == 'asc' ? 'Clockwise' : 'Counter-Clockwise'}\n`
        gameData.players.forEach(play => { content += `<@${play.userId}> ` })
        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild,
              { content: content }
            )
          );
        
    }
}

module.exports = new Pass()
