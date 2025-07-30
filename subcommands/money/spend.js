const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const Formatter = require("../../modules/GameFormatter");
const GameHelper = require("../../modules/GlobalGameHelper");

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
    
    const oldBalance = player.money
    player.money -= whatToSpend

    // Record history
    try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        
        GameHelper.recordMove(
            gameData,
            interaction.user,
            GameDB.ACTION_CATEGORIES.MONEY,
            GameDB.ACTION_TYPES.SPEND,
            `${actorDisplayName} spent $${whatToSpend}`,
            {
                amount: whatToSpend,
                playerUserId: player.userId,
                playerUsername: actorDisplayName,
                oldBalance: oldBalance,
                newBalance: player.money
            }
        )
    } catch (error) {
        console.warn('Failed to record money spend in history:', error)
    }

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

    await interaction.editReply({content: `${interaction.member.displayName} spent $${whatToSpend}`})
    await interaction.followUp({content: `You now have $${player.money || "0"} in the bank.`, ephemeral: true })
  }
}

module.exports = new Spend();
