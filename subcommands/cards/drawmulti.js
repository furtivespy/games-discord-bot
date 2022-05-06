const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const Shuffle = require(`./shuffle`)

class DrawMulti {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
        )

        if (interaction.isAutocomplete()) {
            if (gameData.isdeleted || gameData.decks.length < 1){
                await interaction.respond([])
                return
            }
            await interaction.respond(gameData.decks.map(d => ({name: d.name, value: d.name})))
        } else {
            if (gameData.isdeleted) {
                await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
                return
            }

            const inputDeck = interaction.options.getString('deck')
            const cardCount = interaction.options.getInteger('count')
            let dealCount = 0
            const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})

            if (!deck || deck.piles.draw.length < 0){
                await interaction.reply({ content: "No cards in draw pile", ephemeral: true })
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

            dealLoop:
            for (let i = 0; i < cardCount; i++) {
                if (deck.piles.draw.length < 1){
                    await Shuffle.execute(interaction, client)
                } 

                if (deck.piles.draw.cards.length + deck.piles.discard.cards.length < 1){
                    break dealLoop
                }
                const theCard = deck.piles.draw.cards.shift()
                player.hands.main.push(theCard)
                dealCount++
            }
            
            client.setGameData(`game-${interaction.channel.id}`, gameData)

            const data = await Formatter.GameStatusV2(gameData, interaction.guild)
            let deckEmbeds = []
            gameData.decks.forEach(deck => {
                deckEmbeds.push(Formatter.deckStatus(deck))
            })
            await interaction.reply({ 
                content: `${interaction.member.displayName} drew ${dealCount} cards from ${deck.name}`,
                embeds: [
                    ...deckEmbeds
                ],
                files: [...data]
            })
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
}


module.exports = new DrawMulti()