const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const Shuffle = require(`./shuffle`)
const { ActionRowBuilder, SelectMenuBuilder } = require('discord.js');

class Configure {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (interaction.isAutocomplete()) {
            if (gameData.isdeleted || gameData.decks.length < 1){
                await interaction.respond([])
                return
            }
            await interaction.respond(gameData.decks.map(d => ({name: d.name, value: d.name})))
        } else {
            if (gameData.isdeleted) {
                await interaction.reply({ content: `There is no game in this channel.`, ephemeral: true })
                return
            }

            const inputDeck = interaction.options.getString('deck')
            const configType = interaction.options.getString('config')
            
            const deck = gameData.decks.length == 1 ? gameData.decks[0] : find(gameData.decks, {name: inputDeck})
            if (!deck){
                await interaction.reply({ content: `No deck found.`, ephemeral: true })
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
                    action = () => {
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
                    action = () => {
                        let val = null
                        if (newInteraction) {
                            val = newInteraction.values[0]
                            deck.hiddenInfo = val
                        } 
                    }
                break
                default:
                    await interaction.reply({ content: `Invalid config type.`, ephemeral: true })
                    return
            }

            

            let rply = await interaction.reply({ 
                content: msg, 
                components: [row],
                fetchReply:  true
            })
            const filter = (int) => int.customId === 'select'
            let newInteraction = await rply.awaitMessageComponent({ filter, time: 60_000 }).catch(err => client.logger.log(err,'error'))
            
            action()
            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
            const data = await Formatter.GameStatusV2(gameData, interaction.guild)
            
            await newInteraction.reply({ 
                content: `Configured ${deck.name}`,
                embeds: [
                    Formatter.deckStatus(deck)
                ],
                files: [...data],
            })
        }
    }
}


module.exports = new Configure()