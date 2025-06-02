const GameHelper = require("../../modules/GlobalGameHelper");
const Formatter = require("../../modules/GameFormatter");
const { find } = require("lodash");

class FirstPlayer {
  async execute(interaction, client) {
    try {
      const newFirstPlayer = interaction.options.getUser("player");
      if (!newFirstPlayer) {
        return interaction.reply({
          content: "Please mention a player to set as first player.",
          ephemeral: true,
        });
      }

      let gameData = await GameHelper.getGameData(client, interaction);

      if (!gameData || !gameData.players) {
        return interaction.reply({
          content: "No game happening in this channel.",
          ephemeral: true,
        });
      }

      const player = gameData.players.find(
        (p) => p.userId === newFirstPlayer.id
      );
      if (!player) {
        return interaction.reply({
          content: "That player is not in the game.",
          ephemeral: true,
        });
      }

      // Adjust player order
      const newFirstPlayerOrder = player.order;

      gameData.players.forEach((p) => {
        let newOrder = p.order - newFirstPlayerOrder;
        if (newOrder < 0) {
          newOrder += gameData.players.length;
        }
        p.order = newOrder;
      });

      // Save the updated game data
      await client.setGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId,
        gameData
      );

      await interaction.reply(
        await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id, {
          content: `${newFirstPlayer} is now the first player.`
        })
      );
    } catch (e) {
      client.logger.error(e, __filename.slice(__dirname.length + 1));
      await interaction.reply({
        content: "An error occurred while setting the first player.",
        ephemeral: true,
      });
    }
  }
}

module.exports = new FirstPlayer();
