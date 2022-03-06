const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Draw {
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
            const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})

            if (!deck || deck.piles.draw.length < 0){
                await interaction.reply({ content: "No cards in draw pile", ephemeral: true })
                return
            } 

            const theCard = deck.piles.draw.cards.shift()

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

            player.hands.main.push(theCard)
            client.setGameData(`game-${interaction.channel.id}`, gameData)

            let deckEmbeds = []
            gameData.decks.forEach(deck => {
                deckEmbeds.push(Formatter.deckStatus(deck))
            })
            await interaction.reply({ 
                content: `Drew a card from ${deck.name}`,
                embeds: [
                    await Formatter.GameStatus(gameData, interaction.guild),
                    ...deckEmbeds
                ]
            })
            await interaction.followUp({ 
                content: `You drew:`, 
                embeds: [Formatter.oneCard(theCard), 
                    Formatter.playerSecretHand(gameData, player)
                ],
                ephemeral: true
            })
        }
    }
}


module.exports = new Draw()