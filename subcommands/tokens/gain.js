const { MessageFlags } = require("discord.js");
const { find } = require('lodash')
const GameDB = require('../../db/anygame')
const GameHelper = require('../../modules/GlobalGameHelper')

class Gain {
    static async execute(interaction, client) {
        const gameData = Object.assign(
            {},
            GameDB.defaultGameData,
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        )

        if (gameData.isdeleted) {
            return await interaction.reply({ content: "No game in progress!", flags: MessageFlags.Ephemeral })
        }

        const name = interaction.options.getString('name')
        const amount = interaction.options.getInteger('amount') || 1

        // Check if tokens exist
        if (!gameData.tokens || !gameData.tokens.length) {
            return await interaction.reply({ content: "No tokens exist in this game!", flags: MessageFlags.Ephemeral })
        }

        // Find the token
        const token = find(gameData.tokens, { name })
        if (!token) {
            return await interaction.reply({ content: `Token "${name}" not found!`, flags: MessageFlags.Ephemeral })
        }

        // Find the player
        const player = find(gameData.players, { userId: interaction.user.id })
        if (!player) {
            return await interaction.reply({ content: "You're not in this game!", flags: MessageFlags.Ephemeral })
        }

        const tokenCap = token.cap; // Assuming 'cap' was added in the previous step

        if (typeof tokenCap === 'number') {
            // Calculate total tokens of this type held by all players
            let totalTokensHeldByAllPlayers = 0;
            gameData.players.forEach(p => {
                if (p.tokens && p.tokens[token.id]) {
                    totalTokensHeldByAllPlayers += p.tokens[token.id];
                }
            });

            // Calculate available tokens
            const availableTokens = tokenCap - totalTokensHeldByAllPlayers;

            // Check if gain amount exceeds available tokens
            if (amount > availableTokens) {
                return await interaction.reply({
                    content: `Cannot gain ${amount} ${name} token(s). Doing so would exceed the cap of ${tokenCap}. Currently, ${totalTokensHeldByAllPlayers} are in circulation, so only ${availableTokens > 0 ? availableTokens : 0} more can be gained.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // Initialize tokens object if it doesn't exist
        if (!player.tokens) player.tokens = {}

        // Add tokens
        player.tokens[token.id] = (player.tokens[token.id] || 0) + amount

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            const currentCount = player.tokens[token.id] || 0
            const previousCount = currentCount - amount
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.TOKEN,
                GameDB.ACTION_TYPES.GAIN,
                `${actorDisplayName} gained ${amount} ${name} tokens`,
                {
                    tokenId: token.id,
                    tokenName: name,
                    amount: amount,
                    previousCount: previousCount,
                    newCount: currentCount
                }
            )
        } catch (error) {
            console.warn('Failed to record token gain in history:', error)
        }

        // Save game data
        await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData)

        // Get display name
        const displayName = interaction.guild.members.cache.get(player.userId)?.displayName ?? player.name ?? player.userId

        return await interaction.reply({ 
            content: `${displayName} gained ${amount} ${name} token(s)`})
    }
}

module.exports = Gain 