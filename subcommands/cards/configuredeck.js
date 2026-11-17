const GameDB = require('../../db/anygame.js')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const GameHelper = require('../../modules/GlobalGameHelper')
const DeckBack = require('../../modules/DeckBack')
const { ActionRowBuilder, EmbedBuilder, SelectMenuBuilder } = require('discord.js');

class Configure {
    async execute(interaction, client) {

        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction)
            await GameHelper.getDeckAutocomplete(gameData, interaction)
        } else {
            const [, gameData] = await Promise.all([
                interaction.deferReply(),
                GameHelper.getGameData(client, interaction)
            ])
            if (gameData.isdeleted) {
                await interaction.editReply({ content: `There is no game in this channel.`})
                return
            }

            const configType = interaction.options.getString('config')
            
            const deckResult = GameHelper.resolveDeckOption(gameData, interaction.options.getString('deck'))
            if (await GameHelper.replyIfUnspecifiedDeck(interaction, deckResult)) {
                return
            }
            const deck = deckResult.deck
            if (!deck){
                await interaction.editReply({ content: `No deck found.`})
                return
            }

            if (configType === 'deckback') {
                await this.applyDeckBack(interaction, client, gameData, deck)
                return
            }
            
            let row
            let action
            let msg = ""
            // Do this once there are multiple configTypes
            switch (configType){
                case 'shufflestyle':
                    row = new ActionRowBuilder()
                    .addComponents(
                        new SelectMenuBuilder()
                            .setCustomId('select')
                            .setPlaceholder('Nothing selected')
                            .addOptions([
                                {label: 'Standard', value: 'standard'},
                                {label: 'Bag', value: 'bag'},
                            ]),
                    );
                    msg = `How would you like to configure ${deck.name} for shuffling?\n` +
                            `Standard - Shuffle discard pile and place on bottom of draw\n` +
                            `Bag - Draw and discard piles are shuffled together`
                    action = (newInteraction) => {
                        let val = null
                        if (newInteraction) {
                            val = newInteraction.values[0]
                            deck.shuffleStyle = val
                        } 
                    }
                break
                case 'displaycardcounts':
                    row = new ActionRowBuilder()
                    .addComponents(
                        new SelectMenuBuilder()
                            .setCustomId('select')
                            .setPlaceholder('Nothing selected')
                            .addOptions([
                                {label: 'All Counts Visible', value: 'visible'},
                                {label: 'Hand size hidden', value: 'hand'},
                                {label: 'Deck size hidden', value: 'deck'},
                                {label: 'All sizes hidden', value: 'all'},
                            ]),
                    );
                    msg = `How would you like to configure ${deck.name} for showing card counts?\n` +
                            `Hand - The cards currently in a players hand\n` +
                            `Deck - The Draw and Discard piles\n`
                    action = (newInteraction) => {
                        let val = null
                        if (newInteraction) {
                            val = newInteraction.values[0]
                            deck.hiddenInfo = val
                        } 
                    }
                break
                default:
                    await interaction.editReply({ content: `Invalid config type.`})
                    return
            }

            let rply = await interaction.editReply({ 
                content: msg, 
                components: [row],
                fetchReply:  true
            })
            const filter = (int) => int.customId === 'select'
            let newInteraction = await rply.awaitMessageComponent({ filter, time: 60_000 }).catch(err => client.logger.log(err,'error'))
            if (!newInteraction) {
                await interaction.editReply({ content: 'No selection made, command timed out.', components: [] });
                return;
            }
            await newInteraction.deferReply()
            const originalValue = configType === 'shufflestyle' ? deck.shuffleStyle : deck.hiddenInfo
            
            action(newInteraction)
            
            try {
                const actorDisplayName = newInteraction.member?.displayName || newInteraction.user.username
                const newValue = configType === 'shufflestyle' ? deck.shuffleStyle : deck.hiddenInfo
                
                GameHelper.recordMove(
                    gameData,
                    newInteraction.user,
                    GameDB.ACTION_CATEGORIES.CARD,
                    GameDB.ACTION_TYPES.MODIFY,
                    `${actorDisplayName} configured ${deck.name} ${configType}: ${originalValue} → ${newValue}`,
                    {
                        deckName: deck.name,
                        configType: configType,
                        originalValue: originalValue,
                        newValue: newValue,
                        configCategory: configType === 'shufflestyle' ? 'shuffle behavior' : 'visibility settings'
                    }
                )
            } catch (error) {
                console.warn('Failed to record deck configuration in history:', error)
            }
            
            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
            
            await GameStatusHelper.sendGameStatus(newInteraction, client, gameData,
              { content: `Configured ${deck.name}` }
            );
        }
    }

    async applyDeckBack(interaction, client, gameData, deck) {
        const parsed = DeckBack.parseBackUrlInput(interaction.options.getString('url'))
        if (parsed.error) {
            await interaction.editReply({ content: parsed.error })
            return
        }

        const originalValue = DeckBack.canonicalBackUrl(deck)
        if (!parsed.present) {
            const payload = {
                content: originalValue
                    ? `${deck.name} uses a custom deck back. Pass url to set an image, or url:clear for the default.`
                    : `${deck.name} uses ${DeckBack.DEFAULT_LABEL}. Pass url to set an image, or url:clear for the default.`,
            }
            if (originalValue) {
                payload.embeds = [
                    new EmbedBuilder().setTitle(`${deck.name} deck back`).setImage(originalValue),
                ]
            }
            await interaction.editReply(payload)
            return
        }

        DeckBack.applyBackUrl(deck, parsed.backUrl)

        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const newValue = DeckBack.describeBackUrl(parsed.backUrl)
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} configured ${deck.name} deck back: ${DeckBack.describeBackUrl(originalValue)} → ${newValue}`,
                {
                    deckName: deck.name,
                    configType: 'deckback',
                    originalValue: originalValue,
                    newValue: parsed.backUrl,
                    configCategory: 'deck back image'
                }
            )
        } catch (error) {
            console.warn('Failed to record deck configuration in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

        const additionalEmbeds = parsed.backUrl
            ? [new EmbedBuilder().setTitle(`${deck.name} deck back`).setImage(parsed.backUrl)]
            : []
        const content = parsed.backUrl
            ? `Set ${deck.name} deck back.`
            : `Cleared ${deck.name} deck back; using ${DeckBack.DEFAULT_LABEL}.`

        await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
            content,
            additionalEmbeds,
        })
    }
}


module.exports = new Configure()