const GameDB = require("../../db/anygame.js");
const GameHelper = require('../../modules/GlobalGameHelper');
const { cloneDeep, shuffle } = require("lodash");
const Formatter = require("../../modules/GameFormatter");
const { EmbedBuilder } = require('discord.js');
const { XMLParser } = require('fast-xml-parser');
const fetch = require("node-fetch");
const BoardGameGeek = require('../../modules/BoardGameGeek');

class NewGame {
  async execute(interaction, client) {
    let gameData = Object.assign(
      {},
      cloneDeep(GameDB.defaultGameData),
      await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
    );

    const search = interaction.options.getString("game");
    if (interaction.isAutocomplete()) {
      if (!search) {
        await interaction.respond([]);
        return;
      }
      let query = new URLSearchParams();
      query.set('q', search);
      query.set('nosession', 1);
      query.set('showcount', 20);
      let results = await fetch(
        `https://boardgamegeek.com/search/boardgame?${query.toString()}`,
        {
          headers: {
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'sec-ch-ua': '"Google Chrome";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            Referer: 'https://boardgamegeek.com/',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
          },
        }
      );
      let games = await results.json();
      
      await interaction.respond(
        games.items.map((gameItem) => ({
          name: `${gameItem.name} (${gameItem.yearpublished})`,
          value: gameItem.objectid,
        }))
      );
      return;
    }

    if (!search) {
      await interaction.reply({
        content: `Please provide a game name or ID`,
        ephemeral: true
      });
      return;
    }

    if (isNaN(search)){
      await interaction.reply({
        content: `Please choose from the available options`,
        ephemeral: true
      });
      return;
    }

    if (!gameData.isdeleted) {
      //convert to new game plus!
      gameData.bggGameId = search;
      
      // Record this action in game history
      try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        GameHelper.recordMove(
          gameData,
          interaction.user,
          GameDB.ACTION_CATEGORIES.GAME,
          GameDB.ACTION_TYPES.BGG_LINK,
          `${actorDisplayName} linked the game to BGG: ${gameData.name}`,
          {
            bggGameId: search,
            action: 'bgg_link_added'
          },
          actorDisplayName
        )
      } catch (error) {
        console.warn('Failed to record BGG link action in history:', error)
      }
      
      await client.setGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId,
        gameData
      );
      
      await interaction.reply({
        content: `There is an existing game in this channel. I've assigned the game, but did not change players.`,
        ephemeral: true,
      });
    } else {
      await interaction.deferReply();

      gameData = Object.assign({}, cloneDeep(GameDB.defaultGameData));
      gameData.bggGameId = search;
      let players = [];

      if (interaction.options.getUser("player1"))
        players.push(interaction.options.getUser("player1"));
      if (interaction.options.getUser("player2"))
        players.push(interaction.options.getUser("player2"));
      if (interaction.options.getUser("player3"))
        players.push(interaction.options.getUser("player3"));
      if (interaction.options.getUser("player4"))
        players.push(interaction.options.getUser("player4"));
      if (interaction.options.getUser("player5"))
        players.push(interaction.options.getUser("player5"));
      if (interaction.options.getUser("player6"))
        players.push(interaction.options.getUser("player6"));
      if (interaction.options.getUser("player7"))
        players.push(interaction.options.getUser("player7"));
      if (interaction.options.getUser("player8"))
        players.push(interaction.options.getUser("player8"));

      let content = `Player Order Randomized!\n`;
      gameData.isdeleted = false;
      gameData.name = interaction.channel.name;
      players = shuffle(players);
      for (let i = 0; i < players.length; i++) {
        gameData.players.push(
          Object.assign({}, cloneDeep(GameDB.defaultPlayer), {
            guildId: interaction.guild.id,
            userId: players[i].id,
            order: i,
            name: players[i].username,
          })
        );
        content += `${players[i]} `;
      }

      let bgg = await BoardGameGeek.CreateAndLoad(search, client, interaction);
      await bgg.LoadEmbeds(BoardGameGeek.DetailsEnum.ALL);

      // Record this action in game history
      try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        GameHelper.recordMove(
          gameData,
          interaction.user,
          GameDB.ACTION_CATEGORIES.GAME,
          GameDB.ACTION_TYPES.CREATE,
          `${actorDisplayName} created a new game with ${players.length} player${players.length !== 1 ? 's' : ''}`,
          {
            playerCount: players.length,
            bggGameId: search,
            players: players.map(p => ({ userId: p.id, username: p.username }))
          },
          actorDisplayName
        )
      } catch (error) {
        console.warn('Failed to record game creation action in history:', error)
      }

      await client.setGameDataV2(
        interaction.guildId,
        "game",
        interaction.channelId,
        gameData
      );

      // First send the BGG game info
      await interaction.editReply({
        content: `New Game Created!`,
        embeds: bgg.embeds,
        files: bgg.attachments,
      });

      // Then send the game status
      await interaction.followUp(
        await Formatter.createGameStatusReply(gameData, interaction.guild, client.user.id, {
          content: content
        })
      );

      // Finally send any other attachments
      if (bgg.otherAttachments.length > 0) {
        await interaction.followUp({
          files: bgg.otherAttachments,
        });
      }
    }
  }
}

module.exports = new NewGame();
