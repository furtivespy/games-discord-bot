const { MessageFlags } = require("discord.js");
const GameDB = require("../../db/anygame.js");
const { cloneDeep, find } = require("lodash");
const Formatter = require("../../modules/GameFormatter");
const GameHelper = require("../../modules/GlobalGameHelper");

class Take {
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
        content: `There is no game in this channel.`});
      return;
    }

    let player = find(gameData.players, {userId: interaction.user.id})
    if (!player){
        await interaction.editReply({ content: "You're not in this game!"})
        return
    }

    const whatToTake = interaction.options.getInteger('amount')

    if (whatToTake < 1) {
        await interaction.editReply({ content: "You can't take less than $1!"})
        return
    }
    if (!player.money) { player.money = 0 }
    const oldBalance = player.money
    player.money += whatToTake

    // Record history
    try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        
        GameHelper.recordMove(
            gameData,
            interaction.user,
            GameDB.ACTION_CATEGORIES.MONEY,
            GameDB.ACTION_TYPES.TAKE,
            `${actorDisplayName} took $${whatToTake} from the bank`,
            {
                amount: whatToTake,
                playerUserId: player.userId,
                playerUsername: actorDisplayName,
                oldBalance: oldBalance,
                newBalance: player.money
            }
        )
    } catch (error) {
        console.warn('Failed to record money take in history:', error)
    }

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

    await interaction.editReply({content: `${interaction.member.displayName} took $${whatToTake}`})
    await interaction.followUp({content: `You now have $${player.money || "0"} in the bank.`, flags: MessageFlags.Ephemeral })
  }
}

module.exports = new Take();
