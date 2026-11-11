const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const { cloneDeep } = require('lodash')
const { nanoid } = require('nanoid')
const BoardGameGeek = require('../../modules/BoardGameGeek')

class AddLink {
    async execute(interaction, client) {
  
      const search = interaction.options.getString("game");
      if (interaction.isAutocomplete()) {
        await BoardGameGeek.respondAutocomplete(interaction, client.config.BGGToken);
        return;
      } else {
        if (isNaN(search)){
          await interaction.reply({
            content: `Please choose from the available options`,
            flags: MessageFlags.Ephemeral
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
        console.log(gameData)

        await interaction.reply({
          content: `Added link [${name}](${url})`,
          flags: MessageFlags.Ephemeral
        })
      }

    }
}


module.exports = new AddLink()