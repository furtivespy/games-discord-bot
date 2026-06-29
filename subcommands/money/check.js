const { MessageFlags } = require("discord.js");
const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const Formatter = require("../../modules/GameFormatter");

class Check {
  async execute(interaction, client) {
    const [, rawGameData] = await Promise.all([
      interaction.deferReply({ flags: MessageFlags.Ephemeral }),
      client.getGameDataV2(interaction.guildId, "game", interaction.channelId)
    ]);
    let gameData = Object.assign({}, cloneDeep(GameDB.defaultGameData), rawGameData);

    if (gameData.isdeleted) {
      await interaction.editReply({
        content: `There is no game in this channel.`});
      return;
    }

    let player = find(gameData.players, {userId: interaction.user.id})
    if (!player){
        await interaction.editReply({ content: "You're not in this game!"})
        return
    }

    await interaction.editReply({content: `You have $${player.money || "0"} in the bank.`})
  }
}

module.exports = new Check();
