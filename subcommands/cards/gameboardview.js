const { MessageFlags } = require("discord.js");
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')

class GameBoardView {
    async execute(interaction, client) {
        const [, gameData] = await Promise.all([
            interaction.deferReply({ flags: MessageFlags.Ephemeral }),
            GameHelper.getGameData(client, interaction)
        ]);

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        if (!gameData.gameBoard || gameData.gameBoard.length === 0) {
            await interaction.editReply({ content: `The Game Board is empty.`})
            return
        }

        const [, followup] = await Promise.all([
            interaction.editReply({ 
                content: `Game Board (${gameData.gameBoard.length} cards)`}),
            Formatter.multiCard(gameData.gameBoard, `All Cards on Game Board`)
        ]);

        await interaction.followUp({ 
            embeds: [...followup[0]], 
            files: [...followup[1]], 
            flags: MessageFlags.Ephemeral 
        })
    }
}

module.exports = new GameBoardView()
