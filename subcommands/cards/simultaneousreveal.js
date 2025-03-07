const GameHelper = require("../../modules/GlobalGameHelper");
const { find, findIndex } = require("lodash");
const Formatter = require("../../modules/GameFormatter");

class SimultaneousReveal {
  async execute(interaction, client) {
    await interaction.deferReply();

    let gameData = await GameHelper.getGameData(client, interaction);

    if (gameData.isdeleted) {
      return interaction.editReply({
        content: `There is no game in this channel.`,
        ephemeral: true,
      });
    }

    let player = find(gameData.players, { userId: interaction.user.id });
    if (!player) {
      return interaction.editReply({
        content: "You're not in this game!",
        ephemeral: true,
      });
    }

    let revealMessage = `**Simultaneous Play Results:**\n`;

    for (const p of gameData.players) {
      const name =
          interaction.guild.members.cache.get(p.userId)?.displayName || p.name;
      if (p.hands.simultaneous?.length > 0) {
        
        const cardNames = p.hands.simultaneous.map((card) =>
          Formatter.cardShortName(card)
        );
        revealMessage += `\n**${name}:** ${cardNames.join(", ")}`;

        // Create the followup message before clearing the hand
        let followup = await Formatter.multiCard(
          p.hands.simultaneous,
          `Simultaneous Play - ${name}`
        );
        await interaction.channel.send({
          embeds: [...followup[0]],
          files: [...followup[1]],
        });

        // Move the played cards to the discard pile
        p.hands.simultaneous.forEach((card) => {
          let deck = find(gameData.decks, { name: card.origin });
          if (deck) {
            deck.piles.discard.cards.push(card);
          }
        });

        p.hands.simultaneous = []; // Clear the simultaneous hand
      } else {
        revealMessage += `\n**${name}:** No cards played`;
      }
    }

    // Save the updated game data
    await client.setGameDataV2(
      interaction.guildId,
      "game",
      interaction.channelId,
      gameData
    );

    await interaction.editReply({
      content: revealMessage,
    });
  }
}

module.exports = new SimultaneousReveal();
