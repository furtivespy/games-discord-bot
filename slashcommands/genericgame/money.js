const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');

const Check = require(`../../subcommands/money/check`)
const Pay = require(`../../subcommands/money/pay`)
const Reveal = require(`../../subcommands/money/reveal`)
const Spend = require(`../../subcommands/money/spend`)
const Take = require(`../../subcommands/money/take`)

class Money extends SlashCommand {
    constructor(client){
        super(client, {
            name: "money",
            description: "money",
            usage: "money",
            enabled: true,
            permLevel: "User"
          })
		  this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription("Money Stuff")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("check")
                    .setDescription("Check your current money")
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("pay")
                    .setDescription("Pay money to another player")
                    .addUserOption(option => option.setName("player").setDescription("Player to pay").setRequired(true))
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to pay").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("reveal")
                    .setDescription("Reveals how much money everyone has")
                    .addStringOption(option => option.setName('confirm').setDescription('Type "reveal" to confirm money reveal').setRequired(true))
                )   
            .addSubcommand(subcommand =>
                subcommand
                    .setName("spend")
                    .setDescription("Spend money to buy something")
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to spend").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("take")
                    .setDescription("Take money from the bank/supply")
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to take").setRequired(true))
                )
    }

    async execute(interaction) {
        try {
            switch (interaction.options.getSubcommand()) {
                case "check":
                    await Check.execute(interaction, this.client)
                    break
                case "pay":
                    await Pay.execute(interaction, this.client)
                    break
                case "reveal":
                    await Reveal.execute(interaction, this.client)
                    break
                case "spend": 
                    await Spend.execute(interaction, this.client)
                    break
                case "take":
                    await Take.execute(interaction, this.client)
                    break
                default:
                    await interaction.reply({ content: "Something Went Wrong!?!?!?", ephemeral: true })
            }
            
            
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Money