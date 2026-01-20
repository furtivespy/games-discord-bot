const GameHelper = require('../../modules/GlobalGameHelper')
const { EmbedBuilder } = require('discord.js')

class PileList {
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true })
        
        const gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        if (!gameData.globalPiles || gameData.globalPiles.length === 0) {
            await interaction.editReply({ content: `No global piles have been created yet. Use \`/cards pile create\` to make one!`, ephemeral: true })
            return
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`Card Piles in ${gameData.name}`)
            .setDescription(`${gameData.globalPiles.length} pile(s) available`)
            .setTimestamp()

        gameData.globalPiles.forEach(pile => {
            const secretBadge = pile.isSecret ? '🔒 ' : ''
            const cardCount = pile.cards.length
            const cardText = cardCount === 1 ? 'card' : 'cards'
            
            let valueText = `${cardCount} ${cardText}`
            if (pile.isSecret) {
                valueText += ' (secret)'
            }
            if (pile.showTopCard) {
                valueText += ' 👁️ (shows top)'
            }
            
            embed.addFields({
                name: `${secretBadge}${pile.name}`,
                value: valueText,
                inline: true
            })
        })

        await interaction.editReply({ embeds: [embed], ephemeral: true })
    }
}

module.exports = new PileList()
