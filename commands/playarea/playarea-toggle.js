const Command = require('../../base/Command.js');
const GlobalGameHelper = require('../../modules/GlobalGameHelper.js');

class PlayAreaToggle extends Command {
    constructor(client) {
        super(client, {
            name: "playarea-toggle",
            description: "Toggles whether cards are played to a personal play area or the common discard pile.",
            category: "Game Commands",
            usage: "playarea-toggle",
            guildOnly: true,
            aliases: ["patoggle"],
            permLevel: "User"
        });
    }

    async run(message, args, level) {
        try {
            const gameData = await GlobalGameHelper.getGameData(this.client, message);

            if (gameData.isdeleted) {
                return message.reply("No active game found in this channel. Start a new game first.");
            }

            // Toggle the setting
            gameData.playToPlayArea = !gameData.playToPlayArea;

            // Save the updated game data
            // Assuming client.setGameDataV2 is the correct method as seen in GlobalGameHelper
            await this.client.setGameDataV2(message.guildId, 'game', message.channelId, gameData);

            const status = gameData.playToPlayArea ? "ON (cards will go to Play Area)" : "OFF (cards will go to Discard Pile)";
            message.reply(`Play Area mode is now ${status}.`);

        } catch (e) {
            this.client.logger.log(e, 'error');
            message.reply("An error occurred while trying to toggle the play area setting.");
        }
    }
}

module.exports = PlayAreaToggle;
