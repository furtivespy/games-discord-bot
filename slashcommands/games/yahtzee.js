const { MessageFlags } = require("discord.js");
const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const Sample = require('lodash/sample')
const diceSides = [
  "<:die1:790027072998342666>",
  "<:die2:790028311756668960>",
  "<:die3:790028312167841803>",
  "<:die4:790028312348065842>",
  "<:die5:790028312386076713>",
  "<:die6:790028312495128616>",
];

class Yahtzee extends SlashCommand {
    constructor(client){
        super(client, {
            name: "yahtzee",
            description: "Roll some six sided dice",
            usage: "yahtzee",
            enabled: true,
            permLevel: "User"
          })
		  this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription(this.help.description)
            .addIntegerOption(option => option.setName('dice').setDescription('How many dice to roll').setRequired(true))
    }

    async execute(interaction) {
        try {

            let dice = interaction.options.getInteger('dice')

            if (dice > 0 && dice <= 20){
                let results = ``
                for (let i = 0; i < dice; i++){
                    results += `${Sample(diceSides)} `
                }

                await interaction.reply({content: `${results}` })
            } else {
                await interaction.reply({content: `I don't know how to roll that many dice`, flags: MessageFlags.Ephemeral})
            }
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Yahtzee