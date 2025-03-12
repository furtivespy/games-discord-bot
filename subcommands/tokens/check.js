const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const { EmbedBuilder } = require('discord.js');

class Check {
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
    const showAll = interaction.options.getBoolean('all') ?? false;
    
    if (tokenName) {
      // Check specific token
      const token = gameData.tokens.find(t => t.name.toLowerCase() === tokenName.toLowerCase());
      if (!token) {
        await interaction.reply({
          content: `Token "${tokenName}" not found!`,
          ephemeral: true
        });
        return;
      }

      if (token.isSecret) {
        // For secret tokens, only show the player's own count
        const count = player.tokens[token.id]?.count ?? 0;
        await interaction.reply({
          content: `You have ${count} ${token.name} token${count !== 1 ? 's' : ''}.`,
          ephemeral: true
        });
      } else {
        // For public tokens, show all players' counts
        const counts = gameData.players.map(p => {
          const count = p.tokens[token.id]?.count ?? 0;
          return `${interaction.guild.members.cache.get(p.userId)?.displayName || p.name}: ${count}`;
        }).join('\n');
        
        await interaction.reply({
          content: `${token.name} token counts:\n${counts}`,
          ephemeral: !showAll
        });
      }
    } else {
      // Show all tokens
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Token Counts')
        .setTimestamp();

      // First show public tokens
      const publicTokens = gameData.tokens.filter(t => !t.isSecret);
      if (publicTokens.length > 0) {
        const publicCounts = publicTokens.map(token => {
          const count = player.tokens[token.id]?.count ?? 0;
          return `${token.name}: ${count}${token.description ? ` - ${token.description}` : ''}`;
        }).join('\n');
        
        if (publicCounts) {
          embed.addFields({ name: 'Public Tokens', value: publicCounts });
        }
      }

      // Then show secret tokens
      const secretTokens = gameData.tokens.filter(t => t.isSecret);
      if (secretTokens.length > 0) {
        const secretCounts = secretTokens.map(token => {
          const count = player.tokens[token.id]?.count ?? 0;
          return `${token.name}: ${count}${token.description ? ` - ${token.description}` : ''}`;
        }).join('\n');
        
        if (secretCounts) {
          embed.addFields({ name: 'Secret Tokens', value: secretCounts });
        }
      }

      if (publicTokens.length === 0 && secretTokens.length === 0) {
        await interaction.reply({
          content: 'No tokens have been created yet!',
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  }
}

module.exports = new Check(); 