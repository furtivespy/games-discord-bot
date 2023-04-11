const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const Emoji = require("./EmojiAssitant");
const { sortBy, floor } = require("lodash");
var AsciiTable = require("ascii-table");
const { createCanvas, Image, loadImage } = require("canvas");
const { CanvasTable, CTColumn } = require("canvas-table");

class GameFormatter {
  static async GameStatus(gameData, guild) {
    const newEmbed = new EmbedBuilder()
      .setColor(13502711)
      .setTitle(`Current Game Status`)
      .setFooter({ text: "\u2800".repeat(60) + "🎲" });

    const table = new AsciiTable(gameData.name ?? "Game Title");
    if (gameData.decks.length > 0) {
      //With Cards
      let handName = "Cards in Hand";
      if (gameData.decks.length == 1) {
        handName = `${gameData.decks[0].name} Hand`;
      }
      let draftCards = 0;
      gameData.players.forEach((player) => {
        if (player.hands.draft && player.hands.draft.length > 0) {
          draftCards += player.hands.draft.length;
        }
      });
      if (draftCards > 0) {
        table.setHeading("Player", "Score", handName, "Draft");
      } else {
        table.setHeading("Player", "Score", handName);
      }
      sortBy(gameData.players, ["order"]).forEach((play) => {
        const cards = GameFormatter.CountCards(play);
        const name = guild.members.cache.get(play.userId)?.displayName;
        if (draftCards > 0) {
          table.addRow(
            `${Emoji.IndexToEmoji(play.order)}${
              name ?? play.name ?? play.userId
            }`,
            play.score,
            cards,
            play.hands.draft.length
          );
        } else {
          table.addRow(
            `${Emoji.IndexToEmoji(play.order)}${
              name ?? play.name ?? play.userId
            }`,
            play.score,
            cards
          );
        }
      });
    } else {
      //No Cards
      table.setHeading("Player", "Score");
      sortBy(gameData.players, ["order"]).forEach((play) => {
        const name2 = guild.members.cache.get(play.userId)?.displayName;
        table.addRow(
          `${Emoji.IndexToEmoji(play.order)}${
            name2 ?? play.name ?? play.userId
          }`,
          play.score
        );
      });
    }

    newEmbed.setDescription(`\`\`\`\n${table.toString()}\n\`\`\``);

    return newEmbed;
  }

  static async GameStatusV2(gameData, guild) {
    const columns = [
      { title: "Player" },
      { title: "Score", options: { textAlign: "right" } },
    ];
    const options = {
      borders: {
        table: { color: "#aaa", width: 1 },
      },
      fit: true,
      title: {
        text: `${gameData.name} Status`,
        fontSize: 24,
      },
      cell: {
        fontSize: 18,
      },
      header: {
        fontSize: 18,
      },
    };
    const data = [];

    if (gameData.decks.length > 0) {
      //With Cards
      columns.push({ title: "Cards in Hand", options: { textAlign: "right" } });

      let draftCards = 0;
      gameData.players.forEach((player) => {
        if (player.hands.draft && player.hands.draft.length > 0) {
          draftCards += player.hands.draft.length;
        }
      });

      if (draftCards > 0) {
        columns.push({
          title: "Draftable Cards",
          options: { textAlign: "right" },
        });
      }

      sortBy(gameData.players, ["order"]).forEach((play) => {
        const cards = GameFormatter.CountCards(play).toString();
        const name = guild.members.cache.get(play.userId)?.displayName;
        if (draftCards > 0) {
          data.push([
            `${Emoji.IndexToEmoji(play.order)}${
              name ?? play.name ?? play.userId
            }`,
            play.score,
            cards,
            play.hands.draft.length.toString(),
          ]);
        } else {
          data.push([
            `${Emoji.IndexToEmoji(play.order)}${
              name ?? play.name ?? play.userId
            }`,
            play.score,
            cards,
          ]);
        }
      });
    } else {
      //No Cards
      sortBy(gameData.players, ["order"]).forEach((play) => {
        const name2 = guild.members.cache.get(play.userId)?.displayName;
        data.push([
          `${Emoji.IndexToEmoji(play.order)}${
            name2 ?? play.name ?? play.userId
          }`,
          play.score,
        ]);
      });
    }
    const canvas = createCanvas(800, 100 + 35 * gameData.players.length);
    const config = { columns, data, options };
    const ct = new CanvasTable(canvas, config);
    await ct.generateTable();

    return [
      new AttachmentBuilder(await ct.renderToBuffer(), {name: `status-table.png`}),
    ];
  }

  static draftHelpNotes() {
    const newEmbed = new EmbedBuilder()
      .setColor(13502711)
      .setTitle(`Drafting Help`)
      .setDescription(
        `You now have draft cards in your hand. \n` +
          `\`/cards hand show\`- Shows the cards in your hand. (as well as what you can draft) \n` +
          `\`/cards draft take\` - Take a card from the draft. \n` +
          `\`/cards draft pass\` - Passes all draft cards around the table (for all players)`
      );

    return newEmbed;
  }

  static playerSecretHand(gameData, player) {
    const newEmbed = new EmbedBuilder()
      .setColor(13502711)
      .setTitle(`Your Current Information`)
      .setDescription(`**Current Game:** ${gameData.name}\n`);

    if (player.hands.main.length > 0) {
      let cardList = "";
      this.cardSort(player.hands.main).forEach((card) => {
        if (card.url) {
          cardList += `• ${this.cardLongName(card)} [image](${card.url})\n`;
        } else {
          cardList += `• ${this.cardLongName(card)}\n`;
        }
      });
      newEmbed.addFields({ name: "Cards in Hand", value: cardList });
    }
    return newEmbed;
  }

  static async playerSecretHandAndImages(gameData, player) {
    let results = {
      embeds: [],
      attachments: [],
    };

    //Player Hand
    const newEmbed = new EmbedBuilder()
      .setColor(13502711)
      .setTitle(`Your Current Information`)
      .setDescription(`**Current Game:** ${gameData.name}\n`);
    const mainHand = await this.genericHand(
      player,
      newEmbed,
      "main",
      "Cards in Hand"
    );
    if (mainHand) {
      results.attachments.push(mainHand);
    }
    results.embeds.push(newEmbed);

    //Draft Hand
    if (player.hands.draft && player.hands.draft.length > 0) {
      const draftEmbed = new EmbedBuilder()
        .setColor(13502711)
        .setTitle(`Draft Cards`)
        .setDescription(`*These are the cards you can draft from*`);
      const draftHand = await this.genericHand(
        player,
        draftEmbed,
        "draft",
        "Cards to Draft From"
      );
      if (draftHand) {
        results.attachments.push(draftHand);
      }
      results.embeds.push(draftEmbed);
    }

    return results;
  }

  static async genericHand(player, embed, handName, fieldTitle) {
    let hasImages = false;

    if (player.hands[handName].length > 0) {
      let cardList = "";
      this.cardSort(player.hands[handName]).forEach((card) => {
        let newcardinfo = "";
        if (card.url) {
          hasImages = true;
          newcardinfo = `• ${this.cardLongName(card)} [image](${card.url})\n`;
        } else {
          newcardinfo = `• ${this.cardLongName(card)}\n`;
        }

        if (cardList.length + newcardinfo.length > 1020) {
          embed.addFields({name: fieldTitle, value: cardList});
          cardList = "";
        }
        cardList += newcardinfo;
      });
      embed.addFields({name: fieldTitle, value: cardList});
    }
    if (hasImages) {
      const newAttach = new AttachmentBuilder(
        await this.playerHandImage(player, handName),
        {name: `${handName}Hand.png`}
      );
      embed.setImage(`attachment://${handName}Hand.png`);
      return newAttach;
    }
    return null;
  }

  static async playerHandImage(player, handName) {
    const imgList = [];
    this.cardSort(player.hands[handName]).forEach((card) => {
      if (card.url) {
        imgList.push(card.url);
      }
    });
    let canvas = createCanvas(1200, 1);
    let ctx = canvas.getContext("2d");
    const cardWidth = 200;
    let rowstart = 0;
    let rowend = 0;
    for (let i = 0; i < imgList.length; i++) {
      const cardImage = await loadImage(imgList[i]);
      const cardHeight = (cardWidth / cardImage.width) * cardImage.height;
      const spot = i % 6;
      if (spot == 0) {
        rowstart = rowend;
      }
      if (rowstart + cardHeight > rowend) {
        rowend = rowstart + cardHeight;
      }
      if (rowend > canvas.height) {
        const oldCanvas = canvas;
        canvas = createCanvas(oldCanvas.width, rowend);
        ctx = canvas.getContext("2d");
        ctx.drawImage(oldCanvas, 0, 0);
      }
      ctx.drawImage(
        cardImage,
        (i % 6) * cardWidth,
        rowstart,
        cardWidth,
        cardHeight
      );
    }
    return canvas.toBuffer();
  }

  static winnerName(gameData, guild) {
    return guild.members.cache.get(gameData.winner)?.displayName;
  }

  static async GameWinner(gameData, guild) {
    const newEmbed = new EmbedBuilder()
      .setColor(0xfff200)
      .setTitle(`👑 Congratulations ${this.winnerName(gameData, guild)} 👑`)
      .setDescription(`For winning ${gameData.name}`);

    return newEmbed;
  }

  static async SecretStatus(secretData, guild) {
    const newEmbed = new EmbedBuilder().setColor(0x360280).setTitle(`Secrets`);

    secretData.players.forEach((play) => {
      const name = guild.members.cache.get(play.userId)?.displayName;
      const scrt = secretData.isrevealed
        ? play.secret
        : play.hassecret
        ? `*Secret hidden*`
        : `**No Secrets**`;
      newEmbed.addFields({
        name: `${name ?? play.name ?? play.userId}`,
        value: scrt,
      });
    });

    return newEmbed;
  }

  static deckStatus(deckData) {
    const newEmbed = new EmbedBuilder()
      .setColor(13502711)
      .setTitle(`${deckData.name} deck`)
      .setDescription(
        `*started with ${deckData.allCards.length} cards*\nShuffle style: ${deckData.shuffleStyle}`
      );

    for (const pile in deckData.piles) {
      newEmbed.addFields({
        name: `${pile} pile`,
        value: `${deckData.piles[pile].cards.length} cards`,
        inline: true,
      });
    }

    return newEmbed;
  }

  static deckStatus2(gameData) {
    if (!gameData.decks || gameData.decks.length == 0) {
      return [];
    }
    if (gameData.decks.length == 1) {
      return [this.deckStatus(gameData.decks[0])];
    }

    let deckData = "";
    gameData.decks.forEach((deck) => {
      deckData += `• **${deck.name}** - `;
      for (const pile in deck.piles) {
        deckData += `${pile} pile: ${deck.piles[pile].cards.length} cards, `;
      }
      deckData += `\n`;
    });

    const newEmbed = new EmbedBuilder()
      .setColor(13502711)
      .setTitle(`${gameData.name} decks`)
      .setDescription(deckData);

    return [newEmbed];
  }

  static cardSort(cardArry) {
    return sortBy(cardArry, ["suit", "value", "name"]);
  }

  static cardShortName(cardObj) {
    let cardStr = cardObj.name;
    if (cardObj.type.length > 0) {
      switch (cardObj.format) {
        case "B":
          cardStr = `${cardObj.type}: ${cardStr}`;
          break;
        default:
          cardStr += ` of ${cardObj.type}`;
          break;
      }
    }
    return cardStr;
  }

  static cardLongName(cardObj) {
    let cardStr = this.cardShortName(cardObj);
    if (cardObj.description.length > 0) {
      cardStr += ` (${cardObj.description})`;
    }
    return cardStr;
  }

  static oneCard(cardObj) {
    let cardStr = this.cardShortName(cardObj);

    const newEmbed = new EmbedBuilder().setColor(13502711).setTitle(cardStr);

    if (cardObj.description.length > 0) {
      newEmbed.setDescription(cardObj.description);
    }

    if (cardObj.url) {
      newEmbed.setImage(cardObj.url);
    }

    return newEmbed;
  }

  static handEmbed(playerData, guildName, channelName) {
    const cardsEmbed = new EmbedBuilder()
      .setColor(13928716)
      .setTitle(`All cards in hand in #${channelName} at ${guildName}`)
      .setTimestamp();
    playerData.hands.forEach((element) => {
      if (element.cards.length > 0) {
        cardsEmbed.addFields({
          name: `From ${element.deck} deck`,
          value: element.cards.sort().join("\n"),
        });
      } else {
        cardsEmbed.addFields({
          name: `From ${element.deck} deck`,
          value: "No cards",
        });
      }
    });
    return cardsEmbed;
  }

  static CountCards(player) {
    let cards = 0;
    if (!player) return 0;
    return player.hands.main.length;
  }
}

module.exports = GameFormatter;
