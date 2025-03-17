const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const Formatter = require("../../modules/GameFormatter");

class Pay {
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

    let fromPlayer = find(gameData.players, {userId: interaction.user.id})
    let toPlayer = find(gameData.players, {userId: interaction.options.getUser('player').id})
    if (!fromPlayer || !toPlayer){
        await interaction.editReply({ content: "Someone involved in this transaction is not in this game", ephemeral: true })
        return
    }
    if (!fromPlayer.money) { fromPlayer.money = 0 }
    if (!toPlayer.money) { toPlayer.money = 0 }

    const whatToSpend = interaction.options.getInteger('amount')

    if (whatToSpend < 1) {
        await interaction.editReply({ content: "You can't pay less than $1!", ephemeral: true })
        return
    }
    if (fromPlayer.money < whatToSpend) {
        await interaction.editReply({ content: "You don't have enough money!", ephemeral: true })
        return
    }
    
    fromPlayer.money -= whatToSpend
    toPlayer.money += whatToSpend
    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

    await interaction.editReply({content: `${interaction.member.displayName} pays $${whatToSpend} to ${interaction.options.getUser('player')}`})
    await interaction.followUp({content: `You now have $${fromPlayer.money || "0"} in the bank.`, ephemeral: true })
  }
}

module.exports = new Pay();
