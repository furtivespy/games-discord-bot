const GameHelper = require("../../modules/GlobalGameHelper");
const { find, findIndex } = require("lodash");
const Formatter = require("../../modules/GameFormatter");
const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require("discord.js");

class PlaySimultaneous {
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

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

    if (player.hands.simultaneous && player.hands.simultaneous.length > 0) {
      // Move cards from simultaneous back to main hand
      player.hands.simultaneous.forEach(card => {
        player.hands.main.push(card);
      });
      player.hands.simultaneous = [];
    }

    // Prompt the user to select cards
    if (player.hands.main.length < 1) {
      return interaction.editReply({
        content: "You have no cards in your hand to play.",
        ephemeral: true,
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("card")
      .setPlaceholder("Select cards to play simultaneously")
      .setMinValues(1)
      .setMaxValues(Math.min(player.hands.main.length, 15))
      .addOptions(
        Formatter.cardSort(player.hands.main)
          .slice(0, 25)
          .map((crd) => ({ label: Formatter.cardShortName(crd), value: crd.id }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    const CardsSelected = await interaction.editReply({
      content: `Choose cards to play simultaneously:`,
      components: [row],
      fetchReply: true,
    });

    const filter = (i) =>
      i.user.id === interaction.user.id && i.customId === "card";
    let playedCards = [];

    try {
      const collected = await CardsSelected.awaitMessageComponent({
        filter,
        time: 60000,
      });
      playedCards = collected.values;
    } catch (error) {
      return await interaction.editReply({
        content: "No cards selected, simultaneous play canceled.",
        components: [],
      });
    }

    if (playedCards.length < 1) {
      await interaction.editReply({
        content: "No cards selected, simultaneous play canceled.",
        components: [],
      });
      return;
    }

    // Store the selected cards in player.hands.simultaneous
    player.hands.simultaneous = [];
    playedCards.forEach((crd) => {
      let card = find(player.hands.main, { id: crd });
      if (!card) {
        return;
      }
      player.hands.simultaneous.push(card);
      player.hands.main.splice(findIndex(player.hands.main, { id: crd }), 1);
    });

    // Save the updated game data
    await client.setGameDataV2(
      interaction.guildId,
      "game",
      interaction.channelId,
      gameData
    );

    // Check if all players have made their selections
    const allPlayersSelected = gameData.players.every(p => 
      p.hands.simultaneous && p.hands.simultaneous.length > 0
    );

    // Send a public followup message to notify other players
    await interaction.followUp({
      content: allPlayersSelected 
        ? `${interaction.user} has selected their cards for simultaneous play! All players have now made their selections - time to reveal!`
        : `${interaction.user} has selected their cards for simultaneous play!`,
      ephemeral: false
    });

    await interaction.editReply({
      content: `You have selected your cards for simultaneous play. Waiting for the reveal.`,
      components: [],
    });

    // Show the player their current hand
    var handInfo = await Formatter.playerSecretHandAndImages(gameData, player);
    if (handInfo.attachments.length > 0) {
      await interaction.followUp({ 
        embeds: [...handInfo.embeds],
        files: [...handInfo.attachments],
        ephemeral: true
      });
    } else {
      await interaction.followUp({ 
        embeds: [...handInfo.embeds],
        ephemeral: true
      });
    }
  }
}

module.exports = new PlaySimultaneous();
