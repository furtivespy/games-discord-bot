const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const Shuffle = require(`./shuffle`)

class DrawMulti {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
            return
        }

        await interaction.deferReply()

        let gameData = await GameHelper.getGameData(client, interaction)
        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        const inputDeck = interaction.options.getString('deck')
        const cardCount = interaction.options.getInteger('count')
        let dealCount = 0
        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)

        if (!deck || deck.piles.draw.cards.length < 1){
            await interaction.editReply({ content: "No cards in draw pile", ephemeral: true })
            return
        } 

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            gameData.players.push(
                Object.assign(
                    {},
                    cloneDeep(GameDB.defaultPlayer), 
                    {
                        guildId: interaction.guild.id,
                        userId: interaction.user.id,
                        order: gameData.players.length + 1,
                        name: interaction.member.displayName
                    }    
                )
            )

            player = find(gameData.players, {userId: interaction.user.id})
        }
        let wasShuffled = ""

        dealLoop:
        for (let i = 0; i < cardCount; i++) {
            if (deck.piles.draw.cards.length < 1){
                wasShuffled = "\n**The deck was shuffled**"
                Shuffle.DoShuffle(deck)
            } 

            if (deck.piles.draw.cards.length < 1){
                break dealLoop
            }
            const theCard = deck.piles.draw.cards.shift()
            player.hands.main.push(theCard)
            dealCount++
        }
        
        // Record this action in game history
        if (dealCount > 0) {
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const shuffleNote = wasShuffled ? " (deck was shuffled)" : ""
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.CARD,
                    GameDB.ACTION_TYPES.DRAW,
                    `${actorDisplayName} drew ${dealCount} cards from ${deck.name}${shuffleNote}`,
                    {
                        cardCount: dealCount,
                        deckName: deck.name,
                        source: "draw pile",
                        wasShuffled: wasShuffled.length > 0
                    },
                    actorDisplayName
                )
            } catch (error) {
                console.warn('Failed to record multi-card draw in history:', error)
            }
        }
        
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        await GameStatusHelper.sendGameStatus(interaction, client, gameData,
          { content: `${interaction.member.displayName} drew ${dealCount} cards from ${deck.name}${wasShuffled}` }
        );
            
        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (handInfo.attachments.length >0){
            await interaction.followUp({ 
                content: `Your Hand Now:`, 
                embeds: [...handInfo.embeds],
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.followUp({ 
                content: `Your Hand Now:`, 
                embeds: [...handInfo.embeds],
                ephemeral: true
            })  
        }
    }
}


module.exports = new DrawMulti()