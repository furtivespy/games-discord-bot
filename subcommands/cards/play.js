const GameHelper = require('../../modules/GlobalGameHelper')
const {sortBy, find, filter, findIndex } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const CardMoves = require('../../modules/gameLogic/cardMoves')
const { EmbedBuilder, MessageFlags } = require('discord.js')

class Play {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true)
            let gameData = await GameHelper.getGameData(client, interaction)
            if (gameData.isdeleted) { return }
            let ddplayer = find(gameData.players, {userId: interaction.user.id})
            if (!ddplayer) { return }

            if (focusedOption.name === 'card') {
                await interaction.respond(
                    sortBy(
                        filter(ddplayer.hands.main, 
                            crd => Formatter.cardShortName(crd).toLowerCase()
                                .includes(focusedOption.value.toLowerCase())
                            ),  ['suit', 'value', 'name']).map(crd => 
                        ({name: Formatter.cardShortName(crd), value: crd.id}))
                )
            } else if (focusedOption.name === 'destination') {
                await interaction.respond(GameHelper.getDestinationAutocomplete(gameData, focusedOption.value, ['playarea', 'discard', 'gameboard', 'pile']))
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
        const destination = interaction.options.getString('destination')
        
        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player || findIndex(player.hands.main, {id: cardid}) == -1){
            await interaction.editReply({ content: "Something is broken!?"})
            return
        }

        const result = CardMoves.playFromHand(gameData, {
            player,
            cardId: cardid,
            destination,
            actor: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
            },
        })
        if (!result.ok) {
            if (result.error === "discard_pile_missing") {
                client.logger.log(`Error: Deck or discard pile not found for card origin in /cards play.`, 'error')
            }
            const reply = { content: result.content }
            if (
                result.error === "discard_pile_missing" ||
                result.error === "destination_not_found"
            ) {
                reply.flags = MessageFlags.Ephemeral
            }
            await interaction.editReply(reply)
            return
        }

        const cardToPlay = result.card
        const destinationName = result.destinationName
        const actualDestination = result.actualDestination
        const destinationTypeForHistory = result.destinationType

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const cardMedia = await Formatter.oneCardReplyParts(cardToPlay);
        const replyEmbeds = [
            cardMedia.embed,
            ...Formatter.deckStatus2(gameData)
        ];
        const replyFiles = [...cardMedia.files];

        // If played to playarea, show updated playarea
        if ((actualDestination === 'playarea' || destinationTypeForHistory === 'playarea') && player.playArea && player.playArea.length > 0) {
            const playAreaEmbed = new EmbedBuilder()
                .setColor(player.color || 13502711)
                .setTitle(`${interaction.member.displayName}'s Updated Play Area`);

            const playAreaAttachment = await Formatter.genericCardZoneDisplay(
                player.playArea,
                playAreaEmbed,
                "Current Cards in Play Area",
                `PlayAreaUpdate-${player.userId}`
            );

            if (playAreaAttachment) {
                replyFiles.push(playAreaAttachment);
            }
            // Only add if fields exist
            if (playAreaEmbed.data.fields && playAreaEmbed.data.fields.length > 0) {
                 replyEmbeds.push(playAreaEmbed);
            }
        }

        const replyOptions = {
            content: `${interaction.member.displayName} has Played to ${destinationName}:`,
            embeds: replyEmbeds
        };
        if (replyFiles.length > 0) {
            replyOptions.files = replyFiles;
        }
        const [, handInfo] = await Promise.all([
            interaction.editReply(replyOptions),
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

module.exports = new Play()