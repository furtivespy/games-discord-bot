const GameDB = require('../../db/anygame.js')
const { cloneDeep, sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Discard {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            client.getGameData(`game-${interaction.channel.id}`)
        )

        if (interaction.isAutocomplete()) {
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

        } else {

            if (gameData.isdeleted) {
                await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
                return
            }

            const cardid = interaction.options.getString('card')
            let player = find(gameData.players, {userId: interaction.user.id})
            if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
                await interaction.reply({ content: "Something is broken!?", ephemeral: true })
                return
            }
            
            let card = find(player.hands.main, {id: cardid})
            let deck = find(gameData.decks, {name: card.origin})
            player.hands.main.splice(findIndex(player.hands.main, {id: cardid}), 1)
            deck.piles.discard.cards.push(card)

            let deckEmbeds = []
            gameData.decks.forEach(deck => {
                deckEmbeds.push(Formatter.deckStatus(deck))
            })

            client.setGameData(`game-${interaction.channel.id}`, gameData)
            await interaction.reply({ content: "Discarded a card:",
            embeds: [
                await Formatter.GameStatus(gameData, interaction.guild),
                ...deckEmbeds
            ]})
            await interaction.followUp({ content: `You discarded ${Formatter.cardShortName(card)}`,
                embeds: [
                    Formatter.playerSecretHand(gameData, player)
                ],
                ephemeral: true
            })

        }
    }
}


module.exports = new Discard()