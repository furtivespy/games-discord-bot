const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame');
const GameHelper = require('../../modules/GlobalGameHelper');
const { find } = require('lodash');

class Modify {
    static async execute(interaction, client) {
        const gameData = Object.assign(
            {},
            GameDB.defaultGameData,
            await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
        );

        if (gameData.isdeleted) {
            return await interaction.reply({ content: "No game in progress!", flags: MessageFlags.Ephemeral });
        }

        if (!gameData.tokens || !gameData.tokens.length) {
            return await interaction.reply({ content: "No tokens exist in this game to modify!", flags: MessageFlags.Ephemeral });
        }

        const tokenNameToModify = interaction.options.getString('name');
        const token = find(gameData.tokens, { name: tokenNameToModify });

        if (!token) {
            return await interaction.reply({ content: `Token "${tokenNameToModify}" not found!`, flags: MessageFlags.Ephemeral });
        }

        const newNameOpt = interaction.options.getString('new_name');
        // For description, we need to check if it was actually provided, as null means "not provided"
        // and an empty string "" means "set description to empty".
        // getString('description', false) won't work as it defaults to null if not required.
        // We need a way to differentiate "not set" from "set to empty".
        // The options object directly might give more info, or check subcommand options.
        // For now, let's assume if it's not null, it was provided.
        const descriptionOpt = interaction.options.getString('description'); // May be null or string
        const secretOpt = interaction.options.getBoolean('secret'); // May be null or boolean
        const capOpt = interaction.options.getInteger('cap'); // May be null or number
        const removeCapOpt = interaction.options.getBoolean('remove_cap'); // May be null or boolean

        let changesMade = [];
        const originalTokenForComparison = JSON.parse(JSON.stringify(token)); // Deep copy for comparison

        // 1. New Name
        if (newNameOpt !== null && newNameOpt !== token.name) {
            if (find(gameData.tokens, t => t.name === newNameOpt && t.id !== token.id)) {
                return await interaction.reply({ content: `Another token named "${newNameOpt}" already exists! Cannot rename.`, flags: MessageFlags.Ephemeral });
            }
            token.name = newNameOpt;
            changesMade.push(`Name changed from "${originalTokenForComparison.name}" to "${newNameOpt}"`);
        }

        // 2. Description
        // Check if description option was explicitly passed by the user
        // descriptionOpt will be null if not provided, or a string (including empty) if provided
        if (descriptionOpt !== null && descriptionOpt !== (token.description || "")) {
            token.description = descriptionOpt; // Can be empty string if user wants to clear it
            changesMade.push(`Description updated to "${token.description}"`);
        }


        // 3. Secret Status
        if (secretOpt !== null && secretOpt !== token.isSecret) {
            token.isSecret = secretOpt;
            changesMade.push(`Secret status set to ${secretOpt}`);
        }

        // 4. Remove Cap (takes precedence over setting cap)
        if (removeCapOpt === true) {
            if (token.cap !== null) {
                token.cap = null;
                changesMade.push("Cap removed");
            }
        }
        // 5. Cap (only if remove_cap was not true)
        else if (capOpt !== null && capOpt !== token.cap) {
            let totalTokensHeldByAllPlayers = 0;
            gameData.players.forEach(p => {
                if (p.tokens && p.tokens[token.id]) {
                    totalTokensHeldByAllPlayers += p.tokens[token.id];
                }
            });

            if (capOpt < totalTokensHeldByAllPlayers) {
                return await interaction.reply({
                    content: `Cannot set cap to ${capOpt}. This is lower than the current amount in circulation (${totalTokensHeldByAllPlayers}).`,
                    flags: MessageFlags.Ephemeral
                });
            }
            token.cap = capOpt;
            changesMade.push(`Cap set to ${capOpt}`);
        }

        if (changesMade.length === 0) {
            return await interaction.reply({ content: "No changes specified, or provided values match current token settings.", flags: MessageFlags.Ephemeral });
        }

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.TOKEN,
                GameDB.ACTION_TYPES.MODIFY,
                `${actorDisplayName} modified token "${originalTokenForComparison.name}": ${changesMade.join(', ')}`,
                {
                    tokenId: token.id,
                    tokenName: originalTokenForComparison.name,
                    changes: changesMade,
                    originalData: originalTokenForComparison,
                    newName: token.name,
                    newDescription: token.description,
                    newSecret: token.isSecret,
                    newCap: token.cap
                }
            )
        } catch (error) {
            console.warn('Failed to record token modification in history:', error)
        }

        await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData);

        return await interaction.reply({
            content: `Token "${originalTokenForComparison.name}" successfully modified:\n- ${changesMade.join("\n- ")}`});
    }
}

module.exports = Modify;
