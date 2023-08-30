const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')
const fetch = require("node-fetch");
const { nanoid } = require('nanoid')

class AddLink {
    async execute(interaction, client) {
  
      const search = interaction.options.getString("game");
      if (interaction.isAutocomplete()) {
        if (!search) {
          await interaction.respond([]);
          return;
        }
        let query = new URLSearchParams();
        query.set("q", search);
        query.set("nosession", 1);
        query.set("showcount", 20);
        let results = await fetch(
          `https://boardgamegeek.com/search/boardgame?${query.toString()}`,
          {
            headers: {
              accept: "application/json, text/plain, */*",
              "accept-language": "en-US,en;q=0.9",
              "sec-ch-ua":
                '"Google Chrome";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"Windows"',
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
              Referer: "https://boardgamegeek.com/",
              "Referrer-Policy": "strict-origin-when-cross-origin",
            },
          }
        );
        let games = await results.json();
        //console.log(JSON.stringify(games))
        await interaction.respond(
          games.items.map((gameItem) => ({
            name: `${gameItem.ordtitle} (${gameItem.yearpublished})`,
            value: gameItem.objectid,
          }))
        );
      } else {
        if (isNaN(search)){
          await interaction.reply({
            content: `Please choose from the available options`,
            ephemeral: true
          })
          return
        }

        let gameData = Object.assign(
          {},
          cloneDeep(GameDB.defaultBGGGameData),
          await client.getGameDataV2(interaction.guildId, 'bgg', search)
        );

        const name = interaction.options.getString("name");
        const url = interaction.options.getString("url");

        gameData.links.push({id: nanoid(), name: name, url: url})
        await client.setGameDataV2(interaction.guildId, "bgg", search, gameData)

        await interaction.reply({
          content: `Added link [${name}](${url})`,
          ephemeral: true
        })
      }

    }
}


module.exports = new AddLink()