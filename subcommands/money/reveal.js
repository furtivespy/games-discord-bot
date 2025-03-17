const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const Formatter = require("../../modules/GameFormatter");

class Reveal {
  async execute(interaction, client) {
    await interaction.deferReply();
    
    if (interaction.options.getString("confirm") == "reveal") {
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
        await interaction.editReply({
          content: `There is no game in this channel.`,
          ephemeral: true,
        });
        return;
      }

      const moneies = gameData.players.map(
        (p) => `- ${interaction.guild.members.cache.get(p.userId)?.displayName || p.name} has $${p.money || 0}`).join("\n");
      await interaction.editReply({content: `Here's the money:\n${moneies}`})

    } else {
      await interaction.editReply({ content: `Nothing revealed...`, ephemeral: true })
    }
  }
}

module.exports = new Reveal();
