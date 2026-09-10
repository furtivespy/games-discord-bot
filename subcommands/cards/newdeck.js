const GameHelper = require('../../modules/GlobalGameHelper')
const { find, cloneDeep, shuffle } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')
const GameDB = require("../../db/anygame.js")
const { materializeDeck, UNKNOWN_OR_DISABLED_CARD_SET } = require("../../db/catalogDecks.js")

class NewDeck {
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            await interaction.respond(
                GameHelper.getCardLists(interaction.options.getString("cardset"))
            );
            return
        }

        const [, gameData] = await Promise.all([
            interaction.deferReply(),
            GameHelper.getGameData(client, interaction)
        ])

        if (gameData.isdeleted) {
            await interaction.editReply({
                content: `Please use "/game newgame" command to create a game. I need a game in this channel to attach the deck to.`});
            return
        }

        const inputName = interaction.options.getString("name");
        const inputSet = interaction.options.getString("cardset");
        const inputCustom = interaction.options.getString("customlist");

        if (find(gameData.decks, { name: inputName })) {
            await interaction.editReply({
                content: `There is already a deck with that name...`});
            return;
        }
        if (inputSet == "custom-csv" && (!inputCustom || inputCustom.length == 0)) {
            await interaction.editReply({
                content: `When choosing a custom deck, please include the "customlist" of cards`});
            return;
        }

        let newdeck = Object.assign({}, GameDB.defaultDeck, {
            name: inputName,
        });

        let cardSetDisplay = inputSet
        if (inputSet != "custom-csv" && inputSet != "customempty") {
            const materialized = materializeDeck(inputName, inputSet);
            if (!materialized.ok) {
                await interaction.editReply({
                    content: UNKNOWN_OR_DISABLED_CARD_SET});
                return;
            }
            newdeck.allCards = materialized.cards;
            cardSetDisplay = materialized.name;
        } else {
            if (inputSet == "customempty") {
                newdeck.allCards = [];
            } else {
                newdeck.allCards = GameDB.createCardFromStrList(inputName, inputCustom.split(',').map(card => card.trim()));
            }
        }

        newdeck.piles.draw.cards = cloneDeep(shuffle(newdeck.allCards));
        gameData.decks.push(newdeck);

        // Record history
        try {
            const actorDisplayName = interaction.member?.displayName || interaction.user.username
            const cardSetType = inputSet === "custom-csv" ? "custom CSV" : 
                               inputSet === "customempty" ? "empty deck" :
                               cardSetDisplay
            
            GameHelper.recordMove(
                gameData,
                interaction.user,
                GameDB.ACTION_CATEGORIES.CARD,
                GameDB.ACTION_TYPES.CREATE,
                `${actorDisplayName} created new deck "${inputName}" (${cardSetType}) with ${newdeck.allCards.length} cards`,
                {
                    deckName: inputName,
                    cardSetType: inputSet,
                    cardSetDisplay: cardSetType,
                    cardCount: newdeck.allCards.length,
                    isCustom: inputSet === "custom-csv" || inputSet === "customempty",
                    customList: inputSet === "custom-csv" ? inputCustom : undefined
                }
            )
        } catch (error) {
            console.warn('Failed to record deck creation in history:', error)
        }

        await client.setGameDataV2(
            interaction.guildId,
            "game",
            interaction.channelId,
            gameData
        );

        await GameStatusHelper.sendGameStatus(interaction, client, gameData,
          { content: `Added and shuffled the new deck: ${inputName}` }
        );
    }
}

module.exports = new NewDeck();