const GameHelper = require('../../modules/GlobalGameHelper')
const { sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameDB = require('../../db/anygame')

class Play {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            let gameData = await GameHelper.getGameData(client, interaction)
            if (gameData.isdeleted) { return }
            let ddplayer = find(gameData.players, {userId: interaction.user.id})
            if (!ddplayer) { return }

            if (focusedOption.name === 'card') {
                await interaction.respond(
                    sortBy(
                        filter(ddplayer.hands.main, 
                            crd => Formatter.cardShortName(crd).toLowerCase()
                                .includes(focusedOption.value.toLowerCase())
                            ),  ['suit', 'value', 'name']).map(crd => 
                        ({name: Formatter.cardShortName(crd), value: crd.id}))
                )
            } else if (focusedOption.name === 'pilename') {
                await interaction.respond(GameHelper.getPileAutocomplete(gameData, focusedOption.value))
            }
            return
        }

        await interaction.deferReply()
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const cardid = interaction.options.getString('card')
        const destination = interaction.options.getString('destination')
        const pileId = interaction.options.getString('pilename')
        
        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken!?", ephemeral: true })
            return
        }
        
        const cardIndex = findIndex(player.hands.main, {id: cardid})
        const [playedCard] = player.hands.main.splice(cardIndex, 1)

        let destinationName = ''
        let actualDestination = destination

        // If no destination specified, use playToPlayArea setting
        if (!actualDestination) {
            actualDestination = gameData.playToPlayArea ? 'playarea' : 'discard'
        }

        // Handle different destinations
        if (actualDestination === 'pile') {
            const pile = GameHelper.getGlobalPile(gameData, pileId)
            if (!pile) {
                player.hands.main.splice(cardIndex, 0, playedCard)
                await interaction.editReply({ content: 'Pile not found!', ephemeral: true })
                return
            }
            pile.cards.push(playedCard)
            destinationName = pile.name
        } else if (actualDestination === 'gameboard') {
            if (!gameData.gameBoard) {
                gameData.gameBoard = []
            }
            gameData.gameBoard.push(playedCard)
            destinationName = 'Game Board'
        } else if (actualDestination === 'playarea') {
            if (!player.playArea) {
                player.playArea = []
            }
            player.playArea.push(playedCard)
            destinationName = 'play area'
        } else {
            // Default to discard
            let deck = find(gameData.decks, {name: playedCard.origin})
            if (deck && deck.piles && deck.piles.discard) {
                deck.piles.discard.cards.push(playedCard)
                destinationName = 'discard pile'
            } else {
                player.hands.main.splice(cardIndex, 0, playedCard)
                client.logger.log(`Error: Deck or discard pile not found for card origin '${playedCard.origin}' in /cards play.`, 'error')
                await interaction.editReply({ content: `Error: Could not find the discard pile. Card returned to hand.`, ephemeral: true })
                return
            }
        }

        // Record this action in game history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardName = Formatter.cardShortName(playedCard)
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.PLAY,
                `${actorDisplayName} played ${cardName} to ${destinationName}`,
                {
                    cardId: playedCard.id,
                    cardName: cardName,
                    destination: destinationName,
                    destinationType: actualDestination,
                    origin: playedCard.origin
                },
                actorDisplayName
            )
        } catch (error) {
            console.warn('Failed to record card play in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const replyEmbeds = [
            Formatter.oneCard(playedCard),
            ...Formatter.deckStatus2(gameData)
        ];
        const replyFiles = [];

        if (actualDestination === 'playarea' && player.playArea && player.playArea.length > 0) {
            const { EmbedBuilder } = require('discord.js');
            const playAreaEmbed = new EmbedBuilder()
                .setColor(player.color || 13502711)
                .setTitle(`${interaction.member.displayName}'s Updated Play Area`);

            const cardNames = player.playArea.map(card => Formatter.cardShortName(card));
            playAreaEmbed.addFields({
                name: "Current Cards in Play Area",
                value: cardNames.length > 0 ? cardNames.join(', ') : 'No cards in play area',
                inline: false
            });

            replyEmbeds.push(playAreaEmbed);
        }

        const replyOptions = {
            content: `${interaction.member.displayName} has Played to ${destinationName}:`,
            embeds: replyEmbeds
        };
        if (replyFiles.length > 0) {
            replyOptions.files = replyFiles;
        }
        await interaction.editReply(replyOptions);

        // The ephemeral follow-up for hand status remains the same
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