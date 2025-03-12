const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const { nanoid } = require("nanoid");

class Add {
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
    const isSecret = interaction.options.getBoolean('secret') ?? false;
    const description = interaction.options.getString('description') ?? '';

    // Check if token with same name exists
    if (gameData.tokens.some(t => t.name.toLowerCase() === tokenName.toLowerCase())) {
      await interaction.reply({
        content: `A token named "${tokenName}" already exists!`,
        ephemeral: true
      });
      return;
    }

    // Create new token
    const newToken = Object.assign({}, cloneDeep(GameDB.defaultToken), {
      id: nanoid(),
      name: tokenName,
      description: description,
      isSecret: isSecret,
      created: new Date().toISOString(),
      createdBy: interaction.user.id
    });

    // Add token to game
    gameData.tokens.push(newToken);

    // Initialize token counts for all players
    gameData.players.forEach(p => {
      if (!p.tokens) p.tokens = {};
      p.tokens[newToken.id] = { count: 0, isHidden: isSecret };
    });

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

    await interaction.reply({
      content: `Created new ${isSecret ? "secret " : ""}token: "${tokenName}"${description ? ` - ${description}` : ""}`,
    });
  }
}

module.exports = new Add(); 