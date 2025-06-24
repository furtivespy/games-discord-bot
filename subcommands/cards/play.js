const GameHelper = require('../../modules/GlobalGameHelper')
const { sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Play {
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
        
        const cardIndex = findIndex(player.hands.main, {id: cardid})
        // It's important to get the card object before splicing, or splice and get it from the result
        const [playedCard] = player.hands.main.splice(cardIndex, 1)

        if (gameData.playToPlayArea) {
            if (!player.playArea) { // Should be initialized by defaultPlayer
                player.playArea = [];
            }
            player.playArea.push(playedCard);
            // Optional: Log or notify that it went to play area
        } else {
            let deck = find(gameData.decks, {name: playedCard.origin});
            if (deck && deck.piles && deck.piles.discard) {
                deck.piles.discard.cards.push(playedCard);
            } else {
                // Attempt to return card to hand if discard pile is not found
                player.hands.main.splice(cardIndex, 0, playedCard); // Add back to original position
                client.logger.log(`Error: Deck or discard pile not found for card origin '${playedCard.origin}' in /cards play. Card '${playedCard.name}' returned to hand.`, 'error');
                await interaction.editReply({ content: `Error: Could not find the discard pile for card '${playedCard.name}'. It has been returned to your hand.`, ephemeral: true });
                return; // Stop further processing for this play
            }
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        await interaction.editReply({ content: `${interaction.member.displayName} has Played:`,
        embeds: [
            Formatter.oneCard(playedCard), // Corrected variable name from card to playedCard
            ...Formatter.deckStatus2(gameData)
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

module.exports = new Play()