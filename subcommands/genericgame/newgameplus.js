const GameDB = require("../../db/anygame.js");
const GameHelper = require('../../modules/GlobalGameHelper');
const { cloneDeep, shuffle } = require("lodash");
const GameStatusHelper = require('../../modules/GameStatusHelper');
const fetch = require("node-fetch");
const BoardGameGeek = require('../../modules/BoardGameGeek');

class NewGame {
  async execute(interaction, client) {
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
          },
        }
      );
      let games = await results.json();
      
      await interaction.respond(
        games.items.map((gameItem) => ({
          name: `${gameItem.name.substring(0, 95)} (${gameItem.yearpublished})`.substring(0, 100),
          value: gameItem.objectid,
        }))
      );
      return;
    }

    if (!search || isNaN(search)){
      await interaction.reply({
        content: `Please provide a game name or ID from the available options.`,
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();
    let gameData = await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId);

    if (gameData && !gameData.isdeleted) {
      gameData.bggGameId = search;
      try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        GameHelper.recordMove(
          gameData,
          interaction.user,
          GameDB.ACTION_CATEGORIES.GAME,
          'bgg_link',
          `${actorDisplayName} linked the game to BGG ID: ${search}`,
          { bggGameId: search }
        )
      } catch (error) {
        console.warn('Failed to record BGG link action in history:', error)
      }
      
      await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
      
      await interaction.editReply({
        content: `There is an existing game in this channel. I've assigned the BGG ID, but did not change players.`,
        ephemeral: true,
      });
    } else {
      gameData = Object.assign({}, cloneDeep(GameDB.defaultGameData));
      gameData.bggGameId = search;
      let players = [];

      for (let i = 1; i <= 8; i++) {
          const playerUser = interaction.options.getUser(`player${i}`);
          if (playerUser) players.push(playerUser);
      }

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

      try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        GameHelper.recordMove(
          gameData,
          interaction.user,
          GameDB.ACTION_CATEGORIES.GAME,
          GameDB.ACTION_TYPES.CREATE,
          `${actorDisplayName} created a new game with ${players.length} player(s)`,
          { playerCount: players.length, bggGameId: search }
        )
      } catch (error) {
        console.warn('Failed to record game creation action in history:', error)
      }

      // Save game data before sending status messages
      await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

      await interaction.editReply({
        content: `New Game Created!`,
        embeds: bgg.embeds,
        files: bgg.attachments,
      });

      // Game Status Logic using the helper
      const publicUpdateResult = await GameStatusHelper.sendPublicStatusUpdate(interaction.channel, client, gameData, {
        content: content,
        // Since this is a followup, we need to pass the interaction object to the helper
        // This is a slight modification to the helper to handle followups
        interaction: interaction
      });

      if (publicUpdateResult) {
          gameData.lastStatusMessageId = publicUpdateResult.lastStatusMessageId;
          gameData.lastStatusMessageTimestamp = publicUpdateResult.lastStatusMessageTimestamp;
          await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
      }

      if (bgg.otherAttachments.length > 0) {
        await interaction.followUp({
          files: bgg.otherAttachments,
        });
      }
    }
  }
}

module.exports = new NewGame();