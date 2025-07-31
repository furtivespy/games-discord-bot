const GameDB = require('../../db/anygame.js')
const { sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameHelper = require('../../modules/GlobalGameHelper')

class Reveal {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            if (gameData.isdeleted) { return }
            let ddplayer = find(gameData.players, {userId: interaction.user.id})
            if (!ddplayer) { return }

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

        await interaction.deferReply()
        
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
        
        let card = find(player.hands.main, {id: cardid})
        
        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(card)
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.REVEAL,
                `${actorDisplayName} revealed ${cardName} from hand`,
                {
                    cardId: card.id,
                    cardName: cardName,
                    source: "hand",
                    action: "public reveal"
                }
            )
        } catch (error) {
            console.warn('Failed to record card reveal in history:', error)
        }

        // Save game data to persist history entry
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await interaction.editReply({ content: "Revealing a card:",
        embeds: [
            Formatter.oneCard(card),
        ]})

        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (handInfo.attachments.length >0){
            await interaction.followUp({ 
                embeds: [...handInfo.embeds],
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.followUp({ 
                embeds: [...handInfo.embeds],
                ephemeral: true
            })  
        }
    }
}


module.exports = new Reveal()