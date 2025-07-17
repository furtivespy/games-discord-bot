const { find } = require('lodash')
const { EmbedBuilder } = require('discord.js')
const GameDB = require('../../db/anygame')
const GameHelper = require('../../modules/GlobalGameHelper')

class History {
    static PAGE_SIZE = 15
    static MAX_PAGE = 100 // Reasonable upper limit

    static async execute(interaction, client) {
        try {
            await interaction.deferReply()
            
            const gameData = await GameHelper.getGameData(client, interaction)

            if (gameData.isdeleted) {
                return await interaction.editReply({ 
                    content: "No active game found in this channel. Start a new game first!", 
                    ephemeral: true 
                })
            }

            if (!gameData.history || gameData.history.length === 0) {
                return await interaction.editReply({ 
                    content: "No history available yet. Game actions will be recorded here as players take turns!", 
                    ephemeral: true 
                })
            }

            // Get and validate filter options
            const page = this.validatePage(interaction.options.getInteger('page') || 1)
            const categoryFilter = interaction.options.getString('category')
            const playerFilter = interaction.options.getUser('player')
            
            // Filter history with error resilience
            let filteredHistory = this.filterAndSortHistory(gameData.history, categoryFilter, playerFilter)

            if (filteredHistory.length === 0) {
                return await interaction.editReply({ 
                    content: this.getNoResultsMessage(categoryFilter, playerFilter), 
                    ephemeral: true 
                })
            }

            // Validate page bounds against filtered results
            const totalPages = Math.ceil(filteredHistory.length / this.PAGE_SIZE)
            if (page > totalPages) {
                return await interaction.editReply({
                    content: `Page ${page} doesn't exist. This game has ${totalPages} page${totalPages !== 1 ? 's' : ''} of history.`,
                    ephemeral: true
                })
            }

            // Paginate
            const startIndex = (page - 1) * this.PAGE_SIZE
            const pageEntries = filteredHistory.slice(startIndex, startIndex + this.PAGE_SIZE)

            // Format entries with error handling
            const formattedEntries = this.formatHistoryEntries(pageEntries)

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle(`📜 Game History - Page ${page}/${totalPages}`)
                .setDescription(formattedEntries.join('\n'))
                .setColor(0x5865F2)
                .setFooter({ 
                    text: this.getFooterText(filteredHistory.length, categoryFilter, playerFilter)
                })

            await interaction.editReply({ embeds: [embed] })

        } catch (error) {
            client.logger.log(`Error in history command: ${error.message}`, 'error')
            await interaction.editReply({
                content: "An error occurred while retrieving game history. Please try again.",
                ephemeral: true
            })
        }
    }

    static validatePage(page) {
        if (page < 1) return 1
        if (page > this.MAX_PAGE) return this.MAX_PAGE
        return page
    }

    static filterAndSortHistory(history, categoryFilter, playerFilter) {
        return history
            .filter(entry => {
                // Skip malformed entries
                if (!entry || !entry.action || !entry.actor || !entry.summary) {
                    console.warn('Skipping malformed history entry:', entry)
                    return false
                }
                return true
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .filter(entry => {
                if (categoryFilter && entry.action.category !== categoryFilter) return false
                if (playerFilter && entry.actor.userId !== playerFilter.id) return false
                return true
            })
    }

    static formatHistoryEntries(entries) {
        return entries.map(entry => {
            try {
                const timestamp = new Date(entry.timestamp).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit'
                })
                const emoji = this.getCategoryEmoji(entry.action.category)
                return `${emoji} \`${timestamp}\` ${entry.summary}`
            } catch (error) {
                console.warn('Error formatting history entry:', error, entry)
                return `⚡ \`--:--\` [Error displaying this entry]`
            }
        })
    }

    static getCategoryEmoji(category) {
        const emojiMap = {
            [GameDB.ACTION_CATEGORIES.CARD]: '🃏',
            [GameDB.ACTION_CATEGORIES.PLAYER]: '👥', 
            [GameDB.ACTION_CATEGORIES.TOKEN]: '🪙',
            [GameDB.ACTION_CATEGORIES.MONEY]: '💰',
            [GameDB.ACTION_CATEGORIES.GAME]: '🎮',
            [GameDB.ACTION_CATEGORIES.SECRET]: '🤫'
        }
        return emojiMap[category] || '⚡'
    }

    static getNoResultsMessage(categoryFilter, playerFilter) {
        if (categoryFilter && playerFilter) {
            return `No ${categoryFilter} actions found for ${playerFilter.username}.`
        } else if (categoryFilter) {
            return `No ${categoryFilter} actions found in this game's history.`
        } else if (playerFilter) {
            return `No actions found for ${playerFilter.username} in this game.`
        } else {
            return "No history entries found with the specified filters."
        }
    }

    static getFooterText(totalEntries, categoryFilter, playerFilter) {
        let text = `${totalEntries} total event${totalEntries !== 1 ? 's' : ''}`
        
        if (categoryFilter) text += ` | Category: ${categoryFilter}`
        if (playerFilter) text += ` | Player: ${playerFilter.username}`
        
        return text
    }
}

module.exports = new History() 