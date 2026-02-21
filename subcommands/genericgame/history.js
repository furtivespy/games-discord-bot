const { find } = require('lodash')
const { EmbedBuilder } = require('discord.js')
const GameDB = require('../../db/anygame')
const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')

class History {
    constructor() {
        this.PAGE_SIZE = 25
        this.MAX_PAGE = 25 // Reasonable upper limit
    }

    async execute(interaction, client) {
        try {
            await interaction.deferReply()
            
            const gameData = await GameHelper.getGameData(client, interaction)

            if (gameData.isdeleted) {
                return await interaction.editReply({ 
                    content: "No active game found in this channel. Start a new game first!"})
            }

            if (!gameData.history || gameData.history.length === 0) {
                return await interaction.editReply({ 
                    content: "No history available yet. Game actions will be recorded here as players take turns!"})
            }

            // Get and validate filter options
            const page = this.validatePage(interaction.options.getInteger('page') || 1)
            const categoryFilter = interaction.options.getString('category')
            const playerFilter = interaction.options.getUser('player')
            
            // Filter history with error resilience
            let filteredHistory = this.filterAndSortHistory(gameData.history, categoryFilter, playerFilter)

            if (filteredHistory.length === 0) {
                return await interaction.editReply({ 
                    content: this.getNoResultsMessage(categoryFilter, playerFilter, interaction)})
            }

            // Validate page bounds against filtered results
            const totalPages = Math.ceil(filteredHistory.length / this.PAGE_SIZE)
            if (page > totalPages) {
                return await interaction.editReply({
                    content: `Page ${page} doesn't exist. This game has ${totalPages} page${totalPages !== 1 ? 's' : ''} of history.`})
            }

            // Paginate
            const startIndex = (page - 1) * this.PAGE_SIZE
            const pageEntries = filteredHistory.slice(startIndex, startIndex + this.PAGE_SIZE)
            
            // Reverse the page entries so newest appears at bottom (while keeping page 1 = most recent entries)
            const reversedPageEntries = pageEntries.reverse()

            // Use centralized formatter for consistency 
            const tempGameData = { history: reversedPageEntries }
            const historyEmbed = Formatter.createHistoryEmbed(tempGameData, {
                title: `📜 Game History - Page ${page}/${totalPages}`,
                limit: this.PAGE_SIZE
            })

            if (!historyEmbed) {
                await interaction.editReply({ 
                    content: "No history entries to display for this page."})
                return
            }

            // Add pagination info to footer
            const footerText = this.getFooterText(filteredHistory.length, categoryFilter, playerFilter, interaction)
            const validFooterText = footerText.length > 2048 ? 
                footerText.substring(0, 2045) + '...' : footerText
            
            historyEmbed.setFooter({ text: validFooterText })

            await interaction.editReply({ embeds: [historyEmbed] })

        } catch (error) {
            client.logger.log(`Error in history command: ${error.message}`, 'error')
            await interaction.editReply({
                content: "An error occurred while retrieving game history. Please try again."})
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