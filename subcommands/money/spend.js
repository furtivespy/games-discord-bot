const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const Formatter = require("../../modules/GameFormatter");

class Spend {
  async execute(interaction, client) {
    await interaction.deferReply();
    
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

    let player = find(gameData.players, {userId: interaction.user.id})
    if (!player){
        await interaction.editReply({ content: "You're not in this game!", ephemeral: true })
        return
    }
    if (!player.money) { player.money = 0 }

    const whatToSpend = interaction.options.getInteger('amount')

    if (whatToSpend < 1) {
        await interaction.editReply({ content: "You can't spend less than $1!", ephemeral: true })
        return
    }
    if (player.money < whatToSpend) {
        await interaction.editReply({ content: "You don't have enough money!", ephemeral: true })
        return
    }
    
    player.money -= whatToSpend
    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

    await interaction.editReply({content: `${interaction.member.displayName} spent $${whatToSpend}`})
    await interaction.followUp({content: `You now have $${player.money || "0"} in the bank.`, ephemeral: true })
  }
}

module.exports = new Spend();
