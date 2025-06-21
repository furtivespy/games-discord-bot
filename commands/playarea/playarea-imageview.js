const Command = require('../../base/Command.js');
const GlobalGameHelper = require('../../modules/GlobalGameHelper.js');
const { EmbedBuilder } = require('discord.js');
const { find, some } = require('lodash');
// const GameFormatter = require('../../modules/GameFormatter.js'); // For card names if title/footer needed

class PlayAreaImageView extends Command {
    constructor(client) {
        super(client, {
            name: "playarea-imageview",
            description: "Displays images of cards in players' play areas.",
            category: "Game Commands",
            usage: "playarea-imageview [optional: @player or player name]",
            guildOnly: true,
            aliases: ["paimage", "paimages", "showplayimages"],
            permLevel: "User"
        });
    }

    async run(message, args, level) {
        try {
            const gameData = await GlobalGameHelper.getGameData(this.client, message);
            if (gameData.isdeleted) {
                return message.reply("No active game found in this channel.");
            }

            let playersToView = [];
            const mentionedUser = message.mentions.users.first();
            const argStr = args.join(" ").toLowerCase();

            if (mentionedUser) {
                const targetPlayer = find(gameData.players, { userId: mentionedUser.id });
                if (!targetPlayer) return message.reply(`User ${mentionedUser.username} is not in the current game.`);
                playersToView.push(targetPlayer);
            } else if (args.length > 0) {
                const targetPlayer = find(gameData.players, p => p.name && p.name.toLowerCase().includes(argStr));
                if (targetPlayer) {
                    playersToView.push(targetPlayer);
                } else {
                    const member = message.guild.members.cache.find(m => m.displayName.toLowerCase().includes(argStr) || m.user.username.toLowerCase().includes(argStr));
                    if (member) {
                        const foundPlayer = find(gameData.players, { userId: member.id });
                        if (foundPlayer) playersToView.push(foundPlayer);
                    }
                }
                if (playersToView.length === 0) return message.reply(`Could not find player matching "${args.join(" ")}" in the current game.`);
            } else {
                // Default to all players if no specific player is mentioned
                playersToView = gameData.players.filter(p => p.playArea && p.playArea.length > 0);
                if (playersToView.length === 0) return message.reply("No players have cards in their play area to display, or no game is active.");
            }

            let imagesSent = 0;
            for (const player of playersToView) {
                const member = await message.guild.members.fetch(player.userId).catch(() => null);
                const playerName = member ? member.displayName : player.name || `Player ${player.userId}`;

                if (!player.playArea || player.playArea.length === 0) {
                    // Send a message if viewing a specific player and they have no cards.
                    // If viewing all, just skip them silently unless no one has cards (handled above).
                    if (mentionedUser || args.length > 0) {
                        message.channel.send(`${playerName} has no cards in their play area.`);
                    }
                    continue;
                }

                const cardsWithImages = player.playArea.filter(card => card.url || card.fileName);
                if (cardsWithImages.length === 0) {
                    if (mentionedUser || args.length > 0 || playersToView.length === 1) {
                         message.channel.send(`${playerName} has cards in their play area, but none of them have images specified.`);
                    }
                    continue;
                }

                message.channel.send(`**${playerName}'s Play Area Images:**`);
                for (const card of cardsWithImages) {
                    const imageUrl = card.url || card.fileName; // Prefer 'url', fallback to 'fileName'
                    const cardName = card.name || "Card Image";
                    const embed = new EmbedBuilder()
                        .setTitle(cardName)
                        .setImage(imageUrl)
                        .setColor(386945) // Consistent color
                        .setFooter({text: `Card from ${playerName}'s play area.`});
                    await message.channel.send({ embeds: [embed] });
                    imagesSent++;
                }
            }

            if (imagesSent === 0 && !(mentionedUser || args.length > 0)) {
                // This case means we iterated all players and none had image cards
                message.channel.send("No players have cards with images in their play areas.");
            } else if (imagesSent > 0) {
                // Confirmation that images were sent, especially if it was a general request
                // message.channel.send("Finished displaying play area images.");
            }


        } catch (e) {
            this.client.logger.log(e, 'error');
            message.reply("An error occurred while trying to display play area images.");
        }
    }
}

module.exports = PlayAreaImageView;
