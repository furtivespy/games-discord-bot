const GameHelper = require("../../modules/GlobalGameHelper");
const GameDB = require("../../db/anygame.js");
const Formatter = require("../../modules/GameFormatter");
const { find } = require("lodash");

class First {
  async execute(interaction, client) {
    await interaction.deferReply();
    try {
      const newFirstPlayer = interaction.options.getUser("player");
      if (!newFirstPlayer) {
        return interaction.editReply({
          content: "Please mention a player to set as first player.",
          ephemeral: true,
        });
      }

      let gameData = await GameHelper.getGameData(client, interaction);

      if (!gameData || !gameData.players) {
        return interaction.editReply({
          content: "No game happening in this channel.",
          ephemeral: true,
        });
      }

      const player = gameData.players.find(
        (p) => p.userId === newFirstPlayer.id
      );
      if (!player) {
        return interaction.editReply({
          content: "That player is not in the game.",
          ephemeral: true,
        });
      }

      // Adjust player order
      const newFirstPlayerOrder = player.order;
      const oldFirstPlayer = gameData.players.find(p => p.order === 0)

      gameData.players.forEach((p) => {
        let newOrder = p.order - newFirstPlayerOrder;
        if (newOrder < 0) {
          newOrder += gameData.players.length;
        }
        p.order = newOrder;
      });

      // Record history for first player change
      try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        const newFirstPlayerName = interaction.guild.members.cache.get(newFirstPlayer.id)?.displayName || newFirstPlayer.username
        const oldFirstPlayerName = oldFirstPlayer ? (interaction.guild.members.cache.get(oldFirstPlayer.userId)?.displayName || oldFirstPlayer.name) : 'Unknown'
        
        GameHelper.recordMove(
          gameData,
          interaction.user,
          GameDB.ACTION_CATEGORIES.PLAYER,
          GameDB.ACTION_TYPES.MODIFY,
          `${actorDisplayName} set ${newFirstPlayerName} as the first player`,
          {
            newFirstUserId: newFirstPlayer.id,
            newFirstUsername: newFirstPlayerName,
            oldFirstUserId: oldFirstPlayer?.userId,
            oldFirstUsername: oldFirstPlayerName,
            actorUserId: interaction.user.id,
            actorUsername: actorDisplayName,
            playerCount: gameData.players.length
          }
        )
      } catch (error) {
        console.warn('Failed to record first player change in history:', error)
      }

      // Save the updated game data
      await client.setGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId,
        gameData
      );

      await interaction.editReply(
        await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id, {
          content: `${newFirstPlayer} is now the first player.`
        })
      );
    } catch (e) {
      client.logger.error(e, __filename.slice(__dirname.length + 1));
      await interaction.editReply({
        content: "An error occurred while setting the first player.",
        ephemeral: true,
      });
    }
  }
}

module.exports = new First();
