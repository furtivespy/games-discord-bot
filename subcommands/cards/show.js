const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Show {
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

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.reply({ content: "I don't think you're playing this game...", ephemeral: true })
            return
        }

        interaction.deferReply({ephemeral: true});

        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)

        if (handInfo.attachments.length >0){
            await interaction.editReply({ 
                embeds: [
                    ...handInfo.embeds
                ],
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.editReply({ 
                embeds: [
                    ...handInfo.embeds
                ],
                ephemeral: true
            })  
        }
         
    }
}


module.exports = new Show()