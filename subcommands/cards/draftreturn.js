const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Take {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            let ddplayer = find(gameData.players, {userId: interaction.user.id})
            if (gameData.isdeleted || !ddplayer) { return }

            await interaction.respond(
                sortBy(
                    filter(ddplayer.hands.main, 
                        crd => Formatter.cardShortName(crd).toLowerCase()
                            .includes(interaction.options.getString('card').toLowerCase())
                        ),  ['suit', 'value', 'name']).map(crd => 
                    ({name: Formatter.cardShortName(crd), value: crd.id}))
            )
            return
        }

        await interaction.deferReply({ ephemeral: true })
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const cardid = interaction.options.getString('card')
        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken!?", ephemeral: true })
            return
        }
        
        let theCard = find(player.hands.main, {id: cardid})
        player.hands.main.splice(findIndex(player.hands.main, {id: cardid}), 1)
        player.hands.draft.push(theCard)
        
        // Record history (privacy protected - no card names since returning to draft is private)
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.RETURN,
                `${actorDisplayName} returned a card from main hand to draft`,
                {
                    cardId: theCard.id,
                    cardName: Formatter.cardShortName(theCard), // For admin/debugging only
                    playerUserId: player.userId,
                    playerUsername: actorDisplayName,
                    mainHandSizeBefore: player.hands.main.length + 1,
                    mainHandSizeAfter: player.hands.main.length,
                    draftHandSizeBefore: player.hands.draft.length - 1,
                    draftHandSizeAfter: player.hands.draft.length,
                    action: "main hand to draft hand"
                }
            )
        } catch (error) {
            console.warn('Failed to record draft return in history:', error)
        }
        
        //client.setGameData(`game-${interaction.channel.id}`, gameData)
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        await interaction.editReply({ content: `${interaction.member.displayName} has un-drafted a card!`})
                        
        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (handInfo.attachments.length >0){
            await interaction.followUp({ 
                content: `You un-drafted:`, 
                embeds: [Formatter.oneCard(theCard), ...handInfo.embeds],
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.followUp({ 
                content: `You un-drafted:`, 
                embeds: [Formatter.oneCard(theCard), ...handInfo.embeds],
                ephemeral: true
            })  
        }
    }
}


module.exports = new Take()