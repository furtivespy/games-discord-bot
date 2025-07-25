const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Draw {
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
        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id)

        if (!deck || deck.piles.draw.cards.length < 1){
            await interaction.editReply({ content: "No cards in draw pile", ephemeral: true })
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
        //client.setGameData(`game-${interaction.channel.id}`, gameData)
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
                        
        await interaction.editReply(
            await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id,
              { content: `${interaction.member.displayName} drew a card from ${deck.name}` }
            )
          );
        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)
        if (handInfo.attachments.length >0){
            await interaction.followUp({ 
                content: `You drew:`, 
                embeds: [Formatter.oneCard(theCard), ...handInfo.embeds],
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.followUp({ 
                content: `You drew:`, 
                embeds: [Formatter.oneCard(theCard), ...handInfo.embeds],
                ephemeral: true
            })  
        }
    }
}

module.exports = new Draw()