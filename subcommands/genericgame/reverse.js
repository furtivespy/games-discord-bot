const GameHelper = require('../../modules/GlobalGameHelper')
const Formatter = require('../../modules/GameFormatter')

class Reverse {
  async execute(interaction, client) {
    let gameData = await GameHelper.getGameData(client, interaction)

    if (gameData.isdeleted) {
      await interaction.reply({
        content: `No game in progress`,
        ephemeral: true
      })
      return
    }

    await interaction.deferReply()

    gameData.reverseOrder = !gameData.reverseOrder

    await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)

    const data = await Formatter.GameStatusV2(gameData, interaction.guild);
      await interaction.editReply({
        content: `Game order reversed: ${gameData.reverseOrder ? 'Yes' : 'No'}`,
        embeds: [...Formatter.deckStatus2(gameData)],
        files: [...data],
      });

  }
}

module.exports = new Reverse()
