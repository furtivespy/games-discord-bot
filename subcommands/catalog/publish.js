const GameHelper = require("../../modules/GlobalGameHelper");
const { find } = require("lodash");
const { publishToCatalog } = require("../../db/catalogPublish.js");
const {
  formatCardEntry,
  migrateHintReply,
  openReadyCatalog,
  replyEphemeral,
  truncateWithMore,
} = require("./shared.js");

class CatalogPublish {
  async execute(interaction, client) {
    if (interaction.isAutocomplete()) {
      const gameData = await GameHelper.getGameData(client, interaction);
      await GameHelper.getDeckAutocomplete(gameData, interaction);
      return;
    }

    const { ready, catalog } = openReadyCatalog();
    if (!ready) {
      return interaction.reply(migrateHintReply());
    }

    try {
      const gameData = await GameHelper.getGameData(client, interaction);
      if (gameData.isdeleted) {
        await replyEphemeral(
          interaction,
          "There is no game in this channel. Start one with `/game newgame` before publishing a deck."
        );
        return;
      }

      const deckName = interaction.options.getString("deck");
      const deck = find(gameData.decks, { name: deckName });
      if (!deck) {
        await replyEphemeral(
          interaction,
          deckName
            ? `No deck named "${deckName}" in this channel.`
            : "No such deck in this channel."
        );
        return;
      }

      const result = publishToCatalog(catalog, {
        id: interaction.options.getString("id"),
        name: interaction.options.getString("name"),
        allCards: deck.allCards,
        createdBy: interaction.user.id,
      });

      if (!result.ok) {
        await replyEphemeral(interaction, result.error);
        return;
      }

      const count = result.template.cards.length;
      const header = [
        `Published **${result.template.name}** (\`${result.template.id}\`) with ${count} cards.`,
        "",
      ].join("\n");
      const cardBlock = truncateWithMore(
        result.template.cards.map(formatCardEntry),
        { header, joiner: ", " }
      );
      await replyEphemeral(
        interaction,
        [
          cardBlock,
          "",
          "This set will not appear in `/cards deck new` until catalog cutover (FUR-38).",
        ].join("\n")
      );
    } finally {
      catalog.close();
    }
  }
}

module.exports = new CatalogPublish();
