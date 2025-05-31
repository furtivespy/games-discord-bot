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

    const tableString = `\`\`\`\n${table.toString()}\n\`\`\``;

    let tokenCapInfo = "";
    if (gameData.tokens && gameData.tokens.length > 0) {
        let cappedTokenDetails = []; // Array to hold strings for each capped token
        gameData.tokens.forEach(token => {
            if (typeof token.cap === 'number' && !token.isSecret) { // Only show public tokens
                let totalTokensHeldByAllPlayers = 0;
                gameData.players.forEach(p => {
                    if (p.tokens && p.tokens[token.id]) {
                        totalTokensHeldByAllPlayers += p.tokens[token.id];
                    }
                });
                const availableTokens = token.cap - totalTokensHeldByAllPlayers;
                cappedTokenDetails.push(`**${token.name}**: ${totalTokensHeldByAllPlayers} / ${token.cap} (${availableTokens > 0 ? availableTokens : 0} available)`);
            }
        });
        if (cappedTokenDetails.length > 0) {
            tokenCapInfo = "\n\n**Token Supply:**\n" + cappedTokenDetails.join("\n");
        }
    }

    newEmbed.setDescription(tableString + tokenCapInfo);

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
