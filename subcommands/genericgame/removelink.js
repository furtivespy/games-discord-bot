const GameDB = require('../../db/anygame.js')
const { cloneDeep, find, findIndex } = require('lodash')
const fetch = require("node-fetch");
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js')

class RemoveLink {
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

        if (gameData.links.length < 1){
          await interaction.reply({ content: `There are no links to remove.`, ephemeral: true })
          return  
        }

        const select = new StringSelectMenuBuilder()
            .setCustomId('links')
            .setPlaceholder('Links to remove')
            .setMinValues(1)
            .setMaxValues(gameData.links.length)
            .addOptions(
              gameData.links.map(link => 
                ({label: link.name, description: link.url, value: link.id})
              )  
            )

        const row = new ActionRowBuilder()
            .addComponents(select)

        const LinksSelected = await interaction.reply({ content: `Choose Links to Remove:`, components: [row], ephemeral: true, fetchReply: true })
        
        const filter = i => i.user.id === interaction.user.id && i.customId === 'links'
        let removal = []

        try {
          const collected = await LinksSelected.awaitMessageComponent({ filter, time: 60000 })
          removal = collected.values
        } catch (error) {
          return await interaction.editReply({ content: 'No links selected', components: [] })
        }

        if (removal.length < 1){
            await interaction.editReply({ content: 'No links selected', components: [] })
            return
        } else {
          await interaction.editReply({ content: 'Links Removed!', components: [] })
        }

        let removed = ""
        removal.forEach(lnk => {
          let link = find(gameData.links, {id: lnk})
          if (!link) { return }
          removed += `Removed link [${link.name}](${link.url})\n`
          gameData.links.splice(findIndex(gameData.links, {id: lnk}), 1)
        })

        await client.setGameDataV2(interaction.guildId, "bgg", search, gameData)
        await interaction.followUp({
          content: `Results:\n${removed}`,
          ephemeral: true
        })
      }

    }
}


module.exports = new RemoveLink()