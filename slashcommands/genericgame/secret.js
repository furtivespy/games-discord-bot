const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const GameDB = require('../../db/anygame.js')
const Add = require(`../../subcommands/secret/add`)
const Check = require(`../../subcommands/secret/check`)
const Reveal = require(`../../subcommands/secret/reveal`)
const Help = require('../../subcommands/secret/help.js')

class Secret extends SlashCommand {
    constructor(client){
        super(client, {
            name: "secret",
            description: "secret",
            usage: "secret",
            enabled: true,
            permLevel: "User"
          })
		  this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription("Secret Stuff")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("help")
                    .setDescription("Show help for the /secret commands 🤫")
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("add")
                    .setDescription("Add/edit your secret hidden information here")
                    .addStringOption(option => option.setName("secret").setDescription("Info to be saved until the reveal").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("check")
                    .setDescription("Check your current secret info")
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("reveal")
                    .setDescription("Reveals all the secrets")
                    .addStringOption(option => option.setName('confirm').setDescription('Type "reveal" to confirm secrets reveal').setRequired(true))
                )
    }

    async execute(interaction) {
        try {
            switch (interaction.options.getSubcommand()) {
                case "add":
                    await Add.execute(interaction, this.client)
                    break
                case "check":
                    await Check.execute(interaction, this.client)
                    break
                case "reveal":
                    await Reveal.execute(interaction, this.client)
                    break
                case "help":
                    await Help.execute(interaction, this.client)
                    break
                default:
                    await interaction.reply({ content: "Something Went Wrong!?!?!?", ephemeral: true })
            }
            
            
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Secret