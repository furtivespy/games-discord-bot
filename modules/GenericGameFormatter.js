const { EmbedBuilder } = require("discord.js");
const _ = require("lodash");
var AsciiTable = require("ascii-table");

class GameFormatter {
  static async GameStatus(gameData, message) {
    const newEmbed = new EmbedBuilder()
      .setColor(13502711)
      .setTitle(`Current Game Status`)
      .setFooter({text: "\u2800".repeat(60) + "🎲"});

    const table = new AsciiTable(gameData.name ?? "Game Title");
    let handName = "Cards in Hand";
    if (gameData.decks.length == 1) {
      handName = `${gameData.decks[0].name} Cards`;
    }
    table.setHeading("Player", "Score", handName);
    gameData.players.forEach((play) => {
      const cards = GameFormatter.CountCards(play);
      const name = message.guild.members.cache.get(play.userId)?.displayName;
      table.addRow(name ?? play.name ?? play.userId, play.score, cards);
    });
    newEmbed.setDescription(`\`\`\`\n${table.toString()}\n\`\`\``);

    return newEmbed;
  }

  static CountCards(player) {
    let cards = 0;
    if (!player) return 0;
    player.hands.forEach((hand) => {
      cards += hand.cards.length;
    });
    return cards;
  }
}

module.exports = GameFormatter;
