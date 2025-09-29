const GameHelper = require('../../modules/GlobalGameHelper')
const GameDB = require('../../db/anygame.js')
const { cloneDeep, sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class Take {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            let ddplayer = find(gameData.players, {userId: interaction.user.id})
            if (gameData.isdeleted || !ddplayer || !ddplayer.hands.draft) {
                await interaction.respond([]);
                return
            }

            await interaction.respond(
                sortBy(
                    filter(ddplayer.hands.draft, 
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
        if (!player || !player.hands.draft || findIndex(player.hands.draft, {id: cardid}) == -1){
            await interaction.editReply({ content: "You don't seem to have that card to draft.", ephemeral: true })
            return
        }
        
        let theCard = find(player.hands.draft, {id: cardid})
        player.hands.draft.splice(findIndex(player.hands.draft, {id: cardid}), 1)
        player.hands.main.push(theCard)
        
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.TAKE,
                `${actorDisplayName} drafted a card.`,
                { cardId: theCard.id }
            )
        } catch (error) {
            console.warn('Failed to record draft take in history:', error)
        }
        
        await interaction.editReply({ content: `${interaction.member.displayName} has drafted a card!`})

        let cardsLeft = player.hands.draft.length
        let shouldPass = true
        for (let i = 0; i < gameData.players.length; i++){
            if ((gameData.players[i].hands.draft?.length || 0) !== cardsLeft){
                shouldPass = false
                break
            }
        }
        
        if (shouldPass){
            await GameStatusHelper.sendGameStatus(interaction, client, gameData,
              { content: `It's probably time to pass!` }
            );
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (handInfo.attachments.length > 0){
            await interaction.followUp({ 
                content: `You drafted:`, 
                embeds: [Formatter.oneCard(theCard), ...handInfo.embeds],
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.followUp({ 
                content: `You drafted:`, 
                embeds: [Formatter.oneCard(theCard), ...handInfo.embeds],
                ephemeral: true
            })  
        }
    }
}

module.exports = new Take()