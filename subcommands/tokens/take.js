const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");

class Take {
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

    let toPlayer = find(gameData.players, {userId: interaction.user.id});
    let fromPlayer = find(gameData.players, {userId: interaction.options.getUser('player').id});
    
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
        content: "You can't take tokens from yourself!",
        ephemeral: true
      });
      return;
    }

    const tokenName = interaction.options.getString('name');
    const amount = interaction.options.getInteger('amount');
    
    // Validate amount
    if (amount < 1) {
      await interaction.reply({
        content: "You must take at least 1 token!",
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

    // Check if target player has enough tokens
    if (fromPlayer.tokens[token.id].count < amount) {
      await interaction.reply({
        content: `${interaction.options.getUser('player').username} doesn't have enough ${token.name} tokens! They only have ${fromPlayer.tokens[token.id].count}.`,
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
        content: `You took ${amount} ${token.name} token${amount !== 1 ? 's' : ''} from ${interaction.options.getUser('player').username}. You now have ${toPlayer.tokens[token.id].count}.`,
        ephemeral: true
      });
      
      try {
        await interaction.followUp({
          content: `${interaction.user.username} took ${amount} ${token.name} token${amount !== 1 ? 's' : ''} from you. You now have ${fromPlayer.tokens[token.id].count}.`,
          ephemeral: true,
          users: [fromPlayer.userId]
        });
      } catch (error) {
        // If we can't send a direct message, at least notify the taker
        await interaction.followUp({
          content: `Note: Could not send notification to ${interaction.options.getUser('player').username}.`,
          ephemeral: true
        });
      }
    } else {
      // For public tokens, announce the transfer
      await interaction.reply({
        content: `${interaction.member.displayName} took ${amount} ${token.name} token${amount !== 1 ? 's' : ''} from ${interaction.options.getUser('player').username}.`
      });
      await interaction.followUp({
        content: `You now have ${toPlayer.tokens[token.id].count} ${token.name} token${toPlayer.tokens[token.id].count !== 1 ? 's' : ''}.`,
        ephemeral: true
      });
      try {
        await interaction.followUp({
          content: `You now have ${fromPlayer.tokens[token.id].count} ${token.name} token${fromPlayer.tokens[token.id].count !== 1 ? 's' : ''}.`,
          ephemeral: true,
          users: [fromPlayer.userId]
        });
      } catch (error) {
        // Silently handle failure to notify target
      }
    }
  }
}

module.exports = new Take(); 