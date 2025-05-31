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

    let tokenDisplayLines = [];

    if (gameData.tokens && gameData.tokens.length > 0) {
        gameData.tokens.forEach(token => {
            const tokenCap = token.cap;
            let circulationDisplay = '?';
            let availableDisplay = '♾️'; // Default for no cap

            // Calculate total tokens held by all players, regardless of secrecy for cap calculations
            let totalTokensHeldByAllPlayers = 0;
            gameData.players.forEach(p => {
                if (p.tokens && p.tokens[token.id]) {
                    totalTokensHeldByAllPlayers += p.tokens[token.id];
                }
            });

            if (!token.isSecret) {
                circulationDisplay = totalTokensHeldByAllPlayers.toString();
            }

            let capDisplay = 'N/A'; // Default for no cap
            if (typeof tokenCap === 'number') {
                capDisplay = tokenCap.toString();
                const availableTokens = tokenCap - totalTokensHeldByAllPlayers;
                availableDisplay = (availableTokens > 0 ? availableTokens : 0).toString();
                // Ensure availableDisplay respects that secret circulation isn't shown for totals if cap is met by secret tokens
                if (token.isSecret && availableTokens <=0) {
                    availableDisplay = '0 (cap met)';
                } else if (token.isSecret && availableTokens > 0) {
                    availableDisplay = `${availableTokens} (of ${capDisplay} total)`;
                }
            }

            tokenDisplayLines.push(
                `**${token.name}**: Circulation: ${circulationDisplay} | Cap: ${capDisplay} | Available: ${availableDisplay}`
            );
        });
    }

    let tokenSupplySection = "";
    if (tokenDisplayLines.length > 0) {
        tokenSupplySection = "\n\n**Token Supply:**\n" + tokenDisplayLines.join("\n");
    }

    newEmbed.setDescription(tableString + tokenSupplySection);

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
