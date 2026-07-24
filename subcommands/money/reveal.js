const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const Formatter = require("../../modules/GameFormatter");

class Reveal {
  async execute(interaction, client) {
    const confirm = interaction.options.getString("confirm");

    if (confirm == "reveal") {
      const [, rawGameData] = await Promise.all([
        interaction.deferReply(),
        client.getGameDataV2(interaction.guildId, "game", interaction.channelId)
      ]);
      let gameData = Object.assign({}, cloneDeep(GameDB.defaultGameData), rawGameData);

      if (gameData.isdeleted) {
        await interaction.editReply({
          content: `There is no game in this channel.`});
        return;
      }

      const moneies = gameData.players.map(
        (p) => `- ${interaction.guild.members.cache.get(p.userId)?.displayName || p.name} has $${p.money || 0}`).join("\n");
      await interaction.editReply({content: `Here's the money:\n${moneies}`})

    } else {
      await interaction.deferReply();
      await interaction.editReply({ content: `Nothing revealed...`})
    }
  }
}

module.exports = new Reveal();
