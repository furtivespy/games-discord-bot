const GameHelper = require('../../modules/GlobalGameHelper')
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Discard {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            let currentPlayer = find(gameData.players, {userId: interaction.user.id})
            if (gameData.isdeleted || !currentPlayer){
                await interaction.respond([])
                return
            }
            await interaction.respond(
                GameHelper.getCardsAutocomplete(interaction.options.getString('card'), currentPlayer.hands.main)
            );
            return
        }

        await interaction.deferReply({ ephemeral: true })
        
        let gameData = await GameHelper.getGameData(client, interaction)
        let player = find(gameData.players, {userId: interaction.user.id})

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const cardid = interaction.options.getString('card')
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken!?", ephemeral: true })
            return
        }
        
        let card = find(player.hands.main, {id: cardid})
        let deck = find(gameData.decks, {name: card.origin})
        player.hands.main.splice(findIndex(player.hands.main, {id: cardid}), 1)
        deck.piles.discard.cards.push(card)

        const data = await Formatter.GameStatusV2(gameData, interaction.guild)

        //client.setGameData(`game-${interaction.channel.id}`, gameData)
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        await interaction.editReply({ content: `${interaction.member.displayName} has Discarded a card`,
        embeds: [
            ...Formatter.deckStatus2(gameData)
        ],
        files: [...data]})
        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (handInfo.attachments.length >0){
            await interaction.followUp({ 
                content: `You discarded ${Formatter.cardShortName(card)}`,
                embeds: [...handInfo.embeds],
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.followUp({ 
                content: `You discarded ${Formatter.cardShortName(card)}`,
                embeds: [...handInfo.embeds],
                ephemeral: true
            })  
        }
    }
}


module.exports = new Discard()