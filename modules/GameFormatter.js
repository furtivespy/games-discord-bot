const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const Emoji = require("./EmojiAssitant");
const { sortBy, floor, isArray, find, shuffle } = require("lodash");
var AsciiTable = require("ascii-table");
const { createCanvas, Image, loadImage } = require("canvas");
const TableRenderer = require("./TableRenderer");

const HiddenEnum = {
  "visible": "All counts are visible",
  "all": "All counts hidden",
  "hand": "Hand size hidden",
  "deck": "Deck size hidden",
}

class GameFormatter {
  static async GameStatusV2(gameData, guild, clientUserId) {
    // Check if teams exist to determine if we need a team column
    const hasTeams = gameData.teams && gameData.teams.length > 0;

    const columns = [
      { title: "Player" },
    ];

    // Add Team column if teams exist
    if (hasTeams) {
      columns.push({ title: "Team" });
    }

    columns.push({ title: "Score", options: { textAlign: "right" } });

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
    if (gameData.decks && gameData.decks.length > 0) {
      columns.push({ title: "Cards in Hand", options: { textAlign: "right" } });
    }

    // Add Play Area column if any player has a play area (even if empty, to show the column)
    // or if the playToPlayArea setting is enabled.
    const showPlayAreaColumn = (gameData.players && gameData.players.some(p => p.playArea !== undefined)) || gameData.playToPlayArea;
    if (showPlayAreaColumn) {
      columns.push({ title: "Play Area", options: { textAlign: "right" } });
    }

    const options = {
      borders: {
        table: { color: "#aaa", width: 1 },
      },
      fit: false, // Disable fit to prevent column scaling issues
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
      ];

      // Add team name if teams exist
      if (hasTeams) {
        const playerTeam = gameData.teams.find(t => t.id === play.teamId);
        rowData.push(playerTeam ? playerTeam.name : '');
      }

      rowData.push(String(play.score)); // Ensure score is a string

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
      if (gameData.decks && gameData.decks.length > 0) {
        const cards = GameFormatter.CountCards(gameData, play);
        rowData.push(String(cards)); // Ensure card count is a string
      }

      // Add Play Area card count if the column is present
      if (showPlayAreaColumn) { // Use the variable defined earlier
        const playAreaCount = play.playArea ? play.playArea.length : 0;
        rowData.push(String(playAreaCount));
      }

      data.push(rowData);
    });

    
    const totalsRowData = ['Totals'];
    
    // Add empty team column in totals if teams exist
    if (hasTeams) {
      totalsRowData.push('');
    }
    
    totalsRowData.push(''); // Empty score column
    
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
    if (gameData.decks && gameData.decks.length > 0) {
      totalsRowData.push(displayTotalCards);
    }

    // Add total for Play Area if the column is present
    if (showPlayAreaColumn) { // Use the variable defined earlier
      let totalPlayAreaCards = 0;
      gameData.players.forEach(p => {
        if (p.playArea) {
          totalPlayAreaCards += p.playArea.length;
        }
      });
      totalsRowData.push(String(totalPlayAreaCards));
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
                // If this is the team column (second column when teams exist) and player has a team with a color
                if (hasTeams && cellIndex === 1 && player.teamId) {
                    const playerTeam = gameData.teams.find(t => t.id === player.teamId);
                    if (playerTeam && playerTeam.color) {
                        cellProperties.color = playerTeam.color; // Set team color
                    }
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

    // Calculate actual required dimensions based on content
    const dimensions = TableRenderer.calculateRequiredDimensions(columns, processedData, options);
    
    // Create canvas with the exact size needed
    const canvas = createCanvas(dimensions.canvasWidth, dimensions.canvasHeight);
    let ctx = canvas.getContext("2d");
    ctx.textDrawingMode = "glyph";

    const config = { columns, data: processedData, options };
    const tableRenderer = new TableRenderer(canvas, config);
    await tableRenderer.generateTable();

    const embeds = []; 
    // we previously had a special embed for secret tokens, but we removed it
    // the logic for additional embeds is still here if needed.

    return {
      attachment: new AttachmentBuilder(await tableRenderer.renderToBuffer(), {name: `status-table.png`}),
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

  static async SecretStatusAnon(secretData, guild, gameData = null) {
    const newEmbed = new EmbedBuilder().setColor(0x360280).setTitle(`Anonymous Secrets`);
    const isSuperSecret = secretData.mode === 'super-secret';

    // For super-secret mode: find max length
    let maxLength = 0;
    if (isSuperSecret) {
      secretData.players.filter(p => p.hassecret).forEach((play) => {
        maxLength = Math.max(maxLength, play.secret.length);
      });
    }

    // Check if teams exist and are being used
    const hasTeams = gameData && gameData.teams && gameData.teams.length > 0;
    const playersHaveTeams = hasTeams && secretData.players.some(p => p.teamId);

    if (hasTeams && playersHaveTeams) {
      // Group secrets by team
      const teamGroups = {};
      const noTeamPlayers = [];

      secretData.players.filter(p => p.hassecret).forEach((player) => {
        if (player.teamId) {
          if (!teamGroups[player.teamId]) {
            teamGroups[player.teamId] = [];
          }
          teamGroups[player.teamId].push(player);
        } else {
          noTeamPlayers.push(player);
        }
      });

      // Display teams with shuffled secrets
      gameData.teams.forEach((team) => {
        if (teamGroups[team.id] && teamGroups[team.id].length > 0) {
          // Count duplicates within this team only
          const teamSecretCounts = {};
          if (isSuperSecret) {
            teamGroups[team.id].forEach((player) => {
              teamSecretCounts[player.secret] = (teamSecretCounts[player.secret] || 0) + 1;
            });
          }

          const teamSecrets = teamGroups[team.id].map((player) => {
            const secret = player.secret;
            if (isSuperSecret) {
              const paddedSecret = secret.padEnd(maxLength, ' ');
              const isDuplicate = teamSecretCounts[secret] > 1;
              return `${isDuplicate ? '⚠️ ' : ''}• ||${paddedSecret}||`;
            } else {
              return `• ${secret}`;
            }
          });

          const shuffledTeamSecrets = shuffle(teamSecrets);
          newEmbed.addFields({
            name: `${team.name}`,
            value: shuffledTeamSecrets.join('\n'),
          });
        }
      });

      // Display secrets from players without teams (shuffled)
      if (noTeamPlayers.length > 0) {
        // Count duplicates within no-team players only
        const noTeamSecretCounts = {};
        if (isSuperSecret) {
          noTeamPlayers.forEach((player) => {
            noTeamSecretCounts[player.secret] = (noTeamSecretCounts[player.secret] || 0) + 1;
          });
        }

        const noTeamSecrets = noTeamPlayers.map((player) => {
          const secret = player.secret;
          if (isSuperSecret) {
            const paddedSecret = secret.padEnd(maxLength, ' ');
            const isDuplicate = noTeamSecretCounts[secret] > 1;
            return `${isDuplicate ? '⚠️ ' : ''}• ||${paddedSecret}||`;
          } else {
            return `• ${secret}`;
          }
        });

        const shuffledNoTeamSecrets = shuffle(noTeamSecrets);
        newEmbed.addFields({
          name: `No Team`,
          value: shuffledNoTeamSecrets.join('\n'),
        });
      }
    } else {
      // Original behavior - no team grouping, count all duplicates
      const secretCounts = {};
      if (isSuperSecret) {
        secretData.players.filter(p => p.hassecret).forEach((play) => {
          secretCounts[play.secret] = (secretCounts[play.secret] || 0) + 1;
        });
      }

      const secrets = secretData.players.filter(p => p.hassecret).map(p => {
        const secret = p.secret;
        // Wrap in spoilers if super-secret mode
        if (isSuperSecret) {
          const paddedSecret = secret.padEnd(maxLength, ' ');
          const isDuplicate = secretCounts[secret] > 1;
          return `${isDuplicate ? '⚠️ ' : ''}• ||${paddedSecret}||`;
        } else {
          return `• ${secret}`;
        }
      });
      const shuffledSecrets = shuffle(secrets);

      if (shuffledSecrets.length > 0){
        newEmbed.setDescription(shuffledSecrets.join('\n'));
      } else {
        newEmbed.setDescription('No secrets to reveal.');
      }
    }

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

    // Play Area Display
    if (player.playArea && player.playArea.length > 0) {
      const playAreaEmbed = new EmbedBuilder()
        .setColor(player.color || 13502711) // Use player color or a default
        .setTitle(`Your Play Area`)
        .setDescription(`Cards currently in your play area:`); // Initial description

      // Unlike hands, playArea cards are typically not sorted by suit/value but by order of play.
      // So, we pass player.playArea directly without this.cardSort().
      const playAreaAttachment = await this.genericCardZoneDisplay(
        player.playArea,
        playAreaEmbed,
        "Cards in Play Area", // This will be the field title within the embed
        "PlayArea"
      );

      if (playAreaAttachment) {
        results.attachments.push(playAreaAttachment);
      }
      results.embeds.push(playAreaEmbed);
    }

    return results;
  }

  /**
   * Formats a generic list of cards (e.g., hand, play area) into an embed,
   * adding text list and a composite image if cards have URLs.
   * @param {Array<Object>} cardArray - The array of card objects.
   * @param {EmbedBuilder} embed - The Discord EmbedBuilder to modify.
   * @param {String} fieldTitle - The title for the embed field listing the cards.
   * @param {String} imageAttachmentNamePrefix - Prefix for the image attachment name (e.g., "PlayArea", "Hand").
   * @returns {Promise<AttachmentBuilder|null>} The image attachment if created, otherwise null.
   */
  static async genericCardZoneDisplay(cardArray, embed, fieldTitle, imageAttachmentNamePrefix) {
    if (!cardArray || cardArray.length === 0) {
      embed.addFields({ name: fieldTitle, value: "Empty" });
      return null;
    }

    let hasImages = false;
    let cardListText = "";
    const imageUrls = [];

    // Sort cards first (assuming cardSort is applicable, might need to pass it or sort externally if not always by suit/value/name)
    // For playArea, original order is important, so we don't sort here. For hands, cardSort is used before calling.
    // If sorting is needed for other zones, it should be done before calling this function.
    cardArray.forEach((card) => {
      let newCardInfo = "";
      if (card.url) { // Assuming card.url is the image link
        hasImages = true;
        imageUrls.push(card.url);
        newCardInfo = `• ${this.cardLongName(card)} [image](${card.url})\n`;
      } else {
        newCardInfo = `• ${this.cardLongName(card)}\n`;
      }

      if (cardListText.length + newCardInfo.length > 1020) { // Embed field value limit
        embed.addFields({ name: fieldTitle, value: cardListText });
        cardListText = ""; // Reset for next field if needed (though one field is typical)
        fieldTitle = `${fieldTitle} (cont.)`; // Indicate continuation
      }
      cardListText += newCardInfo;
    });

    if (cardListText) {
      embed.addFields({ name: fieldTitle, value: cardListText });
    }

    if (hasImages && imageUrls.length > 0) {
      const imageBuffer = await this.ImagefromUrlList(imageUrls);
      const attachmentName = `${imageAttachmentNamePrefix}-${Date.now()}.png`; // Add timestamp for uniqueness
      const attachment = new AttachmentBuilder(imageBuffer, { name: attachmentName });
      embed.setImage(`attachment://${attachmentName}`);
      return attachment;
    }
    return null;
  }

  static async genericHand(player, embed, handName, fieldTitle) {
    // This function now primarily acts as a wrapper for genericCardZoneDisplay for hands
    const handCards = player.hands[handName] ? this.cardSort(player.hands[handName]) : [];
    if (handCards.length === 0 && player.hands[handName] && player.hands[handName].length === 0) { // Explicitly check if hand exists but is empty
        embed.addFields({ name: fieldTitle, value: "Empty" });
        return null;
    }
    if (handCards.length === 0 && !player.hands[handName]) { // Hand type doesn't exist for player
        return null;
    }
    return await this.genericCardZoneDisplay(handCards, embed, fieldTitle, `${handName}Hand`);
  }

  static async ImagefromUrlList(imgList) {
    // Calculate canvas width based on number of cards (max 6 cards per row)
    const cardsInFirstRow = Math.min(imgList.length, 6);
    const canvasWidth = cardsInFirstRow * 200;
    
    let canvas = createCanvas(canvasWidth, 1);
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
        canvas = createCanvas(canvasWidth, rowend);
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

  static async SecretStatus(secretData, guild, gameData = null) {
    const newEmbed = new EmbedBuilder().setColor(0x360280).setTitle(`Secrets`);
    const isSuperSecret = secretData.mode === 'super-secret';
    
    // For super-secret mode: find max length
    let maxLength = 0;
    if (isSuperSecret && secretData.isrevealed) {
      secretData.players.filter(p => p.hassecret).forEach((play) => {
        maxLength = Math.max(maxLength, play.secret.length);
      });
    }
    
    // Check if teams exist and are being used
    const hasTeams = gameData && gameData.teams && gameData.teams.length > 0;
    const playersHaveTeams = hasTeams && secretData.players.some(p => p.teamId);

    if (hasTeams && playersHaveTeams) {
      // Group secrets by team
      const teamGroups = {};
      const noTeamPlayers = [];

      secretData.players.forEach((play) => {
        if (play.teamId) {
          if (!teamGroups[play.teamId]) {
            teamGroups[play.teamId] = [];
          }
          teamGroups[play.teamId].push(play);
        } else {
          noTeamPlayers.push(play);
        }
      });

      // Display teams
      gameData.teams.forEach((team) => {
        if (teamGroups[team.id]) {
          // Count duplicates within this team only
          const teamSecretCounts = {};
          if (isSuperSecret && secretData.isrevealed) {
            teamGroups[team.id].filter(p => p.hassecret).forEach((play) => {
              teamSecretCounts[play.secret] = (teamSecretCounts[play.secret] || 0) + 1;
            });
          }

          const teamSecrets = teamGroups[team.id].map((play) => {
            const name = guild.members.cache.get(play.userId)?.displayName;
            let scrt = secretData.isrevealed
              ? play.secret
              : play.hassecret
              ? `*Secret hidden*`
              : `**No Secrets**`;
            
            // Wrap in spoilers if super-secret mode and revealed
            if (isSuperSecret && secretData.isrevealed && play.hassecret) {
              const paddedSecret = play.secret.padEnd(maxLength, ' ');
              const isDuplicate = teamSecretCounts[play.secret] > 1;
              scrt = `${isDuplicate ? '⚠️ ' : ''}||${paddedSecret}||`;
            }
            
            return `**${name ?? play.name ?? play.userId}:** ${scrt}`;
          }).join('\n');

          newEmbed.addFields({
            name: `${team.name}`,
            value: teamSecrets || 'No players',
          });
        }
      });

      // Display players without teams
      if (noTeamPlayers.length > 0) {
        // Count duplicates within no-team players only
        const noTeamSecretCounts = {};
        if (isSuperSecret && secretData.isrevealed) {
          noTeamPlayers.filter(p => p.hassecret).forEach((play) => {
            noTeamSecretCounts[play.secret] = (noTeamSecretCounts[play.secret] || 0) + 1;
          });
        }

        const noTeamSecrets = noTeamPlayers.map((play) => {
          const name = guild.members.cache.get(play.userId)?.displayName;
          let scrt = secretData.isrevealed
            ? play.secret
            : play.hassecret
            ? `*Secret hidden*`
            : `**No Secrets**`;
          
          // Wrap in spoilers if super-secret mode and revealed
          if (isSuperSecret && secretData.isrevealed && play.hassecret) {
            const paddedSecret = play.secret.padEnd(maxLength, ' ');
            const isDuplicate = noTeamSecretCounts[play.secret] > 1;
            scrt = `${isDuplicate ? '⚠️ ' : ''}||${paddedSecret}||`;
          }
          
          return `**${name ?? play.name ?? play.userId}:** ${scrt}`;
        }).join('\n');

        newEmbed.addFields({
          name: `No Team`,
          value: noTeamSecrets,
        });
      }
    } else {
      // Original behavior - no team grouping, count all duplicates
      const secretCounts = {};
      if (isSuperSecret && secretData.isrevealed) {
        secretData.players.filter(p => p.hassecret).forEach((play) => {
          secretCounts[play.secret] = (secretCounts[play.secret] || 0) + 1;
        });
      }

      secretData.players.forEach((play) => {
        const name = guild.members.cache.get(play.userId)?.displayName;
        let scrt = secretData.isrevealed
          ? play.secret
          : play.hassecret
          ? `*Secret hidden*`
          : `**No Secrets**`;
        
        // Wrap in spoilers if super-secret mode and revealed
        if (isSuperSecret && secretData.isrevealed && play.hassecret) {
          const paddedSecret = play.secret.padEnd(maxLength, ' ');
          const isDuplicate = secretCounts[play.secret] > 1;
          scrt = `${isDuplicate ? '⚠️ ' : ''}||${paddedSecret}||`;
        }
        
        newEmbed.addFields({
          name: `${name ?? play.name ?? play.userId}`,
          value: scrt,
        });
      });
    }

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
    switch (cardObj.format) {
      case "B":
        if (cardObj.type.length > 0) {
          cardStr = `${cardObj.type}: ${cardStr}`;
        }
        break;
      case "C":
        cardStr = `${cardObj.value}: ${cardStr}`;
        break;
      default:
        if (cardObj.type.length > 0) {
          cardStr += ` of ${cardObj.type}`;
        }
        break;
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
    if (!game.decks) return 0;
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

    // Add embeds for each player's play area if they have cards
    // not used right now, using consolidated
    // const playAreaData = await this.generatePlayAreaEmbedsAndAttachments(gameData, guild);
    // finalEmbeds.push(...playAreaData.embeds);

    // Add consolidated play area embed
    const consolidatedPlayAreaData = await this.generateConsolidatedPlayAreaEmbedsAndAttachments(gameData, guild);
    finalEmbeds.push(...consolidatedPlayAreaData.embeds);

    // Add recent history embed
    const historyEmbed = this.createHistoryEmbed(gameData, { 
      limit: 15, 
      title: "Recent Actions" 
    });
    if (historyEmbed) {
      finalEmbeds.push(historyEmbed);
    }

    if (options.additionalEmbeds) {
      finalEmbeds.push(...options.additionalEmbeds);
    }

    const replyOptions = {
        files: [attachment, ...consolidatedPlayAreaData.attachments], // Add main status table + consolidated play area images
        embeds: finalEmbeds // Use the constructed finalEmbeds array
    };

    if (options.content) {
        replyOptions.content = options.content;
    }
    return replyOptions;
  }

  /**
   * Creates a history embed showing recent game actions
   * @param {Object} gameData - The game data containing history
   * @param {Object} options - Options for filtering and display
   * @param {string} options.categoryFilter - Filter by action category
   * @param {string} options.playerFilter - Filter by player ID
   * @param {number} options.limit - Maximum number of entries to show (default: 10)
   * @param {string} options.title - Custom embed title (default: "Recent Game History")
   * @returns {EmbedBuilder|null} History embed or null if no history
   */
  static createHistoryEmbed(gameData, options = {}) {
    if (!gameData.history || gameData.history.length === 0) {
      return null;
    }

    const { categoryFilter, playerFilter, limit = 10, title = "Recent Game History" } = options;

    // Filter and sort history
    let filteredHistory = gameData.history
      .filter(entry => {
        try {
          if (!entry || typeof entry !== 'object') return false;
          
          // Category filter
          if (categoryFilter && entry.action?.category !== categoryFilter) return false;
          
          // Player filter  
          if (playerFilter && entry.actor?.userId !== playerFilter) return false;
          
          return true;
        } catch (error) {
          console.warn('Error filtering history entry:', error, entry);
          return false;
        }
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit);

    if (filteredHistory.length === 0) {
      return null;
    }

    // Format entries
    const formattedEntries = filteredHistory.map(entry => {
      try {
        const timestamp = entry.timestamp ? 
          `<t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:R>` : '--';
        
        const emoji = this.getCategoryEmoji(entry.action?.category, entry.action?.type);
        const summary = entry.summary || '[No summary available]';
        
        return `${emoji} ${timestamp} ${summary}`;
      } catch (error) {
        console.warn('Error formatting history entry:', error, entry);
        return `⚡ -- [Error displaying this entry]`;
      }
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(title)
      .setDescription(formattedEntries.join('\n'))
      .setTimestamp();

    // Add filter info in footer if filters applied
    if (categoryFilter || playerFilter) {
      const filters = [];
      if (categoryFilter) filters.push(`Category: ${categoryFilter}`);
      if (playerFilter) filters.push(`Player filtered`);
      embed.setFooter({ text: `Filtered by: ${filters.join(', ')}` });
    }

    return embed;
  }

  /**
   * Get emoji for history action category
   * @param {string} category - Action category
   * @returns {string} Emoji for the category
   */
  static getCategoryEmoji(category, actionType) {
    // Special case for manual note entries
    if (actionType === 'note') {
      return '📝';
    }
    
    const emojiMap = {
      'game': '🎲',
      'player': '👤', 
      'card': '🃏',
      'token': '🔹',
      'money': '💰',
      'secret': '🤐',
      'team': '👥'
    };
    return emojiMap[category] || '📝';
  }

  /**
   * Generates a single consolidated embed and attachment for all players' play areas
   * @param {Object} gameData - The game data
   * @param {Object} guild - The Discord guild object
   * @returns {Object} Object containing embeds and attachments arrays
   */
  static async generateConsolidatedPlayAreaEmbedsAndAttachments(gameData, guild) {
    const playersWithPlayAreas = gameData.players.filter(player => player.playArea && player.playArea.length > 0);
    
    if (playersWithPlayAreas.length === 0) {
      return { embeds: [], attachments: [] };
    }

    const playAreaEmbed = new EmbedBuilder()
      .setColor(386945)
      .setTitle("Play Areas");

    // Add inline fields for each player
    for (const player of playersWithPlayAreas) {
      const member = guild.members.cache.get(player.userId);
      const playerName = member ? member.displayName : (player.name || `Player ${player.userId}`);
      
      const cardsList = player.playArea.map(card => this.cardShortName(card)).join('\n');
      playAreaEmbed.addFields({
        name: playerName,
        value: cardsList || 'No cards',
        inline: true
      });
    }

    // Generate consolidated image
    const consolidatedAttachment = await this.generateConsolidatedPlayAreaImage(playersWithPlayAreas, guild);
    
    if (consolidatedAttachment) {
      playAreaEmbed.setImage(`attachment://${consolidatedAttachment.name}`);
    }

         return { 
       embeds: [playAreaEmbed], 
       attachments: consolidatedAttachment ? [consolidatedAttachment] : [] 
     };
   }

  /**
   * Generates a consolidated image showing all players' play areas
   * @param {Array} playersWithPlayAreas - Array of players who have play areas
   * @param {Object} guild - The Discord guild object
   * @returns {Promise<AttachmentBuilder|null>} The consolidated image attachment
   */
  static async generateConsolidatedPlayAreaImage(playersWithPlayAreas, guild) {
    if (!playersWithPlayAreas || playersWithPlayAreas.length === 0) {
      return null;
    }

    const cardWidth = 200;
    const avatarSize = 40;
    const nameWidth = 200;
    const padding = 20;
    const rowSpacing = 10;

    // Calculate canvas dimensions
    let maxCardsInRow = 0;
    let totalHeight = padding;

    for (const player of playersWithPlayAreas) {
      maxCardsInRow = Math.max(maxCardsInRow, player.playArea.length);
      
      // Calculate row height based on tallest card in this player's play area
      let maxCardHeight = 0;
      for (const card of player.playArea) {
        if (card.url) {
          try {
            const cardImage = await loadImage(card.url);
            const cardHeight = (cardWidth / cardImage.width) * cardImage.height;
            maxCardHeight = Math.max(maxCardHeight, cardHeight);
          } catch (error) {
            // If image fails to load, use default height
            maxCardHeight = Math.max(maxCardHeight, 280); // default card height
          }
        }
      }
      
      const rowHeight = Math.max(maxCardHeight, avatarSize);
      totalHeight += rowHeight + rowSpacing;
    }

    const canvasWidth = nameWidth + avatarSize + padding + (maxCardsInRow * cardWidth) + padding;
    const canvas = createCanvas(canvasWidth, totalHeight);
    const ctx = canvas.getContext("2d");
    ctx.textDrawingMode = "glyph";

    // Set background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, totalHeight);

    let currentY = padding;

    for (const player of playersWithPlayAreas) {
      const member = guild.members.cache.get(player.userId);
      const playerName = member ? member.displayName : (player.name || `Player ${player.userId}`);

      // Calculate row height for this player
      let maxCardHeight = 0;
      const cardImages = [];
      
      for (const card of player.playArea) {
        if (card.url) {
          try {
            const cardImage = await loadImage(card.url);
            const cardHeight = (cardWidth / cardImage.width) * cardImage.height;
            maxCardHeight = Math.max(maxCardHeight, cardHeight);
            cardImages.push({ image: cardImage, height: cardHeight });
          } catch (error) {
            console.error(`Failed to load card image: ${card.url}`);
            maxCardHeight = Math.max(maxCardHeight, 280);
            cardImages.push(null);
          }
        } else {
          cardImages.push(null);
        }
      }

      const rowHeight = Math.max(maxCardHeight, avatarSize);

      // Draw player avatar if available
      let currentX = padding;
      if (member && member.user.displayAvatarURL) {
        try {
          const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 128 });
          const avatarImage = await loadImage(avatarUrl);
          
          // Draw circular avatar
          ctx.save();
          ctx.beginPath();
          ctx.arc(currentX + avatarSize/2, currentY + rowHeight/2, avatarSize/2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatarImage, currentX, currentY + (rowHeight - avatarSize)/2, avatarSize, avatarSize);
          ctx.restore();
        } catch (error) {
          console.error(`Failed to load avatar for ${playerName}`);
        }
      }
      currentX += avatarSize + 10;

      // Draw player name
      ctx.fillStyle = player.color || "#000000";
      ctx.font = "bold 24px Open Sans";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${playerName}:`, currentX, currentY + rowHeight/2);
      
      currentX += nameWidth;

      // Draw cards
      for (let i = 0; i < player.playArea.length; i++) {
        const cardImageData = cardImages[i];
        if (cardImageData) {
          const cardY = currentY + (rowHeight - cardImageData.height) / 2;
          ctx.drawImage(cardImageData.image, currentX, cardY, cardWidth, cardImageData.height);
        } else {
          // Draw placeholder for missing card image
          ctx.fillStyle = "#cccccc";
          ctx.fillRect(currentX, currentY + (rowHeight - 280) / 2, cardWidth, 280);
          ctx.fillStyle = "#000000";
          ctx.font = "16px Open Sans";
          ctx.textAlign = "center";
          ctx.fillText("No Image", currentX + cardWidth/2, currentY + rowHeight/2);
        }
        currentX += cardWidth + 5; // Small spacing between cards
      }

      currentY += rowHeight + rowSpacing;
    }

    const attachmentName = `consolidated-playareas-${Date.now()}.png`;
    return new AttachmentBuilder(canvas.toBuffer(), { name: attachmentName });
  }

  /**
   * Generates embeds and attachments for all players' play areas
   * @param {Object} gameData - The game data
   * @param {Object} guild - The Discord guild object
   * @returns {Object} Object containing embeds and attachments arrays
   */
  static async generatePlayAreaEmbedsAndAttachments(gameData, guild) {
    const playAreaEmbeds = [];
    const playAreaAttachments = [];

    for (const player of gameData.players) {
      if (player.playArea && player.playArea.length > 0) {
        const member = guild.members.cache.get(player.userId);
        const playerName = member ? member.displayName : (player.name || `Player ${player.userId}`);

        const playAreaEmbed = new EmbedBuilder()
          .setColor(player.color || 386945) // Use player color or a default
          .setTitle(`${playerName}'s Play Area`);
          // Description will be set by genericCardZoneDisplay via fields.
          // If you want a general description above the fields, set it here.

        // genericCardZoneDisplay will add fields for text and set the image on the embed
        const playAreaImgAttachment = await this.genericCardZoneDisplay(
          player.playArea,
          playAreaEmbed,
          "Current Cards", // Field title for the list of cards
          `PlayArea-${player.userId}` // Attachment name prefix
        );

        if (playAreaImgAttachment) {
          playAreaAttachments.push(playAreaImgAttachment);
        }
        // Only add the embed if it has fields (i.e., cards were actually processed by genericCardZoneDisplay)
        if (playAreaEmbed.data.fields && playAreaEmbed.data.fields.length > 0) {
            playAreaEmbeds.push(playAreaEmbed);
        }
      }
    }

    return { embeds: playAreaEmbeds, attachments: playAreaAttachments };
  }

  static formatPlayAreaText(player) {
    if (!player || !player.playArea || player.playArea.length === 0) {
      return ""; // Return empty string if no play area or empty, so it can be conditionally added
    }

    let playAreaString = "**Play Area:**\n";
    player.playArea.forEach((card, index) => {
      // Using cardLongName for more detail, fallback to shortName or just name
      let cardNameFormatted;
      if (typeof this.cardLongName === 'function') {
        cardNameFormatted = this.cardLongName(card);
      } else if (typeof this.cardShortName === 'function') {
        cardNameFormatted = this.cardShortName(card);
      } else {
        cardNameFormatted = card.name || `Unnamed Card (ID: ${card.id})`;
      }
      playAreaString += `${index + 1}. ${cardNameFormatted}\n`;
    });
    return playAreaString;
  }
}

module.exports = GameFormatter;


