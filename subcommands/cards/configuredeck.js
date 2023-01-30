const GameDB = require('../../db/anygame.js')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')
const Shuffle = require(`./shuffle`)
const { MessageActionRow, MessageSelectMenu } = require('discord.js');

class Configure {
    async execute(interaction, client) {

        let gameData = Object.assign(
            {},
            cloneDeep(GameDB.defaultGameData), 
            await client.getGameData(`game-${interaction.channel.id}`)
        )

       
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

        // Do this once there are multiple configTypes
        //switch (configType){

        const row = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('select')
                .setPlaceholder('Nothing selected')
                .addOptions([
                    {label: 'Standard', value: 'standard'},
                    {label: 'Bag', value: 'bag'},
                ]),
        );

        let rply = await interaction.reply({ 
            content: `How would you like to configure ${deck.name} for shuffling?\n` + 
            `Standard - Shuffle discard pile and place on bottom of draw\n` +
            `Bag - Draw and discard piles are shuffled together`, 
            components: [row],
            fetchReply:  true
        })
        const filter = (int) => int.customId === 'select'
        let newInteraction = await rply.awaitMessageComponent({ filter, time: 60_000 }).catch(err => this.client.logger.log(err,'error'))

        let val = null
        if (newInteraction) {
            val = newInteraction.values[0]
        } else {
            rply.delete()
            return
        }

        deck.shuffleStyle = val
        client.setGameData(`game-${interaction.channel.id}`, gameData)

        const data = await Formatter.GameStatusV2(gameData, interaction.guild)
        
        await newInteraction.reply({ 
            content: `Configured ${deck.name} to ${val}`,
            embeds: [
                Formatter.deckStatus(deck)
            ],
            files: [...data],
        })
        
    }
}


module.exports = new Configure()