const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");

class Give {
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

    let fromPlayer = find(gameData.players, {userId: interaction.user.id});
    let toPlayer = find(gameData.players, {userId: interaction.options.getUser('player').id});
    
    // Validate players
    if (!fromPlayer || !toPlayer) {
      await interaction.reply({ 
        content: "Both players must be in this game!", 
        ephemeral: true 
      });
      return;
    }

    if (fromPlayer.userId === toPlayer.userId) {
      await interaction.reply({
        content: "You can't give tokens to yourself!",
        ephemeral: true
      });
      return;
    }

    const tokenName = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount');
    
    // Validate amount
    if (amount < 1) {
      await interaction.reply({
        content: "You must give at least 1 token!",
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

    // Initialize token counts if needed
    if (!fromPlayer.tokens[token.id]) {
      fromPlayer.tokens[token.id] = { count: 0, isHidden: token.isSecret };
    }
    if (!toPlayer.tokens[token.id]) {
      toPlayer.tokens[token.id] = { count: 0, isHidden: token.isSecret };
    }

    // Check if player has enough tokens
    if (fromPlayer.tokens[token.id].count < amount) {
      await interaction.reply({
        content: `You don't have enough ${token.name} tokens! You only have ${fromPlayer.tokens[token.id].count}.`,
        ephemeral: true
      });
      return;
    }

    // Update token counts
    fromPlayer.tokens[token.id].count -= amount;
    toPlayer.tokens[token.id].count += amount;

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

    // Send appropriate responses based on token visibility
    if (token.isSecret) {
      // For secret tokens, send private messages to both players
      await interaction.reply({
        content: `You gave ${amount} ${token.name} token${amount !== 1 ? 's' : ''} to ${interaction.options.getUser('player').username}. You now have ${fromPlayer.tokens[token.id].count}.`,
        ephemeral: true
      });
      
      try {
        await interaction.followUp({
          content: `${interaction.user.username} gave you ${amount} ${token.name} token${amount !== 1 ? 's' : ''}. You now have ${toPlayer.tokens[token.id].count}.`,
          ephemeral: true,
          users: [toPlayer.userId]
        });
      } catch (error) {
        // If we can't send a direct message, at least notify the giver
        await interaction.followUp({
          content: `Note: Could not send notification to ${interaction.options.getUser('player').username}.`,
          ephemeral: true
        });
      }
    } else {
      // For public tokens, announce the transfer
      await interaction.reply({
        content: `${interaction.member.displayName} gave ${amount} ${token.name} token${amount !== 1 ? 's' : ''} to ${interaction.options.getUser('player').username}.`
      });
      await interaction.followUp({
        content: `You now have ${fromPlayer.tokens[token.id].count} ${token.name} token${fromPlayer.tokens[token.id].count !== 1 ? 's' : ''}.`,
        ephemeral: true
      });
      try {
        await interaction.followUp({
          content: `You now have ${toPlayer.tokens[token.id].count} ${token.name} token${toPlayer.tokens[token.id].count !== 1 ? 's' : ''}.`,
          ephemeral: true,
          users: [toPlayer.userId]
        });
      } catch (error) {
        // Silently handle failure to notify recipient
      }
    }
  }
}

module.exports = new Give(); 