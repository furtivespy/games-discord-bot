const { find } = require('lodash')
const { EmbedBuilder } = require('discord.js')
const GameDB = require('../../db/anygame')
const GameHelper = require('../../modules/GlobalGameHelper')

class History {
    constructor() {
        this.PAGE_SIZE = 15
        this.MAX_PAGE = 100 // Reasonable upper limit
    }

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
            
            console.log('DEBUG History Command:')
            console.log('- Original history length:', gameData.history?.length || 0)
            console.log('- Filtered history length:', filteredHistory?.length || 0)
            console.log('- PAGE_SIZE:', this.PAGE_SIZE)

            if (filteredHistory.length === 0) {
                return await interaction.editReply({ 
                    content: this.getNoResultsMessage(categoryFilter, playerFilter, interaction), 
                    ephemeral: true 
                })
            }

            // Validate page bounds against filtered results
            const totalPages = Math.ceil(filteredHistory.length / this.PAGE_SIZE)
            console.log('- Total pages calculated:', totalPages)
            if (page > totalPages) {
                return await interaction.editReply({
                    content: `Page ${page} doesn't exist. This game has ${totalPages} page${totalPages !== 1 ? 's' : ''} of history.`,
                    ephemeral: true
                })
            }

            // Paginate
            const startIndex = (page - 1) * this.PAGE_SIZE
            const pageEntries = filteredHistory.slice(startIndex, startIndex + this.PAGE_SIZE)
            console.log('- Page entries length:', pageEntries?.length || 0)

            // Format entries with error handling
            const formattedEntries = this.formatHistoryEntries(pageEntries)
            console.log('- Formatted entries length:', formattedEntries?.length || 0)
            console.log('- First formatted entry:', formattedEntries?.[0] || 'None')

            // Validate embed content
            let description = formattedEntries.join('\n')
            console.log('- Joined description length:', description?.length || 0)
            console.log('- Joined description preview:', description?.substring(0, 100) || 'Empty')
            
            // Discord embed description must not be empty and max 4096 characters
            if (!description || description.trim().length === 0) {
                console.log('- Using fallback: No history entries to display')
                description = '*No history entries to display*'
            } else if (description.length > 4096) {
                // Truncate and add indicator
                console.log('- Truncating description (too long)')
                description = description.substring(0, 4090) + '...\n*[Truncated]*'
            }

            const footerText = this.getFooterText(filteredHistory.length, categoryFilter, playerFilter, interaction)
            
            // Validate footer text (max 2048 characters)
            const validFooterText = footerText.length > 2048 ? 
                footerText.substring(0, 2045) + '...' : footerText

            // Create embed
            const embed = new EmbedBuilder()
                .setTitle(`📜 Game History - Page ${page}/${totalPages}`)
                .setDescription(description)
                .setColor(0x5865F2)
                .setFooter({ text: validFooterText })

            await interaction.editReply({ embeds: [embed] })

        } catch (error) {
            client.logger.log(`Error in history command: ${error.message}`, 'error')
            await interaction.editReply({
                content: "An error occurred while retrieving game history. Please try again.",
                ephemeral: true
            })
        }
    }

    validatePage(page) {
        if (page < 1) return 1
        if (page > this.MAX_PAGE) return this.MAX_PAGE
        return page
    }

    filterAndSortHistory(history, categoryFilter, playerFilter) {
        // Ensure history is a valid array
        if (!Array.isArray(history)) {
            console.warn('filterAndSortHistory received non-array history:', history)
            return []
        }

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

    formatHistoryEntries(entries) {
        // Ensure entries is a valid array
        if (!Array.isArray(entries)) {
            console.warn('formatHistoryEntries received non-array:', entries)
            return ['⚡ `--:--` [Invalid entries data]']
        }

        return entries.map(entry => {
            try {
                // Additional validation for entry structure
                if (!entry || typeof entry !== 'object') {
                    return `⚡ \`--:--\` [Malformed entry]`
                }

                const timestamp = entry.timestamp ? 
                    new Date(entry.timestamp).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit'
                    }) : '--:--'
                
                const emoji = this.getCategoryEmoji(entry.action?.category)
                const summary = entry.summary || '[No summary available]'
                
                return `${emoji} \`${timestamp}\` ${summary}`
            } catch (error) {
                console.warn('Error formatting history entry:', error, entry)
                return `⚡ \`--:--\` [Error displaying this entry]`
            }
        })
    }

    getCategoryEmoji(category) {
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

    getNoResultsMessage(categoryFilter, playerFilter, interaction) {
        if (categoryFilter && playerFilter) {
            const playerDisplayName = interaction.guild.members.cache.get(playerFilter.id)?.displayName || playerFilter.username
            return `No ${categoryFilter} actions found for ${playerDisplayName}.`
        } else if (categoryFilter) {
            return `No ${categoryFilter} actions found in this game's history.`
        } else if (playerFilter) {
            const playerDisplayName = interaction.guild.members.cache.get(playerFilter.id)?.displayName || playerFilter.username
            return `No actions found for ${playerDisplayName} in this game.`
        } else {
            return "No history entries found."
        }
    }

    getFooterText(totalEntries, categoryFilter, playerFilter, interaction) {
        let text = `${totalEntries} total event${totalEntries !== 1 ? 's' : ''}`
        if (categoryFilter) {
            text += ` | Category: ${categoryFilter}`
        }
        if (playerFilter && playerFilter.username) {
            const playerDisplayName = interaction.guild.members.cache.get(playerFilter.id)?.displayName || playerFilter.username
            text += ` | Player: ${playerDisplayName}`
        }
        return text
    }
}

module.exports = new History() 