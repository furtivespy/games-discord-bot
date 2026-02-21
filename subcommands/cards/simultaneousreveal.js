const GameHelper = require("../../modules/GlobalGameHelper");
const GameDB = require("../../db/anygame.js");
const { find, findIndex } = require("lodash");
const Formatter = require("../../modules/GameFormatter");

class SimultaneousReveal {
  async execute(interaction, client) {
    await interaction.deferReply();

    let gameData = await GameHelper.getGameData(client, interaction);

    if (gameData.isdeleted) {
      return interaction.editReply({
        content: `There is no game in this channel.`});
    }

    let player = find(gameData.players, { userId: interaction.user.id });
    if (!player) {
      return interaction.editReply({
        content: "You're not in this game!"});
    }

    let revealMessage = `**Simultaneous Play Results:**\n`;
    const cardsToReturnToHand = {}; // Moved declaration before the player loop
    const playedToPlayArea = gameData.playToPlayArea; // Define playedToPlayArea once before the loop

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

        // Move the played cards
        // const playedToPlayArea = gameData.playToPlayArea; // No longer define here
        let destinationMessagePart = playedToPlayArea ? "to their Play Area" : "to the Discard Pile";

        if (p.hands.simultaneous.length > 0) { // Check again in case it was cleared by an error
            p.hands.simultaneous.forEach((card) => {
                if (playedToPlayArea) {
                    if (!p.playArea) p.playArea = [];
                    p.playArea.push(card);
                } else {
                    let deck = find(gameData.decks, { name: card.origin });
                    if (deck && deck.piles && deck.piles.discard) {
                        deck.piles.discard.cards.push(card);
                    } else {
                        client.logger.log(`Error: Deck or discard pile not found for card origin '${card.origin}' in /cards simultaneousreveal for player ${p.userId}. Card '${card.name}' will be returned to their hand.`, 'error');
                        if (!cardsToReturnToHand[p.userId]) cardsToReturnToHand[p.userId] = [];
                        cardsToReturnToHand[p.userId].push(card);
                    }
                }
            });
            revealMessage += ` (played ${destinationMessagePart})`;
            p.hands.simultaneous = []; // Clear the simultaneous hand
        }

      } else { // End of if (p.hands.simultaneous?.length > 0)
        revealMessage += `\n**${name}:** No cards selected for simultaneous play`;
      }
    }

    // Add back any cards that failed to discard
    for (const playerId in cardsToReturnToHand) {
        const playerToReturnTo = find(gameData.players, { userId: playerId });
        if (playerToReturnTo) {
            if (!playerToReturnTo.hands.main) playerToReturnTo.hands.main = []; // Should exist, but safety
            playerToReturnTo.hands.main.push(...cardsToReturnToHand[playerId]);
            // Announce this return in the reveal message or a follow-up
            const returnedCardNames = cardsToReturnToHand[playerId].map(c => Formatter.cardShortName(c)).join(', ');
            revealMessage += `\n*Note: ${interaction.guild.members.cache.get(playerId)?.displayName || playerId}'s card(s) (${returnedCardNames}) were returned to hand due to a discard error.*`;
        }
    }

    // Record history for simultaneous reveal (public action showing all revealed cards)
    try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        const participatingPlayers = []
        let totalCardsRevealed = 0
        
        // Count participants and total cards
        for (const p of gameData.players) {
            if (p.hands.simultaneous?.length > 0) {
                const displayName = interaction.guild.members.cache.get(p.userId)?.displayName || p.name || p.userId
                const cardNames = p.hands.simultaneous.map(card => Formatter.cardShortName(card))
                participatingPlayers.push({
                    userId: p.userId,
                    displayName: displayName,
                    cardCount: p.hands.simultaneous.length,
                    cardNames: cardNames // Public action, so card names are OK
                })
                totalCardsRevealed += p.hands.simultaneous.length
            }
        }
        
        GameHelper.recordMove(
            gameData,
            interaction.user,
            GameDB.ACTION_CATEGORIES.CARD,
            GameDB.ACTION_TYPES.REVEAL,
            `${actorDisplayName} revealed simultaneous plays: ${participatingPlayers.length} players, ${totalCardsRevealed} cards`,
            {
                participatingPlayers: participatingPlayers,
                totalCardsRevealed: totalCardsRevealed,
                playersParticipating: participatingPlayers.length,
                playedToPlayArea: playedToPlayArea,
                action: "simultaneous card reveal"
            }
        )
    } catch (error) {
        console.warn('Failed to record simultaneous reveal in history:', error)
    }

    // Save the updated game data
    await client.setGameDataV2(
      interaction.guildId,
      "game",
      interaction.channelId,
      gameData
    );

    // Main reveal summary
    if (revealMessage.length > 2000) revealMessage = revealMessage.substring(0, 1997) + "...";
    await interaction.editReply({
      content: revealMessage});

    // Follow-up with Play Area statuses if cards went there
    if (playedToPlayArea) {
        for (const p of gameData.players) {
            // Check if this player actually had cards moved to their play area in this reveal
            // This requires knowing which players had cards in p.hands.simultaneous initially
            // For simplicity, we'll just show play area if it's not empty and playToPlayArea was true.
            // A more precise check would involve tracking players who had cards in simultaneous before clearing.
            // However, genericCardZoneDisplay handles empty play areas gracefully.
            if (p.playArea && p.playArea.length > 0) {
                 const member = interaction.guild.members.cache.get(p.userId);
                 const playerName = member ? member.displayName : (p.name || `Player ${p.userId}`);
                 const { EmbedBuilder } = require('discord.js');
                 const playAreaEmbed = new EmbedBuilder()
                    .setColor(p.color || 13502711)
                    .setTitle(`${playerName}'s Updated Play Area`);

                const playAreaAttachment = await Formatter.genericCardZoneDisplay(
                    p.playArea,
                    playAreaEmbed,
                    "Current Cards in Play Area",
                    `PlayAreaSimultaneous-${p.userId}`
                );

                const followupOptions = { embeds: [playAreaEmbed]}; // Public status
                if (playAreaAttachment) {
                    followupOptions.files = [playAreaAttachment];
                }
                if (playAreaEmbed.data.fields && playAreaEmbed.data.fields.length > 0) { // Only send if there's content
                    await interaction.followUp(followupOptions);
                }
            }
        }
    }
  }
}

module.exports = new SimultaneousReveal();
