const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");

class Lose {
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
    const amount = interaction.options.getInteger('amount');
    
    // Validate amount
    if (amount < 1) {
      await interaction.reply({
        content: "You must lose at least 1 token!",
        ephemeral: true
      });
      return;
    }

    // Find token
    const token = gameData.tokens.find(t => t.name.toLowerCase() === tokenName.toLowerCase());
    if (!token) {
      await interaction.reply({
        content: `Token "${tokenName}" not found!`,
        ephemeral: true
      });
      return;
    }

    // Initialize token count if needed
    if (!player.tokens[token.id]) {
      player.tokens[token.id] = { count: 0, isHidden: token.isSecret };
    }

    // Check if player has enough tokens
    if (player.tokens[token.id].count < amount) {
      await interaction.reply({
        content: `You don't have enough ${token.name} tokens! You only have ${player.tokens[token.id].count}.`,
        ephemeral: true
      });
      return;
    }

    // Update token count
    player.tokens[token.id].count -= amount;

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

    // Send appropriate response based on token visibility
    if (token.isSecret) {
      await interaction.reply({
        content: `You lost ${amount} ${token.name} token${amount !== 1 ? 's' : ''}. You now have ${player.tokens[token.id].count}.`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: `${interaction.member.displayName} lost ${amount} ${token.name} token${amount !== 1 ? 's' : ''}.`
      });
      await interaction.followUp({
        content: `You now have ${player.tokens[token.id].count} ${token.name} token${player.tokens[token.id].count !== 1 ? 's' : ''}.`,
        ephemeral: true
      });
    }
  }
}

module.exports = new Lose(); 