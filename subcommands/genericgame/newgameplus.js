const GameDB = require("../../db/anygame.js");
const GameHelper = require('../../modules/GlobalGameHelper');
const { cloneDeep, shuffle, sample } = require("lodash");
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
      await bgg.LoadEmbeds(BoardGameGeek.DetailsEnum.ALLPLUS);

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
      await GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {
        content: content
      });

      if (bgg.otherAttachments.length > 0) {
        await interaction.followUp({
          files: bgg.otherAttachments,
        });
      }

      // Check for skill issue players
      const skillIssuePlayers = ['548570412959662080', '319310123816321024', '462273988337598477'];
      const targetPlayers = players.filter(p => skillIssuePlayers.includes(p.id));

      if (targetPlayers.length > 0) {
        const targetPlayer = sample(targetPlayers);
        const messages = [
          `⚠️ **SYSTEM ALERT** A critical "Skill Issue" has been detected for @user. According to [Issue #51](https://github.com/furtivespy/games-discord-bot/issues/51), the difficulty settings have been lowered to *Very Easy* for this player. Please do not be alarmed if they still lose; we are doing our best with the hardware provided.`,
          `🐛 **Known Bug #51 Detected** \n**Player:** @user \n**Severity:** Critical \n**Description:** User is unable to secure a victory under standard conditions. \n**Workaround:** Opponents are advised to play with their monitors off to ensure a fair match. See full report: https://github.com/furtivespy/games-discord-bot/issues/51`,
          `🚑 **Emotional Support Request** @user has formally requested a handicap due to... "unforeseen circumstances" (see: [The Complaint Log](https://github.com/furtivespy/games-discord-bot/issues/51)). To prevent a rage-quit event, please consider letting them win this one. Their ego is currently holding on by a thread.`,
          `🏆 **Pre-Game Announcement** We are all winners here! But especially @user, who really, really needs a win today. Per the terms of [Issue #51](https://github.com/furtivespy/games-discord-bot/issues/51), the bot has been instructed to look the other way if they cheat. Let's just let them have this moment, okay team?`,
          `🎲 **RNG Modification Loaded** @user has complained that the bot is rigged against them. To correct this, I have now rigged the bot in their favor. If they still lose after this adjustment, it is legally no longer my fault. Reference: https://github.com/furtivespy/games-discord-bot/issues/51`,
          `I have been legally mandated to inform you that @user is "trying their best." ||They aren't very good, but they are trying.|| Context: https://github.com/furtivespy/games-discord-bot/issues/51`
        ];

        const message = sample(messages).replace(/@user/g, `<@${targetPlayer.id}>`);

        await interaction.followUp({
          content: message
        });
      }
    }
  }
}

module.exports = new NewGame();