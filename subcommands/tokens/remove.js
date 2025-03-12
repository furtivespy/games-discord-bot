const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");

class Remove {
  async execute(interaction, client) {
    let gameData = Object.assign(
      {},
      cloneDeep(GameDB.defaultGameData),
      await client.getGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId
      )
    );

    if (gameData.isdeleted) {
      await interaction.reply({
        content: `There is no game in this channel.`,
        ephemeral: true,
      });
      return;
    }

    let player = find(gameData.players, {userId: interaction.user.id});
    if (!player) {
      await interaction.reply({ 
        content: "You're not in this game!", 
        ephemeral: true 
      });
      return;
    }

    const tokenName = interaction.options.getString('name');
    
    // Find token
    const token = gameData.tokens.find(t => t.name.toLowerCase() === tokenName.toLowerCase());
    if (!token) {
      await interaction.reply({
        content: `Token "${tokenName}" not found!`,
        ephemeral: true
      });
      return;
    }

    // Check if user is creator or has permission
    if (token.createdBy !== interaction.user.id) {
      await interaction.reply({
        content: `Only the token creator can remove it!`,
        ephemeral: true
      });
      return;
    }

    // Remove token from game
    gameData.tokens = gameData.tokens.filter(t => t.id !== token.id);

    // Remove token counts from all players
    gameData.players.forEach(p => {
      if (p.tokens && p.tokens[token.id]) {
        delete p.tokens[token.id];
      }
    });

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

    await interaction.reply({
      content: `Removed token: "${token.name}"`,
    });
  }
}

module.exports = new Remove(); 