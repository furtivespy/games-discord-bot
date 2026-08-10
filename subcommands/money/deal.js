const GameDB = require("../../db/anygame.js");
const { cloneDeep } = require("lodash");
const GameHelper = require("../../modules/GlobalGameHelper");

class Deal {
  async execute(interaction, client) {
    const [, rawGameData] = await Promise.all([
      interaction.deferReply(),
      client.getGameDataV2(interaction.guildId, "game", interaction.channelId)
    ]);
    const gameData = Object.assign({}, cloneDeep(GameDB.defaultGameData), rawGameData);

    if (gameData.isdeleted) {
      await interaction.editReply({ content: "There is no game in this channel." });
      return;
    }

    const amount = interaction.options.getInteger("amount");
    if (amount < 1) {
      await interaction.editReply({ content: "You can't deal less than $1!" });
      return;
    }

    if (!gameData.players?.length) {
      await interaction.editReply({ content: "There are no players in this game." });
      return;
    }

    for (const player of gameData.players) {
      player.money = (player.money || 0) + amount;
    }

    try {
      const actorDisplayName = interaction.member?.displayName || interaction.user.username;

      GameHelper.recordMove(
        gameData,
        interaction.user,
        GameDB.ACTION_CATEGORIES.MONEY,
        GameDB.ACTION_TYPES.DEAL,
        `${actorDisplayName} dealt $${amount} to ${gameData.players.length} players`,
        {
          amount,
          playerCount: gameData.players.length
        }
      );
    } catch (error) {
      console.warn("Failed to record money deal in history:", error);
    }

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
    await interaction.editReply({
      content: `Dealt $${amount} to ${gameData.players.length} players.`
    });
  }
}

module.exports = new Deal();
