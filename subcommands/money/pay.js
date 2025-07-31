const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const Formatter = require("../../modules/GameFormatter");
const GameHelper = require("../../modules/GlobalGameHelper");

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
    
    const fromOldBalance = fromPlayer.money
    const toOldBalance = toPlayer.money
    fromPlayer.money -= whatToSpend
    toPlayer.money += whatToSpend

    // Record history
    try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        const targetDisplayName = interaction.guild.members.cache.get(toPlayer.userId)?.displayName || toPlayer.name || toPlayer.userId
        
        GameHelper.recordMove(
            gameData,
            interaction.user,
            GameDB.ACTION_CATEGORIES.MONEY,
            GameDB.ACTION_TYPES.PAY,
            `${actorDisplayName} paid $${whatToSpend} to ${targetDisplayName}`,
            {
                amount: whatToSpend,
                fromUserId: fromPlayer.userId,
                fromUsername: actorDisplayName,
                toUserId: toPlayer.userId,
                toUsername: targetDisplayName,
                fromOldBalance: fromOldBalance,
                fromNewBalance: fromPlayer.money,
                toOldBalance: toOldBalance,
                toNewBalance: toPlayer.money
            }
        )
    } catch (error) {
        console.warn('Failed to record money payment in history:', error)
    }

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

    await interaction.editReply({content: `${interaction.member.displayName} pays $${whatToSpend} to ${interaction.options.getUser('player')}`})
    await interaction.followUp({content: `You now have $${fromPlayer.money || "0"} in the bank.`, ephemeral: true })
  }
}

module.exports = new Pay();
