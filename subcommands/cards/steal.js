const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find, random } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Steal {
    async execute(interaction, client) {
        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.editReply({ content: "I don't think you're playing this game..."})
            return
        }

        let selectedPlayer = interaction.options.getUser('target')
        let targetPlayer = find(gameData.players, {userId: selectedPlayer.id})
        if (!targetPlayer || targetPlayer.hands.main.length < 1){
            await interaction.editReply({ content: "I don't think you're target player is playing this game..."})
            return
        }

        let stolen = targetPlayer.hands.main.splice(random(0,targetPlayer.hands.main.length - 1), 1)
        player.hands.main.push(stolen[0])

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const targetDisplayName = interaction.guild.members.cache.get(targetPlayer.userId)?.displayName || selectedPlayer.username
            const cardName = Formatter.cardShortName(stolen[0])
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.STEAL,
                `${actorDisplayName} stole a card from ${targetDisplayName}`,
                {
                    targetUserId: targetPlayer.userId,
                    targetUsername: targetDisplayName
                }
            )
        } catch (error) {
            console.warn('Failed to record card steal in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content: `${interaction.member.displayName} stole a card from ${interaction.guild.members.cache.get(targetPlayer.userId)?.displayName}`
        })

        // Send private message to player about what they stole
        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (handInfo.attachments.length > 0) {
            await interaction.followUp({ 
                content: `You Stole:`, 
                embeds: [Formatter.oneCard(stolen[0]), ...handInfo.embeds],
                files: [...handInfo.attachments],
                flags: MessageFlags.Ephemeral
            })  
        } else {
            await interaction.followUp({ 
                content: `You Stole:`, 
                embeds: [Formatter.oneCard(stolen[0]), ...handInfo.embeds],
                flags: MessageFlags.Ephemeral
            })  
        }
    }
}

module.exports = new Steal()