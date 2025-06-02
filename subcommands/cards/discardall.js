const { SlashCommandBuilder } = require('discord.js');
const GameHelper = require('../../modules/GlobalGameHelper');
const Formatter = require('../../modules/GameFormatter');
const { find, findIndex } = require('lodash');

class DiscardAll {
  constructor() {
    this.data = new SlashCommandBuilder()
      .setName('discardall')
      .setDescription('Discards all cards from your hand.');
  }

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
      let gameData = await GameHelper.getGameData(client, interaction);

      if (gameData.isdeleted) {
        await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true });
        return;
      }

      let player = find(gameData.players, { userId: interaction.user.id });

      if (!player) {
        await interaction.editReply({ content: "Something went wrong, I couldn't find you in the game.", ephemeral: true });
        return;
      }

      const playerHand = player.hands.main;

      if (!playerHand || playerHand.length === 0) {
        await interaction.editReply({ content: "Your hand is already empty.", ephemeral: true });
        return;
      }

      const discardedCount = playerHand.length;

      for (const card of playerHand) {
        const deck = find(gameData.decks, { name: card.origin });
        if (deck) {
          if (!deck.piles.discard) { // Ensure discard pile exists
            deck.piles.discard = { cards: [] };
          }
          deck.piles.discard.cards.push(card);
        }
        // If deck is not found, card effectively disappears, which is acceptable for discard.
      }

      player.hands.main = [];

      await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

      // 1. Send the ephemeral confirmation to the user who typed the command.
      // This uses the editReply on the initially deferred ephemeral reply.
      await interaction.editReply({
          content: `You have discarded all ${discardedCount} cards from your hand. Your hand is now empty.`,
          ephemeral: true
      });

      // 2. Prepare and send the public message to the channel.
      // This will be a new followup message, set to be non-ephemeral.
      const publicMessagePayload = await Formatter.createGameStatusReply(gameData, interaction.guild, {
          content: `${interaction.member.displayName} has discarded all ${discardedCount} cards from their hand.`
      });

      // Check if publicMessagePayload is an object with content/embeds or just a string
      if (publicMessagePayload && (publicMessagePayload.content || publicMessagePayload.embeds)) {
          await interaction.followUp({
              content: publicMessagePayload.content,
              embeds: publicMessagePayload.embeds,
              files: publicMessagePayload.files, // Include files if present in payload
              ephemeral: false // Make this message public
          });
      } else if (publicMessagePayload) {
          // Fallback if Formatter.createGameStatusReply returns a simple string
          await interaction.followUp({
              content: String(publicMessagePayload), // Ensure it's a string
              ephemeral: false // Make this message public
          });
      } else {
          // Fallback if payload is unexpectedly empty, still send a basic public message
          await interaction.followUp({
              content: `${interaction.member.displayName} has discarded all ${discardedCount} cards from their hand. (Status update formatting error)`,
              ephemeral: false
          });
      }

    } catch (e) {
      console.error(e);
      // Ensure a reply is sent even if an error occurs
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "An error occurred while trying to discard all cards. Check the logs.", ephemeral: true }).catch(() => {}); // catch potential error if interaction is already gone
      } else {
        await interaction.reply({ content: "An error occurred while trying to discard all cards. Check the logs.", ephemeral: true }).catch(() => {});
      }
      // It's good practice to log the error to your logging system (e.g., client.logger.error(e) if available)
      if (client.logger) {
        client.logger.log(e, 'error');
      }
    }
  }
}

module.exports = new DiscardAll();
