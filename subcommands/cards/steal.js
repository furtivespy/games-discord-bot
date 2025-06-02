const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find, random } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Steal {
    async execute(interaction, client) {
        await interaction.deferReply()
        
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

        let selectedPlayer = interaction.options.getUser('target')
        let targetPlayer = find(gameData.players, {userId: selectedPlayer.id})
        if (!targetPlayer || targetPlayer.hands.main.length < 1){
            await interaction.editReply({ content: "I don't think you're target player is playing this game...", ephemeral: true })
            return
        }

        let stolen = targetPlayer.hands.main.splice(random(0,targetPlayer.hands.main.length - 1), 1)
        player.hands.main.push(stolen[0])

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id, {
                content: `${interaction.member.displayName} stole a card from ${interaction.guild.members.cache.get(targetPlayer.userId)?.displayName}`
            })
        )

        // Send private message to player about what they stole
        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (handInfo.attachments.length > 0) {
            await interaction.followUp({ 
                content: `You Stole:`, 
                embeds: [Formatter.oneCard(stolen[0]), ...handInfo.embeds],
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.followUp({ 
                content: `You Stole:`, 
                embeds: [Formatter.oneCard(stolen[0]), ...handInfo.embeds],
                ephemeral: true
            })  
        }
    }
}

module.exports = new Steal()