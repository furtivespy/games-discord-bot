const GameDB = require('../../db/anygame.js')
const {cloneDeep, find, findIndex } = require('lodash')
const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags} = require('discord.js')
const BoardGameGeek = require('../../modules/BoardGameGeek')

class RemoveImage {
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

        if (gameData.attachments.length < 1){
          await interaction.reply({ content: `There are no attachments to remove.`, flags: MessageFlags.Ephemeral })
          return  
        }
        console.log(gameData.attachments)
        const select = new StringSelectMenuBuilder()
            .setCustomId('images')
            .setPlaceholder('Images to remove')
            .setMinValues(1)
            .setMaxValues(gameData.attachments.length)
            .addOptions(
              gameData.attachments.map(link => 
                ({label: `${link.url.slice(0, 100)}`, value: link.id})
              )  
            )

        const row = new ActionRowBuilder()
            .addComponents(select)

        const LinksSelected = await interaction.reply({ content: `Choose Images to Remove:`, components: [row], flags: MessageFlags.Ephemeral, fetchReply: true })
        
        const filter = i => i.user.id === interaction.user.id && i.customId === 'images'
        let removal = []

        try {
          const collected = await LinksSelected.awaitMessageComponent({ filter, time: 60000 })
          removal = collected.values
        } catch (error) {
          return await interaction.editReply({ content: 'No images selected', components: [] })
        }

        if (removal.length < 1){
            await interaction.editReply({ content: 'No images selected', components: [] })
            return
        } else {
          await interaction.editReply({ content: 'Images Removed!', components: [] })
        }

        let removed = ""
        removal.forEach(lnk => {
          let link = find(gameData.attachments, {id: lnk})
          if (!link) { return }
          removed += `Removed attachments - (${link.url})\n`
          gameData.attachments.splice(findIndex(gameData.attachments, {id: lnk}), 1)
        })

        await client.setGameDataV2(interaction.guildId, "bgg", search, gameData)
        await interaction.followUp({
          content: `Results:\n${removed}`,
          flags: MessageFlags.Ephemeral
        })
      }

    }
}


module.exports = new RemoveImage()