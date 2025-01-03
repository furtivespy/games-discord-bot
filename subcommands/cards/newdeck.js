const GameDB = require("../../db/anygame.js");
const { cloneDeep, find, shuffle, filter, sortBy, chain } = require("lodash");
const Formatter = require("../../modules/GameFormatter");

class NewDeck {
  async execute(interaction, client) {
    let gameData = Object.assign(
      {},
      cloneDeep(GameDB.defaultGameData),
      await client.getGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId
      )
    );

    if (interaction.isAutocomplete()) {
      
      await interaction.respond(
        chain(GameDB.CurrentCardList)
        .filter(cl => cl[0].toLowerCase().includes(interaction.options.getString("cardset").toLowerCase()))
        .sortBy(cl => cl[0])
        .map(cl => ({name: cl[0], value: cl[1]}))
        .slice(0, 25)
        .value()
        //GameDB.CurrentCardList.map(cl => ({name: cl[0], value: cl[1]}))
      );

    } else {
      if (gameData.isdeleted) {
        await interaction.reply({
          content: `Please use "/game newgame" command to create a game. I need a game in this channel to attach the deck to.`,
          ephemeral: true,
        });
        return;
      }

      const inputName = interaction.options.getString("name");
      const inputSet = interaction.options.getString("cardset");
      const inputCustom = interaction.options.getString("customlist");

      if (find(gameData.decks, { name: inputName })) {
        await interaction.reply({
          content: `There is already a deck with that name...`,
          ephemeral: true,
        });
        return;
      }
      if (inputSet == "custom-csv" && (!inputCustom || inputCustom.length == 0)) {
        await interaction.reply({
          content: `When choosing a custom deck, please include the "customlist" of cards`,
          ephemeral: true,
        });
        return;
      }

      let newdeck = Object.assign({}, cloneDeep(GameDB.defaultDeck), {
        name: inputName,
      });

      if (inputSet != "custom-csv" && inputSet != "customempty") {
        newdeck.allCards = GameDB.MakeSpecificDeck(inputName, inputSet);
      } else {
        if (inputSet == "custom") {
          newdeck.allCards = inputCustom.split(',').map(card => card.trim());
        } else if (inputSet == "customempty") {
          newdeck.allCards = [];
        }
        return;
      }

      newdeck.piles.draw.cards = cloneDeep(shuffle(newdeck.allCards));
      gameData.decks.push(newdeck);

      //client.setGameData(`game-${interaction.channel.id}`, gameData)
      await client.setGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId,
        gameData
      );

      const data = await Formatter.GameStatusV2(gameData, interaction.guild);
      await interaction.reply({
        content: `Added and shuffled the new deck: ${inputName}`,
        embeds: [...Formatter.deckStatus2(gameData)],
        files: [...data],
      });
    }
  }
}

module.exports = new NewDeck();
