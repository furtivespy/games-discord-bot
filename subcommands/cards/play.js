const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Play {
    async execute(interaction, client) {

        let gameData = await GameHelper.getGameData(client, interaction)

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
            await interaction.deferReply()
            
            let card = find(player.hands.main, {id: cardid})
            let deck = find(gameData.decks, {name: card.origin})
            player.hands.main.splice(findIndex(player.hands.main, {id: cardid}), 1)
            deck.piles.discard.cards.push(card)

            //client.setGameData(`game-${interaction.channel.id}`, gameData)
            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
            await interaction.editReply({ content: `${interaction.member.displayName} has Played:`,
            embeds: [
                Formatter.oneCard(card),
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
}


module.exports = new Play()