const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Take {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            let ddplayer = find(gameData.players, {userId: interaction.user.id})
            if (gameData.isdeleted || !ddplayer) { return }

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
        if (!player || findIndex(player.hands.draft, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken!?", ephemeral: true })
            return
        }
        
        let theCard = find(player.hands.draft, {id: cardid})
        player.hands.draft.splice(findIndex(player.hands.draft, {id: cardid}), 1)
        player.hands.main.push(theCard)
        
        //client.setGameData(`game-${interaction.channel.id}`, gameData)
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        await interaction.editReply({ content: `${interaction.member.displayName} has drafted a card!`})
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
                await interaction.followUp(
                    await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id,
                      { content: `It's probably time to pass!` }
                    )
                  );
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


module.exports = new Take()