const { MessageFlags } = require("discord.js");
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameHelper = require('../../modules/GlobalGameHelper')
const CardMoves = require('../../modules/gameLogic/cardMoves')

class Show {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            let gameData = await GameHelper.getGameData(client, interaction)
            let currentPlayer = find(gameData.players, {userId: interaction.user.id})

            if (focusedOption.name === 'card') {
                if (gameData.isdeleted || !currentPlayer || !currentPlayer.hands.main){
                    await interaction.respond([])
                    return
                }
                await interaction.respond(
                    GameHelper.getCardsAutocomplete(focusedOption.value, currentPlayer.hands.main)
                )
            }
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

        const cardid = interaction.options.getString('card')
        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken!?"})
            return
        }

        const result = CardMoves.showFromHand(gameData, {
            player,
            cardId: cardid,
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
        const card = result.card

        // Save game data to persist history entry
        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const cardMedia = await Formatter.oneCardReplyParts(card)
        const publicReply = {
            content: "Showing a card:",
            embeds: [cardMedia.embed]
        }
        if (cardMedia.files.length > 0) {
            publicReply.files = [...cardMedia.files]
        }

        const [, handInfo] = await Promise.all([
            interaction.editReply(publicReply),
            Formatter.playerSecretHandAndImages(gameData, player)
        ]);
        if (handInfo.attachments.length >0){
            await interaction.followUp({ 
                embeds: [...handInfo.embeds],
                files: [...handInfo.attachments],
                flags: MessageFlags.Ephemeral
            })  
        } else {
            await interaction.followUp({ 
                embeds: [...handInfo.embeds],
                flags: MessageFlags.Ephemeral
            })  
        }
    }
}


module.exports = new Show()
