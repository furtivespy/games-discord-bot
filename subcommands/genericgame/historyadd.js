const { nanoid } = require('nanoid')
const GameDB = require('../../db/anygame')
const GameHelper = require('../../modules/GlobalGameHelper')

class HistoryAdd {
    async execute(interaction, client) {
        try {
            await interaction.deferReply()
            
            const gameData = await GameHelper.getGameData(client, interaction)

            if (gameData.isdeleted) {
                return await interaction.editReply({ 
                    content: "No active game found in this channel. Start a new game first!", 
                    ephemeral: true 
                })
            }

            const text = interaction.options.getString('text')
            
            if (!text || text.trim().length === 0) {
                return await interaction.editReply({
                    content: "Please provide some text for the history entry.",
                    ephemeral: true
                })
            }

            if (text.length > 200) {
                return await interaction.editReply({
                    content: "History entry text must be 200 characters or less.",
                    ephemeral: true
                })
            }

            // Record the manual entry
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.GAME,
                    GameDB.ACTION_TYPES.NOTE, // Custom action type for manual entries
                    `${actorDisplayName}: ${text.trim()}`,
                    {
                        isManualEntry: true,
                        originalText: text.trim()
                    }
                )
            } catch (error) {
                console.warn('Failed to record manual history entry:', error)
                return await interaction.editReply({
                    content: "Failed to add history entry. Please try again.",
                    ephemeral: true
                })
            }

            // Save game data
            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

            await interaction.editReply({
                content: `✅ Added to history: "${text.trim()}"`,
                ephemeral: false
            })

        } catch (error) {
            console.error('Error in history add command:', error)
            
            const errorMessage = error.message?.includes('game') ? 
                'Unable to access game data. Please try again.' :
                'An unexpected error occurred. Please try again.'
                
            await interaction.editReply({
                content: errorMessage,
                ephemeral: true
            })
        }
    }
}

module.exports = new HistoryAdd() 