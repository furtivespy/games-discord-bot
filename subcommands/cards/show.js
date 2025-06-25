const GameHelper = require('../../modules/GlobalGameHelper')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Show {
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true })
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.editReply({ content: "I don't think you're playing this game...", ephemeral: true })
            return
        }

        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)

        // The block that added Play Area information directly to the hand embed or created a new one
        // has been removed. playerSecretHandAndImages now handles returning a distinct embed for the play area.

        if (handInfo.attachments.length >0){
            await interaction.editReply({ 
                embeds: handInfo.embeds, // Use potentially modified embeds array
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.editReply({ 
                embeds: handInfo.embeds, // Use potentially modified embeds array
                ephemeral: true
            })  
        }
    }
}

module.exports = new Show()