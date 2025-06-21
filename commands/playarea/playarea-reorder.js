const Command = require('../../base/Command.js');
const GlobalGameHelper = require('../../modules/GlobalGameHelper.js');
const { find } = require('lodash');
// const GameFormatter = require('../../modules/GameFormatter.js'); // For displaying card names

class PlayAreaReorder extends Command {
    constructor(client) {
        super(client, {
            name: "playarea-reorder",
            description: "Reorders a card in your play area.",
            category: "Game Commands",
            usage: "playarea-reorder <current position> <new position>",
            guildOnly: true,
            aliases: ["pareorder", "reorderplay"],
            permLevel: "User"
        });
    }

    async run(message, args, level) {
        try {
            const gameData = await GlobalGameHelper.getGameData(this.client, message);
            if (gameData.isdeleted) {
                return message.reply("No active game found in this channel.");
            }

            const player = find(gameData.players, { userId: message.author.id });
            if (!player) {
                return message.reply("You don't seem to be a player in the current game.");
            }

            if (!player.playArea || player.playArea.length === 0) {
                return message.reply("Your play area is currently empty. Nothing to reorder.");
            }

            if (args.length < 2) {
                return message.reply(`Usage: ${this.help.usage}`);
            }

            const currentPos = parseInt(args[0], 10);
            const newPos = parseInt(args[1], 10);

            if (isNaN(currentPos) || isNaN(newPos)) {
                return message.reply("Both current and new positions must be numbers.");
            }

            // Adjust to 0-based index for arrays
            const currentIndex = currentPos - 1;
            const newIndex = newPos - 1;

            if (currentIndex < 0 || currentIndex >= player.playArea.length) {
                return message.reply(`Invalid current position. Must be between 1 and ${player.playArea.length}.`);
            }
            if (newIndex < 0 || newIndex > player.playArea.length) { // newIndex can be equal to length to move to end
                return message.reply(`Invalid new position. Must be between 1 and ${player.playArea.length +1}.`);
            }

            const [cardToMove] = player.playArea.splice(currentIndex, 1);
            player.playArea.splice(newIndex, 0, cardToMove);

            await this.client.setGameDataV2(message.guildId, 'game', message.channelId, gameData);

            let replyMessage = `Moved card '${cardToMove.name}' from position ${currentPos} to ${newPos} in your play area.\nYour new play area order:\n`;
            player.playArea.forEach((card, index) => {
                // Using card.name, assuming it exists. Replace with GameFormatter.cardShortName(card) if available and preferred
                replyMessage += `${index + 1}. ${card.name}\n`;
            });

            // Send potentially long message to DM or use pagination if it's too much for a channel reply
            if (replyMessage.length > 1900) { // Discord message limit is 2000
                message.reply(`Successfully reordered the card. Your play area has been updated.`);
                message.author.send(replyMessage);
            } else {
                message.reply(replyMessage);
            }

        } catch (e) {
            this.client.logger.log(e, 'error');
            message.reply("An error occurred while trying to reorder cards in your play area.");
        }
    }
}

module.exports = PlayAreaReorder;
