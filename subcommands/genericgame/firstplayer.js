const GameHelper = require("../../modules/GlobalGameHelper");
const GameStatusHelper = require("../../modules/GameStatusHelper");
const GameDB = require('../../db/anygame.js');
const { find } = require("lodash");

class FirstPlayer {
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

      if (gameData.isdeleted) {
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
      const oldOrders = gameData.players.map(p => ({ userId: p.userId, order: p.order }));

      gameData.players.forEach((p) => {
        let newOrder = p.order - newFirstPlayerOrder;
        if (newOrder < 0) {
          newOrder += gameData.players.length;
        }
        p.order = newOrder;
      });

      // Record history
      try {
          const actorDisplayName = interaction.member?.displayName || interaction.user.username;
          const newFirstName = interaction.guild.members.cache.get(newFirstPlayer.id)?.displayName || newFirstPlayer.username;

          GameHelper.recordMove(
              gameData,
              interaction.user,
              GameDB.ACTION_CATEGORIES.PLAYER,
              GameDB.ACTION_TYPES.MODIFY,
              `${actorDisplayName} set ${newFirstName} as the first player, re-ordering turns.`,
              {
                  newFirstPlayerId: newFirstPlayer.id,
                  newFirstPlayerName: newFirstName,
                  oldOrders: oldOrders
              }
          );
      } catch (error) {
          console.warn('Failed to record first player change in history:', error);
      }

      // Save the updated game data
      await client.setGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId,
        gameData
      );

      await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
        content: `${newFirstPlayer} is now the first player.`
      });

    } catch (e) {
      console.error(e);
      await interaction.editReply({
        content: "An error occurred while setting the first player.",
        ephemeral: true,
      }).catch(()=>{}); // Ignore error if interaction is no longer available
    }
  }
}

module.exports = new FirstPlayer();