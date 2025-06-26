const GameHelper = require('../../modules/GlobalGameHelper');
// No Formatter needed as we are not displaying card details

class Burn {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            let gameData = await GameHelper.getGameData(client, interaction);
            await GameHelper.getDeckAutocomplete(gameData, interaction);
            return;
        }

        await interaction.deferReply();

        let gameData = await GameHelper.getGameData(client, interaction);

        if (gameData.isdeleted) {
            await interaction.editReply({ content: `There is no game in this channel.`, ephemeral: true });
            return;
        }

        const inputDeck = interaction.options.getString('deck');
        const deck = GameHelper.getSpecificDeck(gameData, inputDeck, interaction.user.id);

        if (!deck) {
            await interaction.editReply({ content: "Specified deck not found or no default deck available.", ephemeral: true });
            return;
        }

        if (!deck.piles || !deck.piles.draw || deck.piles.draw.cards.length < 1) {
            await interaction.editReply({ content: `The draw pile for ${deck.name} is empty.`, ephemeral: true });
            return;
        }

        const countToBurn = interaction.options.getInteger('count');

        if (countToBurn <= 0) {
            await interaction.editReply({ content: "Number of cards to burn must be greater than 0.", ephemeral: true });
            return;
        }

        let actualBurnedCount = 0;
        for (let i = 0; i < countToBurn; i++) {
            if (deck.piles.draw.cards.length > 0) {
                const cardToBurn = deck.piles.draw.cards.shift();
                if (!deck.piles.discard) { // Should exist, but good practice
                    deck.piles.discard = { cards: [], viewable: true };
                }
                deck.piles.discard.cards.push(cardToBurn);
                actualBurnedCount++;
            } else {
                // Ran out of cards in the draw pile
                break;
            }
        }

        if (actualBurnedCount === 0) {
            // This case should ideally be caught by the initial draw pile check, but as a safeguard:
            await interaction.editReply({ content: `No cards were burned. The draw pile for ${deck.name} might be empty.`, ephemeral: true });
            return;
        }

        await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

        let replyMessage = `Burned ${actualBurnedCount} card(s) from the top of ${deck.name}.`;
        if (actualBurnedCount < countToBurn) {
            replyMessage += ` (Requested ${countToBurn}, but only ${actualBurnedCount} were available in the draw pile.)`;
        }

        await interaction.editReply({
            content: replyMessage
        });
    }
}

module.exports = new Burn();
