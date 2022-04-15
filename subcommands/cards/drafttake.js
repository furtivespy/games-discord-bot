const GameDB = require('../../db/anygame.js')
const { cloneDeep, sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Take {
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
                    filter(ddplayer.hands.draft, 
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
            if (!player || findIndex(player.hands.draft, {id: cardid}) == -1){
                await interaction.reply({ content: "Something is broken!?", ephemeral: true })
                return
            }
            
            let theCard = find(player.hands.draft, {id: cardid})
            player.hands.draft.splice(findIndex(player.hands.draft, {id: cardid}), 1)
            player.hands.main.push(theCard)
            
            client.setGameData(`game-${interaction.channel.id}`, gameData)
            await interaction.reply({ content: `${interaction.member.displayName} has drafted a card!`})
            let cardsLeft = gameData.players[0].hands.draft.length
            if (cardsLeft > 0){
                let shouldPass = true
                for (let i = 1; i < gameData.players.length; i++){
                    if (gameData.players[i].hands.draft.length != cardsLeft){
                        shouldPass = false
                        break
                    }
                }
                if (shouldPass){
                    const data = await Formatter.GameStatusV2(gameData, interaction.guild)
                    await interaction.followUp({ 
                        content: `It's probably time to pass!`,
                        files: [...data]})
                }
            }
            
            var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
            if (handInfo.attachments.length >0){
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
}


module.exports = new Take()