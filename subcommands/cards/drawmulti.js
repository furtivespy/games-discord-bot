const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const CardMoves = require('../../modules/gameLogic/cardMoves')

class DrawMulti {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
            return
        }

        const [, gameData] = await Promise.all([
            interaction.deferReply(),
            GameHelper.getGameData(client, interaction)
        ]);
        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        const cardCount = interaction.options.getInteger('count')
        const deckResult = GameHelper.resolveDeckOption(gameData, interaction.options.getString('deck'))
        if (await GameHelper.replyIfUnspecifiedDeck(interaction, deckResult)) {
            return
        }
        const deck = deckResult.deck
        if (!deck || deck.piles.draw.cards.length < 1){
            await interaction.editReply({ content: "No cards in draw pile"})
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

        const result = CardMoves.drawMultiple(gameData, {
            deck,
            count: cardCount,
            player,
            actor: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
            },
        })
        if (!result.ok) {
            await interaction.editReply({ content: result.content })
            return
        }
        
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
        
        const [, handInfo] = await Promise.all([
            GameStatusHelper.sendGameStatus(interaction, client, gameData,
              { content: result.content }
            ),
            Formatter.playerSecretHandAndImages(gameData, player)
        ]);
        if (handInfo.attachments.length >0){
            await interaction.followUp({ 
                content: `Your Hand Now:`, 
                embeds: [...handInfo.embeds],
                files: [...handInfo.attachments],
                flags: MessageFlags.Ephemeral
            })  
        } else {
            await interaction.followUp({ 
                content: `Your Hand Now:`, 
                embeds: [...handInfo.embeds],
                flags: MessageFlags.Ephemeral
            })  
        }
    }
}


module.exports = new DrawMulti()
