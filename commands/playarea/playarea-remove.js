const Command = require('../../base/Command.js');
const GlobalGameHelper = require('../../modules/GlobalGameHelper.js');
const CardsAssistant = require('../../modules/CardsAssistant.js'); // Re-using for card selection UI
const { find, findIndex } = require('lodash');
// const GameFormatter = require('../../modules/GameFormatter.js'); // For detailed card names if needed

class PlayAreaRemove extends Command {
    constructor(client) {
        super(client, {
            name: "playarea-remove",
            description: "Removes a card from your play area and returns it to your hand.",
            category: "Game Commands",
            usage: "playarea-remove",
            guildOnly: true,
            aliases: ["paremove", "removefromplay"],
            permLevel: "User"
        });
    }

    async run(message, args, level) {
        try {
            const gameData = await GlobalGameHelper.getGameData(this.client, message);
            if (gameData.isdeleted) {
                return message.reply("No active game found in this channel.");
            }

            const player = find(gameData.players, { userId: message.author.id });
            if (!player) {
                return message.reply("You don't seem to be a player in the current game.");
            }

            if (!player.playArea || player.playArea.length === 0) {
                return message.reply("Your play area is currently empty.");
            }

            // Adapt ChooseCard or create a simpler version for playArea
            // For now, let's use a similar mechanism to CardsAssistant.ChooseCard but adapted for playArea
            const cardToRemove = await this.chooseCardFromPlayArea(player, message, "Remove from Play Area");

            if (!cardToRemove) {
                // Timeout or cancellation message handled by chooseCardFromPlayArea
                return;
            }

            // Remove card from playArea
            const cardIndex = findIndex(player.playArea, { id: cardToRemove.id });
            // This check should ideally be redundant if chooseCardFromPlayArea works correctly
            if (cardIndex === -1) {
                this.client.logger.log(`Error: Card ${cardToRemove.id} chosen but not found in play area for player ${player.userId}.`);
                return message.author.send("Error finding the selected card in your play area. This shouldn't happen.");
            }
            const [movedCard] = player.playArea.splice(cardIndex, 1);

            // Add to player's main hand (or a default hand if 'main' doesn't exist)
            // Ensure player.hands and player.hands.main exist
            if (!player.hands) {
                player.hands = {};
            }
            if (!player.hands.main) {
                // Find the deck this card originated from to correctly name the hand
                const originalDeck = find(gameData.decks, d => d.allCards.some(c => c.id === movedCard.originCardId || c.name === movedCard.originDeckName)); // This might need refinement
                // Fallback if original deck info isn't readily on the card object
                const handName = originalDeck ? originalDeck.name : "Hand";

                player.hands.main = { deck: handName, cards: [] }; // Assuming 'main' is the primary hand
            }
            player.hands.main.cards.push(movedCard);

            await this.client.setGameDataV2(message.guildId, 'game', message.channelId, gameData);
            message.reply(`Moved '${movedCard.name}' from your play area to your hand.`);
            // message.author.send(`You removed ${GameFormatter.cardShortName(movedCard)} from your play area. It's now in your hand.`);

        } catch (e) {
            this.client.logger.log(e, 'error');
            message.reply("An error occurred while trying to remove a card from your play area.");
        }
    }

    // Helper function similar to CardsAssistant.ChooseCard but for an array of cards (playArea)
    // This avoids making CardsAssistant.ChooseCard too complex if playArea isn't a "hand" object
    async chooseCardFromPlayArea(player, message, actionName, page = 0) {
        const cardsInPlayArea = player.playArea;
        const pageSize = 10; // Standard page size from CardsAssistant

        const { EmbedBuilder } = require("discord.js"); // Local require if not at top level
        const Emoji = require("../../modules/EmojiAssitant.js"); // Local require

        const playAreaEmbed = new EmbedBuilder()
            .setColor(13928716) // Consistent color
            .setTitle(`Select a Card To ${actionName} from your Play Area`);

        let cardListText = "";
        if (page > 0) {
            cardListText += `⏮️:arrow_right: (Previous Page)\n`;
        }

        const paginatedCards = cardsInPlayArea.slice(page * pageSize, (page + 1) * pageSize);

        for (let i = 0; i < paginatedCards.length; i++) {
            // Assuming card objects have a 'name' property. Adapt if using GameFormatter.cardShortName
            cardListText += `${Emoji.IndexToEmoji(i)}:arrow_right:  ${paginatedCards[i].name}\n`;
        }

        if (cardsInPlayArea.length > (page + 1) * pageSize) {
            cardListText += `⏭️:arrow_right: (Next Page)\n`;
        }
        if (!cardListText) { // Should be caught earlier but as a safeguard
            message.author.send("No cards to display in your play area for selection.");
            return undefined;
        }

        playAreaEmbed.setDescription(cardListText);
        let msg = await message.author.send({ embeds: [playAreaEmbed] });

        const reactions = [];
        if (page > 0) reactions.push("⏮️");
        for (let i = 0; i < paginatedCards.length; i++) reactions.push(Emoji.IndexToEmoji(i));
        if (cardsInPlayArea.length > (page + 1) * pageSize) reactions.push("⏭️");

        for (const reaction of reactions) {
            await msg.react(reaction);
        }

        try {
            var collectedReactions = await msg.awaitReactions({
                filter: (reaction, user) => user.id === player.userId && reactions.includes(reaction.emoji.name),
                max: 1,
                time: 60000, // 60 seconds
                errors: ['time']
            });
        } catch (e) {
            await msg.edit({ content: `No reaction after 60 seconds, ${actionName} canceled.`, embeds: [] });
            await msg.suppressEmbeds(true);
            return undefined;
        }

        const reaction = collectedReactions.first();
        if (!reaction) { // Should be caught by time error
            await msg.edit({ content: `No reaction after 60 seconds, ${actionName} canceled.`, embeds: [] });
            return undefined;
        }

        await msg.delete(); // Clean up the selection message

        if (reaction.emoji.name === "⏭️") {
            return await this.chooseCardFromPlayArea(player, message, actionName, page + 1);
        } else if (reaction.emoji.name === "⏮️") {
            return await this.chooseCardFromPlayArea(player, message, actionName, page - 1);
        }

        const selectedIndex = Emoji.EmojiToIndex(reaction.emoji.name);
        return paginatedCards[selectedIndex];
    }
}

module.exports = PlayAreaRemove;
