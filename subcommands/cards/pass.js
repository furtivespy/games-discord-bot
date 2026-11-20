const GameHelper = require('../../modules/GlobalGameHelper')
const {find} = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const CardMoves = require('../../modules/gameLogic/cardMoves')
const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags} = require('discord.js')

class Pass {
    async execute(interaction, client) {
        const [, gameData] = await Promise.all([
            interaction.deferReply({ flags: MessageFlags.Ephemeral }),
            GameHelper.getGameData(client, interaction)
        ]);

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`})
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.editReply({ content: "You are not playing this game..."})
            return
        }

        let selectedPlayer = interaction.options.getUser('target')
        let targetPlayer = find(gameData.players, {userId: selectedPlayer?.id})
        if (!targetPlayer || selectedPlayer.id === interaction.user.id) {
            await interaction.editReply({ content: "The selected player is not in this game or is yourself."})
            return
        }

        if (player.hands.main.length < 1) {
            await interaction.editReply({ content: "You have no cards to pass."})
            return
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('card')
            .setPlaceholder('Select cards to pass')
            .setMinValues(1)
            .setMaxValues(Math.min(player.hands.main.length, 15))
            .addOptions(
                Formatter.cardSort(player.hands.main).slice(0, 25).map(crd => 
                    ({label: Formatter.cardShortName(crd), value: crd.id})
                )  
            )

        const row = new ActionRowBuilder().addComponents(select)

        const CardsSelected = await interaction.editReply({ content: `Choose cards to pass to ${selectedPlayer.username}:`, components: [row], fetchReply: true })
        
        const filter = i => i.user.id === interaction.user.id && i.customId === 'card'
        let passedCards = []

        try {
            const collected = await CardsSelected.awaitMessageComponent({ filter, time: 60000 })
            passedCards = collected.values
        } catch (error) {
            return await interaction.editReply({ content: 'No cards selected', components: [] })
        }

        if (passedCards.length < 1){
            await interaction.editReply({ content: 'No cards selected', components: [] })
            return
        }
        await interaction.editReply({ content: `Passing ${passedCards.length} card(s) to ${selectedPlayer.username}...`, components: [] })
        const result = CardMoves.passFromHand(gameData, {
            player,
            cardIds: passedCards,
            targetUserId: selectedPlayer.id,
            actor: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.member?.displayName || interaction.user.username,
            },
        })
        if (!result.ok) {
            await interaction.editReply({ content: result.content, components: [] })
            return
        }
        const passedCardsObjects = result.cards || (result.card ? [result.card] : [])

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const [, senderHandInfo, receiverHandInfo] = await Promise.all([
            GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
                content: `${interaction.member.displayName} passed ${passedCardsObjects.length} card(s) to ${selectedPlayer}.`
            }),
            Formatter.playerSecretHandAndImages(gameData, player),
            Formatter.playerSecretHandAndImages(gameData, targetPlayer)
        ]);

        await interaction.followUp({
            content: `You passed ${passedCardsObjects.length} card(s) to ${selectedPlayer.username}. Your hand is now:`,
            embeds: [...senderHandInfo.embeds],
            files: [...senderHandInfo.attachments],
            flags: MessageFlags.Ephemeral
        });

        await interaction.guild.members.fetch(selectedPlayer.id).then(member => {
            member.send({
                content: `You received ${passedCardsObjects.length} card(s) from ${interaction.member.displayName}. Your hand is now:`,
                embeds: [...receiverHandInfo.embeds],
                files: [...receiverHandInfo.attachments]
            }).catch(() => {})
        });
    }
}

module.exports = new Pass()