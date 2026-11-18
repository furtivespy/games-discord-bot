const { MessageFlags } = require("discord.js");
const { find, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameHelper = require('../../modules/GlobalGameHelper')
const CardMoves = require('../../modules/gameLogic/cardMoves')
const { withGameDocumentLock } = require('../../modules/gameDocumentLock')

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

        const [, outcome] = await Promise.all([
            interaction.deferReply(),
            withGameDocumentLock(interaction.guildId, interaction.channelId, async () => {
                const gameData = await GameHelper.getGameData(client, interaction)

                if (gameData.isdeleted) {
                    return { kind: "no_game" }
                }

                const cardid = interaction.options.getString('card')
                let player = find(gameData.players, {userId: interaction.user.id})
                if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
                    return { kind: "missing" }
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
                    return { kind: "failed", result }
                }

                // Save game data to persist history entry
                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
                return { kind: "ok", gameData, player, result }
            })
        ]);

        if (outcome.kind === "no_game") {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }
        if (outcome.kind === "missing") {
            await interaction.editReply({ content: "Something is broken!?"})
            return
        }
        if (outcome.kind === "failed") {
            await interaction.editReply({ content: outcome.result.content })
            return
        }
        const { gameData, player, result } = outcome
        const card = result.card

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
