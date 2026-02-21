const SlashCommand = require("../../base/SlashCommand.js");
const {SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags} = require("discord.js");
const SampleSize = require('lodash/sampleSize');

class Choose extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "choose",
      description: "Choose Randomly",
      usage: "role",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption((option) =>
        option
          .setName("options")
          .setDescription('Comma separated list of options to choose from. e.g. "option1, option2, option3"')
          .setRequired(true)
      );
  }

  async execute(interaction) {
    try {
      
      let choices = interaction.options.getString("options");
      let choiceArray = choices.split(",").map(option => option.trim());;

      const select = new StringSelectMenuBuilder()
            .setCustomId('count')
            .addOptions(
              Array.from({length: Math.min(choiceArray.length, 10) }, (_, i) => {
                return {label: `${i+1}`, value: `${i+1}`, default: i == 0}
              })
            )
      const row = new ActionRowBuilder()
          .addComponents(select)
      const publicButton = new ButtonBuilder()
          .setCustomId('public')
          .setLabel('Pick Publicly')
          .setStyle(ButtonStyle.Success)
      const privateButton = new ButtonBuilder()
          .setCustomId('private')
          .setLabel('Pick in Spoilers')
          .setStyle(ButtonStyle.Danger)
      const row2 = new ActionRowBuilder()
          .addComponents(publicButton, privateButton)
      
      const ChooseOptions = await interaction.reply({ content: `Choose how many to pick:`, components: [row, row2], flags: MessageFlags.Ephemeral, fetchReply: true })
      let selectedCount = 1
      const selectCollect = ChooseOptions.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 120000 })
      const buttonCollect = ChooseOptions.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 })

      selectCollect.on('collect', async i => {
        selectedCount = i.values[0]
        i.deferUpdate();
      })

      buttonCollect.on('collect', async i => {
        if (i.customId === 'public'){
          let message = `${interaction.member} Made `
          message += (selectedCount == 1) ? "1 selection: " : `${selectedCount} selections: `
          message += `${SampleSize(choiceArray, selectedCount).join(", ")}`
          message += ` from ${choices}`
          await interaction.editReply({ content: 'Selected!', components: [] })
          await interaction.followUp({ content: message })
        } else {
          let message = `${interaction.member} Made `
          message += (selectedCount == 1) ? "1 selection: " : `${selectedCount} selections: `
          message += `|| ${SampleSize(choiceArray, selectedCount).join(", ")} ||`
          message += `from || ${choices} ||`
          await interaction.editReply({ content: 'Selected!', components: [] })
          await interaction.followUp({ content: message })
        }
      })

    } catch (e) {
      this.client.logger.log(e, "error");
    }
  }
}

module.exports = Choose;
