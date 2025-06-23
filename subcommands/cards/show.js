const GameHelper = require('../../modules/GlobalGameHelper')
const { find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Show {
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true })
        
        let gameData = await GameHelper.getGameData(client, interaction)

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true })
            return
        }

        let player = find(gameData.players, {userId: interaction.user.id})
        if (!player){
            await interaction.editReply({ content: "I don't think you're playing this game...", ephemeral: true })
            return
        }

        var handInfo = await Formatter.playerSecretHandAndImages(gameData, player)

        // Add Play Area information
        const playAreaText = Formatter.formatPlayAreaText(player);
        if (playAreaText && handInfo.embeds && handInfo.embeds.length > 0) {
            const mainEmbed = handInfo.embeds[0]; // Assuming the first embed is the primary one for hand info

            // Check existing description length; if playAreaText is too long, it might need its own embed or careful truncation.
            // For now, adding as a new field is safest. Max field value is 1024.
            let playAreaFieldValue = playAreaText;
            if (playAreaFieldValue.startsWith("**Play Area:**\n")) { // Remove the title if already present, as field name will be 'Play Area'
                playAreaFieldValue = playAreaFieldValue.substring("**Play Area:**\n".length);
            }
            if (playAreaFieldValue.length > 1024) {
                playAreaFieldValue = playAreaFieldValue.substring(0, 1021) + "...";
            }

            if (playAreaFieldValue.trim() !== "") { // Ensure there's content after potential title removal
                 // Add as a new field if there's no "Play Area" field yet, otherwise append.
                const existingPlayAreaField = mainEmbed.data.fields ? mainEmbed.data.fields.find(f => f.name === 'Play Area') : null;
                if (existingPlayAreaField) {
                    // This case should ideally not happen if playerSecretHandAndImages doesn't add it.
                    // If it could, we might want to append to existingPlayAreaField.value
                } else {
                    mainEmbed.addFields({ name: 'Play Area', value: playAreaFieldValue });
                }
            }
        } else if (playAreaText && (!handInfo.embeds || handInfo.embeds.length === 0)) {
            // If playerSecretHandAndImages returned no embeds (e.g. hand is empty), but play area has cards.
            const { EmbedBuilder } = require('discord.js');
            const playAreaEmbed = new EmbedBuilder()
                .setColor(13502711) // Consistent color
                .setTitle("Your Play Area")
                .setDescription(playAreaText.substring(0,4090)) // Max description length
            handInfo.embeds = [playAreaEmbed]; // Initialize embeds array
        }


        if (handInfo.attachments.length >0){
            await interaction.editReply({ 
                embeds: handInfo.embeds, // Use potentially modified embeds array
                files: [...handInfo.attachments],
                ephemeral: true
            })  
        } else {
            await interaction.editReply({ 
                embeds: handInfo.embeds, // Use potentially modified embeds array
                ephemeral: true
            })  
        }
    }
}

module.exports = new Show()