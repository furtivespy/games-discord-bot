const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const Formatter = require("../../modules/GameFormatter");

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

    let player = find(gameData.players, {userId: interaction.user.id})
    if (!player){
        await interaction.reply({ content: "You're not in this game!", ephemeral: true })
        return
    }


    const whatToTake = interaction.options.getInteger('amount')

    if (whatToTake < 1) {
        await interaction.reply({ content: "You can't take less than $1!", ephemeral: true })
        return
    }
    if (!player.money) { player.money = 0 }
    player.money += whatToTake
    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

    await interaction.reply({content: `${interaction.member.displayName} took $${whatToTake}`})
    await interaction.followUp({content: `You now have $${player.money || "0"} in the bank.`, ephemeral: true })
    
  }
}

module.exports = new Take();
