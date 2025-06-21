const Command = require('../../base/Command.js');
const GlobalGameHelper = require('../../modules/GlobalGameHelper.js');
const { EmbedBuilder } = require('discord.js');
const { find } = require('lodash');
// const GameFormatter = require('../../modules/GameFormatter.js'); // For consistent card formatting

class PlayAreaView extends Command {
    constructor(client) {
        super(client, {
            name: "playarea-view",
            description: "Displays a player's play area.",
            category: "Game Commands",
            usage: "playarea-view [optional: @player or player name]",
            guildOnly: true,
            aliases: ["paview", "viewplayarea", "showplay"],
            permLevel: "User"
        });
    }

    async run(message, args, level) {
        try {
            const gameData = await GlobalGameHelper.getGameData(this.client, message);
            if (gameData.isdeleted) {
                return message.reply("No active game found in this channel.");
            }

            let targetPlayer;
            const mentionedUser = message.mentions.users.first();
            const argStr = args.join(" ").toLowerCase();

            if (mentionedUser) {
                targetPlayer = find(gameData.players, { userId: mentionedUser.id });
                if (!targetPlayer) return message.reply(`User ${mentionedUser.username} is not in the current game.`);
            } else if (args.length > 0) {
                targetPlayer = find(gameData.players, p => p.name && p.name.toLowerCase().includes(argStr));
                if (!targetPlayer) {
                    // Try matching by Discord display name if available (requires fetching member)
                    const member = message.guild.members.cache.find(m => m.displayName.toLowerCase().includes(argStr) || m.user.username.toLowerCase().includes(argStr));
                    if (member) targetPlayer = find(gameData.players, { userId: member.id });
                }
                if (!targetPlayer) return message.reply(`Could not find player matching "${args.join(" ")}" in the current game.`);
            } else {
                targetPlayer = find(gameData.players, { userId: message.author.id });
                if (!targetPlayer) return message.reply("You don't seem to be a player in the current game. To view another player's area, mention them or use their game name.");
            }

            const member = await message.guild.members.fetch(targetPlayer.userId).catch(() => null);
            const playerName = member ? member.displayName : targetPlayer.name || `Player ${targetPlayer.userId}`;

            if (!targetPlayer.playArea || targetPlayer.playArea.length === 0) {
                return message.reply(`${playerName} currently has no cards in their play area.`);
            }

            const embed = new EmbedBuilder()
                .setColor(386945) // A neutral color
                .setTitle(`${playerName}'s Play Area`)
                .setTimestamp();

            let description = "";
            targetPlayer.playArea.forEach((card, index) => {
                // Using card.name for now. Replace with GameFormatter.cardShortName(card) or cardLongName if available and desired.
                const cardName = card.name || `Unnamed Card (ID: ${card.id})`;
                description += `${index + 1}. ${cardName}\n`;
            });

            if (description.length > 4096) { // Embed description limit
                description = description.substring(0, 4090) + "\n... (too many cards to display fully)";
            }
            embed.setDescription(description);

            // If viewing your own play area, send as DM to reduce channel spam for large play areas.
            // Otherwise, send to channel.
            if (targetPlayer.userId === message.author.id && description.length > 200) { // Arbitrary length for DM decision
                 try {
                    await message.author.send({ embeds: [embed] });
                    message.reply("I've sent your play area to you via DM.");
                } catch (dmError) {
                    message.reply({ embeds: [embed] }); // Fallback if DMs are closed
                }
            } else {
                message.channel.send({ embeds: [embed] });
            }

        } catch (e) {
            this.client.logger.log(e, 'error');
            message.reply("An error occurred while trying to view the play area.");
        }
    }
}

module.exports = PlayAreaView;
