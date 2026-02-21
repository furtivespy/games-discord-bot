const { MessageFlags } = require("discord.js");
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')

class GameBoardView {
    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        if (!gameData.gameBoard || gameData.gameBoard.length === 0) {
            await interaction.editReply({ content: `The Game Board is empty.`})
            return
        }

        let followup = await Formatter.multiCard(gameData.gameBoard, `All Cards on Game Board`)

        await interaction.editReply({ 
            content: `Game Board (${gameData.gameBoard.length} cards)`})

        await interaction.followUp({ 
            embeds: [...followup[0]], 
            files: [...followup[1]], 
            flags: MessageFlags.Ephemeral 
        })
    }
}

module.exports = new GameBoardView()
