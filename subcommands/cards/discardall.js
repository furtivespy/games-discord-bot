const {SlashCommandBuilder, MessageFlags} = require('discord.js');
const GameHelper = require('../../modules/GlobalGameHelper');
const GameStatusHelper = require('../../modules/GameStatusHelper');
const GameDB = require('../../db/anygame.js');
const { find } = require('lodash');

class DiscardAll {
  constructor() {
    this.data = new SlashCommandBuilder()
      .setName('discardall')
      .setDescription('Discards all cards from your hand.');
  }

  async execute(interaction, client) {
    const deferPromise = interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const [, gameData] = await Promise.all([
        deferPromise,
        GameHelper.getGameData(client, interaction)
      ]);

      if (gameData.isdeleted) {
        await interaction.editReply({ content: `There is no game in this channel.`});
        return;
      }

      let player = find(gameData.players, { userId: interaction.user.id });

      if (!player) {
        await interaction.editReply({ content: "Something went wrong, I couldn't find you in the game."});
        return;
      }

      const playerHand = player.hands.main;
      if (!playerHand || playerHand.length === 0) {
        await interaction.editReply({ content: "Your hand is already empty."});
        return;
      }

      const discardedCount = playerHand.length;

      for (const card of playerHand) {
        const deck = find(gameData.decks, { name: card.origin });
        if (deck) {
          if (!deck.piles.discard) {
            deck.piles.discard = { cards: [] };
          }
          deck.piles.discard.cards.push(card);
        }
      }

      player.hands.main = [];

      try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username;
        GameHelper.recordMove(
          gameData,
          interaction.user,
          GameDB.ACTION_CATEGORIES.CARD,
          GameDB.ACTION_TYPES.DISCARD,
          `${actorDisplayName} discarded all ${discardedCount} cards from hand`,
          { cardCount: discardedCount }
        );
      } catch (error) {
        console.warn('Failed to record discard all in history:', error);
      }

      // Save the game data after the primary action (discarding).
      await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

      // Private confirmation and public status update target independent sends
      // (editReply vs. channel.send), so they can run concurrently.
      await Promise.all([
        interaction.editReply({
          content: `You have discarded all ${discardedCount} cards from your hand. Your hand is now empty.`}),
        GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
          content: `${interaction.member.displayName} has discarded all ${discardedCount} cards from their hand.`
        })
      ]);

    } catch (e) {
      console.error(e);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "An error occurred. Check logs.", flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        await interaction.editReply({ content: "An error occurred. Check logs."}).catch(() => {});
      }
      if (client.logger) {
        client.logger.log(e, 'error');
      }
    }
  }
}

module.exports = new DiscardAll();