const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const Emoji = require("./EmojiAssitant");
const { sortBy, floor, isArray, find } = require("lodash");
var AsciiTable = require("ascii-table");
const { createCanvas, Image, loadImage } = require("canvas");
const { CanvasTable, CTColumn } = require("canvas-table");

const HiddenEnum = {
  "visible": "All counts are visible",
  "all": "All counts hidden",
  "hand": "Hand size hidden",
  "deck": "Deck size hidden",
}

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
        const cards = GameFormatter.CountCards(gameData, play);
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

  static async GameStatusV2(gameData, guild, clientUserId) {
    const columns = [
      { title: "Player" },
      { title: "Score", options: { textAlign: "right" } },
    ];

    // Add token columns for each token in the game
    if (gameData.tokens && gameData.tokens.length > 0) {
      gameData.tokens.forEach(token => {
        // REMOVE the if(!token.isSecret) condition
        columns.push({
          title: token.name,
          options: { textAlign: "right" }
        });
      });
    }

    // Add cards column if needed
    if (gameData.decks.length > 0) {
      columns.push({ title: "Cards in Hand", options: { textAlign: "right" } });
    }

    const options = {
      borders: {
        table: { color: "#aaa", width: 1 },
      },
      fit: true,
      // title object removed here
      // cell object removed here
      header: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        background: '#f0f0f0', // Corrected property name
        border: { bottom: { color: '#000', width: 2 } },
      },
      title: {
        text: `${gameData.name} Status ${gameData.reverseOrder ? "(Turn Order Reversed)" : ""}`,
        fontSize: 24,
        fontFamily: 'Open Sans',
      },
      cell: {
        fontSize: 18,
        fontFamily: 'Open Sans',
        padding: 10,
      },
      fontFamily: 'Open Sans', // Default font for the table
      // options.row callback removed
    };
    const data = [];

    // Calculate Totals
    let totalCards = 0;
    let anyPlayerCardCountIsHidden = false;
    gameData.players.forEach((play) => {
      const playerCards = GameFormatter.CountCards(gameData, play);
      if (playerCards === '?') {
        anyPlayerCardCountIsHidden = true;
      } else {
        totalCards += Number(playerCards) || 0;
      }
    });
    if (anyPlayerCardCountIsHidden) {
      totalCards = '?';
    }

    const tokenTotals = {};
    if (gameData.tokens && gameData.tokens.length > 0) {
      gameData.tokens.forEach(token => {
        const tokenId = token.id;
        tokenTotals[tokenId] = 0;
        gameData.players.forEach(player => {
          tokenTotals[tokenId] += (player.tokens?.[tokenId] || 0);
        });
        if (token.isSecret && (!token.cap || token.cap === Infinity || token.cap === null)) {
          tokenTotals[tokenId] = '?';
        }
      });
    }

    // Process each player's data
    sortBy(gameData.players, ["order"]).forEach((play) => {
      const name = guild.members.cache.get(play.userId)?.displayName;
      let rowData = [
        `(${play.order + 1}) ${name ?? play.name ?? play.userId}`,
        String(play.score), // Ensure score is a string
      ];

      // Add token values
      if (gameData.tokens && gameData.tokens.length > 0) {
        gameData.tokens.forEach(token => {
          if (token.isSecret) {
            // Check if the current player is the bot
            if (play.userId === clientUserId) {
              const tokenCount = play.tokens?.[token.id] || 0;
              rowData.push(String(tokenCount)); // Ensure token count is a string
            } else {
              rowData.push('?'); // Show '?' for other players' secret tokens
            }
          } else {
            const tokenCount = play.tokens?.[token.id] || 0;
            rowData.push(String(tokenCount)); // Ensure token count is a string
          }
        });
      }

      // Add cards if needed
      if (gameData.decks.length > 0) {
        const cards = GameFormatter.CountCards(gameData, play);
        rowData.push(String(cards)); // Ensure card count is a string
      }

      data.push(rowData);
    });

    
    const totalsRowData = ['Totals', '']; // Initial parts are strings
    if (gameData.tokens && gameData.tokens.length > 0) {
      gameData.tokens.forEach(token => {
        const currentTotal = tokenTotals[token.id];
        let displayValue;
        if (currentTotal === '?') {
          displayValue = '?';
        } else if (token.cap && typeof token.cap === 'number' && isFinite(token.cap)) {
          displayValue = `${currentTotal} (of ${token.cap})`; // String
        } else {
          displayValue = String(currentTotal); // Ensure total is a string
        }
        totalsRowData.push(displayValue);
      });
    }
    let displayTotalCards = anyPlayerCardCountIsHidden ? '?' : String(totalCards); // Ensure total cards is a string
    if (gameData.decks.length > 0) {
      totalsRowData.push(displayTotalCards);
    }

    // Add to Data for CanvasTable
    data.push(totalsRowData.map(String));

    const processedData = data.map((currentRow, rowIndex) => {
        // Player data rows (indices 0 to gameData.players.length - 1)
        if (rowIndex < gameData.players.length) {
            const player = sortBy(gameData.players, ["order"])[rowIndex]; // Get the current player
            const isEvenPlayerRow = rowIndex % 2 === 0;
            const playerRowBackground = isEvenPlayerRow ? '#ffffff' : '#f9f9f9';
            return currentRow.map((cellValue, cellIndex) => {
                let cellProperties = {
                    value: String(cellValue == '' ? ' ' : cellValue),
                    background: playerRowBackground
                };
                // If this is the first cell (player name) and the player has a color
                if (cellIndex === 0 && player.color) {
                    cellProperties.color = player.color; // Set text color
                }
                return cellProperties;
            });
        }
        // Totals row (last row)
        else {
            return currentRow.map(cellValue => ({
                value: String(cellValue),
                background: '#e0e0e0',
                fontWeight: 'bold'
            }));
        }
    });

    const hasTokens = gameData.tokens && gameData.tokens.length > 0;
    const canvasWidth = hasTokens ? 1200 : 800;
    const additionalRows = 1; // totals row
    const canvas = createCanvas(canvasWidth, 100 + 45 * (gameData.players.length + additionalRows));
    let ctx = canvas.getContext("2d");
    ctx.textDrawingMode = "glyph";

    const config = { columns, data: processedData, options };
    const ct = new CanvasTable(canvas, config);
    await ct.generateTable();

    const embeds = []; 
    // we previously had a special embed for secret tokens, but we removed it
    // the logic for additional embeds is still here if needed.

    return {
      attachment: new AttachmentBuilder(await ct.renderToBuffer(), {name: `status-table.png`}),
      embed: embeds.length > 0 ? embeds[0] : null // This will effectively be null
    };
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

    //Simultaneous Hand
    if (player.hands.simultaneous && player.hands.simultaneous.length > 0) {
      const simultaneousEmbed = new EmbedBuilder()
        .setColor(13502711)
        .setTitle(`Selected for Simultaneous Play`)
        .setDescription(`*These are the cards you have selected to play simultaneously*`);
      const simultaneousHand = await this.genericHand(
        player,
        simultaneousEmbed,
        "simultaneous", 
        "Selected Cards"
      );
      if (simultaneousHand) {
        results.attachments.push(simultaneousHand);
      }
      results.embeds.push(simultaneousEmbed);
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
    return await this.ImagefromUrlList(imgList);
    // let canvas = createCanvas(1200, 1);
    // let ctx = canvas.getContext("2d");
    // const cardWidth = 200;
    // let rowstart = 0;
    // let rowend = 0;
    // for (let i = 0; i < imgList.length; i++) {
    //   const cardImage = await loadImage(imgList[i]);
    //   const cardHeight = (cardWidth / cardImage.width) * cardImage.height;
    //   const spot = i % 6;
    //   if (spot == 0) {
    //     rowstart = rowend;
    //   }
    //   if (rowstart + cardHeight > rowend) {
    //     rowend = rowstart + cardHeight;
    //   }
    //   if (rowend > canvas.height) {
    //     const oldCanvas = canvas;
    //     canvas = createCanvas(oldCanvas.width, rowend);
    //     ctx = canvas.getContext("2d");
    //     ctx.drawImage(oldCanvas, 0, 0);
    //   }
    //   ctx.drawImage(
    //     cardImage,
    //     (i % 6) * cardWidth,
    //     rowstart,
    //     cardWidth,
    //     cardHeight
    //   );
    // }
    // return canvas.toBuffer();
  }

  static async ImagefromUrlList(imgList) {
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
    if (isArray(gameData.winner)){
      return gameData.winner.map((id) => guild.members.cache.get(id)?.displayName).join(" & ");
    } else {
      return guild.members.cache.get(gameData.winner)?.displayName;
    }
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
        `*started with ${deckData.allCards.length} cards*\n` + 
        `Shuffle style: ${deckData.shuffleStyle}\n` + 
        `Hidden info: ${HiddenEnum[deckData.hiddenInfo]}\n`
      );

    
    for (const pile in deckData.piles) {
      let noShow = (deckData.hiddenInfo == "all" || deckData.hiddenInfo == "deck") 
        && deckData.piles[pile].cards.length > 1
      newEmbed.addFields({
        name: `${pile} pile`,
        value: `${noShow ? '?' : deckData.piles[pile].cards.length} cards`,
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
        let noShow = (deck.hiddenInfo == "all" || deck.hiddenInfo == "deck")
          && deck.piles[pile].cards.length > 1
        deckData += `${pile} pile: ${noShow ? '?' : deck.piles[pile].cards.length} cards, `;
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

  static async multiCard(cardArry, title) {
    const embeds = [];
    const attachments = [];
    let imgList = [];
    let description = "";

    for (let i = 0; i < cardArry.length; i++) {
      const card = cardArry[i];
      if (card.url) {
        imgList.push(card.url);
      }
      if (card.description.length > 0) {
        description += `• ${this.cardLongName(card)} - ${card.description}\n`;
      } else {
        description += `• ${this.cardLongName(card)}\n`;
      }

      if ((i + 1) % 24 === 0 || i === cardArry.length - 1) {
        const newEmbed = new EmbedBuilder()
          .setColor(13502711)
          .setTitle(title)
          .setDescription(`Cards: \n${description}`);
        embeds.push(newEmbed);
        description = "";

        if (imgList.length > 0) {
          const newAttach = new AttachmentBuilder(
            await this.ImagefromUrlList(imgList),
            { name: `multiCard-${Math.floor(i / 24) + 1}.png` }
          );
          attachments.push(newAttach);
          imgList = [];
        }
      }
    }

    return [embeds, attachments];
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

  static CountCards(game, player) {
    if (!player) return 0;
    const noshow = game.decks.find((deck) => deck.hiddenInfo == "hand" || deck.hiddenInfo == "all")
    if (noshow) return "?";
    return player.hands.main.length;
  }

  static async playerSecretTokens(gameData, player) {
    if (!gameData.tokens || !player.tokens) {
      return null;
    }

    const secretTokens = gameData.tokens.filter(t => t.isSecret);
    if (secretTokens.length === 0) {
      return null;
    }

    const tokenEmbed = new EmbedBuilder()
      .setColor(13502711)
      .setTitle("Your Secret Tokens")
      .setDescription(`**Current Game:** ${gameData.name}\n`);

    secretTokens.forEach(token => {
      const count = player.tokens[token.id] || 0;
      tokenEmbed.addFields({
        name: token.name,
        value: `${count}${token.description ? ` - ${token.description}` : ''}`,
        inline: true
      });
    });

    return tokenEmbed;
  }

  /**
   * Creates a reply object with game status, including the status table, deck status (if any), and token info
   * @param {Object} gameData - The game data
   * @param {Object} guild - The Discord guild object
   * @param {Object} options - Additional options
   * @param {string} options.content - Optional content message to include
   * @param {Array} options.additionalEmbeds - Optional additional embeds to include
   * @returns {Object} Reply options object compatible with interaction.reply or interaction.editReply
   */
  static async createGameStatusReply(gameData, guild, clientUserId, options = {}) {
    const { attachment, embed } = await this.GameStatusV2(gameData, guild, clientUserId);

    // Initialize embeds array for replyOptions
    let finalEmbeds = [];
    if (gameData.decks?.length > 0) {
        finalEmbeds.push(...this.deckStatus2(gameData));
    }
    if (embed) { // 'embed' is the (now potentially null) direct embed from GameStatusV2
        finalEmbeds.push(embed);
    }

    if (gameData.tokens && gameData.tokens.length > 0) {
        const tokenSupplyEmbed = new EmbedBuilder()
            .setColor(13502711)
            .setTitle("Token Supply Status");

        let tokenDisplayLines = [];
        gameData.tokens.forEach(token => {
            const tokenCap = token.cap;
            let circulationDisplay = '?';
            let availableDisplay = '♾️';

            let totalTokensHeldByAllPlayers = 0;
            gameData.players.forEach(p => {
                if (p.tokens && p.tokens[token.id]) {
                    totalTokensHeldByAllPlayers += p.tokens[token.id];
                }
            });

            if (!token.isSecret) {
                circulationDisplay = totalTokensHeldByAllPlayers.toString();
            }

            let capDisplay = 'N/A';
            if (typeof tokenCap === 'number') {
                capDisplay = tokenCap.toString();
                const availableTokens = tokenCap - totalTokensHeldByAllPlayers;

                if (token.isSecret) {
                    if (availableTokens <= 0) {
                        availableDisplay = '0 (cap met)';
                    } else {
                        availableDisplay = availableTokens.toString();
                    }
                } else { // Public token
                    availableDisplay = (availableTokens > 0 ? availableTokens : 0).toString();
                }
            } else { // No cap
                availableDisplay = '♾️';
            }

            const descriptionPart = token.description ? ` (${token.description})` : '';
            tokenDisplayLines.push(
                `**${token.name}**${descriptionPart}: Circulation: ${circulationDisplay} | Cap: ${capDisplay} | Available: ${availableDisplay}`
            );
        });

        // This check ensures we only add the embed if there were lines generated (should always be true if gameData.tokens isn't empty)
        if (tokenDisplayLines.length > 0) {
            tokenSupplyEmbed.setDescription(tokenDisplayLines.join("\n"));
            finalEmbeds.push(tokenSupplyEmbed);
        }
    }

    if (options.additionalEmbeds) {
        finalEmbeds.push(...options.additionalEmbeds);
    }

    const replyOptions = {
        files: [attachment],
        embeds: finalEmbeds // Use the newly constructed finalEmbeds array
    };

    if (options.content) {
        replyOptions.content = options.content;
    }
    return replyOptions;
  }
}

module.exports = GameFormatter;
