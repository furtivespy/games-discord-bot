const GameDB = require('../../db/anygame.js')
const {cloneDeep, find, findIndex } = require('lodash')
const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags} = require('discord.js')
const BoardGameGeek = require('../../modules/BoardGameGeek')

class RemoveLink {
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

        if (gameData.links.length < 1){
          await interaction.reply({ content: `There are no links to remove.`, flags: MessageFlags.Ephemeral })
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

        const LinksSelected = await interaction.reply({ content: `Choose Links to Remove:`, components: [row], flags: MessageFlags.Ephemeral, fetchReply: true })
        
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
          flags: MessageFlags.Ephemeral
        })
      }

    }
}


module.exports = new RemoveLink()