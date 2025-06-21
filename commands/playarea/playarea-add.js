const Command = require('../../base/Command.js');
const GlobalGameHelper = require('../../modules/GlobalGameHelper.js');
const CardsAssistant = require('../../modules/CardsAssistant.js');
const { find, findIndex } = require('lodash');

class PlayAreaAdd extends Command {
    constructor(client) {
        super(client, {
            name: "playarea-add",
            description: "Adds a card from your hand to your play area.",
            category: "Game Commands",
            usage: "playarea-add [optional: deck name]",
            guildOnly: true,
            aliases: ["paadd", "addtoplay"],
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

            if (!player.hands || Object.keys(player.hands).length === 0) {
                return message.reply("You don't have any hands to select cards from.");
            }

            let handToUse;
            const deckNameArg = args.join(" ");

            if (player.hands.main && player.hands.main.cards.length > 0 && (!deckNameArg || player.hands.main.deck.toLowerCase() === deckNameArg.toLowerCase())) {
                handToUse = player.hands.main;
            } else if (deckNameArg) {
                handToUse = find(player.hands, hand => hand.deck.toLowerCase() === deckNameArg.toLowerCase());
            } else if (Object.keys(player.hands).length === 1) {
                handToUse = player.hands[Object.keys(player.hands)[0]];
            } else {
                 // If multiple hands and no specific deck name, or main hand is not suitable, prompt
                const chosenHandDeck = await CardsAssistant.ChooseDeck(player, message, "Add to Play Area");
                if (!chosenHandDeck) return; // User cancelled or timed out
                handToUse = chosenHandDeck;
            }

            if (!handToUse || handToUse.cards.length === 0) {
                return message.author.send("The selected hand is empty or could not be found.");
            }

            const cardToAdd = await CardsAssistant.ChooseCard(player, handToUse, message, "Add to Play Area");
            if (!cardToAdd) {
                // ChooseCard handles timeout message
                return;
            }

            // Remove card from hand
            const cardIndex = findIndex(handToUse.cards, { id: cardToAdd.id });
            if (cardIndex === -1) {
                // Should not happen if ChooseCard worked correctly
                return message.author.send("Error finding the selected card in your hand.");
            }
            const [movedCard] = handToUse.cards.splice(cardIndex, 1);

            // Add to play area
            if (!player.playArea) {
                player.playArea = [];
            }
            player.playArea.push(movedCard);

            await this.client.setGameDataV2(message.guildId, 'game', message.channelId, gameData);
            message.reply(`Moved '${movedCard.name}' from your hand to your play area.`);
            // Optionally send DM confirmation with card details if too verbose for channel
            // message.author.send(`You added ${GameFormatter.cardShortName(movedCard)} to your play area.`);

        } catch (e) {
            this.client.logger.log(e, 'error');
            message.reply("An error occurred while trying to add a card to your play area.");
        }
    }
}

module.exports = PlayAreaAdd;
