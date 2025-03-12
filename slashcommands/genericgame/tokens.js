const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');

const Add = require(`../../subcommands/tokens/add`)
const Remove = require(`../../subcommands/tokens/remove`)
const Check = require(`../../subcommands/tokens/check`)
const Gain = require(`../../subcommands/tokens/gain`)
const Lose = require(`../../subcommands/tokens/lose`)
const Give = require(`../../subcommands/tokens/give`)
const Take = require(`../../subcommands/tokens/take`)

class Tokens extends SlashCommand {
    constructor(client){
        super(client, {
            name: "tokens",
            description: "tokens",
            usage: "tokens",
            enabled: true,
            permLevel: "User"
          })
          this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription("Token Management")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("add")
                    .setDescription("Add a new token type to the game")
                    .addStringOption(option => option.setName("name").setDescription("Name of the token").setRequired(true))
                    .addBooleanOption(option => option.setName("secret").setDescription("Whether the token is secret").setRequired(false))
                    .addStringOption(option => option.setName("description").setDescription("Description of the token").setRequired(false))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("remove")
                    .setDescription("Remove a token type from the game")
                    .addStringOption(option => option.setName("name").setDescription("Name of the token to remove").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("check")
                    .setDescription("Check token counts")
                    .addStringOption(option => option.setName("name").setDescription("Name of specific token to check").setRequired(false))
                    .addBooleanOption(option => option.setName("all").setDescription("Show results to everyone").setRequired(false))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("gain")
                    .setDescription("Gain tokens from the supply")
                    .addStringOption(option => option.setName("name").setDescription("Name of the token").setRequired(true))
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to gain").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("lose")
                    .setDescription("Lose tokens back to the supply")
                    .addStringOption(option => option.setName("name").setDescription("Name of the token").setRequired(true))
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to lose").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("give")
                    .setDescription("Give tokens to another player")
                    .addUserOption(option => option.setName("player").setDescription("Player to give tokens to").setRequired(true))
                    .addStringOption(option => option.setName("name").setDescription("Name of the token").setRequired(true))
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to give").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("take")
                    .setDescription("Take tokens from another player")
                    .addUserOption(option => option.setName("player").setDescription("Player to take tokens from").setRequired(true))
                    .addStringOption(option => option.setName("name").setDescription("Name of the token").setRequired(true))
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to take").setRequired(true))
                )
    }

    async execute(interaction) {
        try {
            switch (interaction.options.getSubcommand()) {
                case "add":
                    await Add.execute(interaction, this.client)
                    break
                case "remove":
                    await Remove.execute(interaction, this.client)
                    break
                case "check":
                    await Check.execute(interaction, this.client)
                    break
                case "gain":
                    await Gain.execute(interaction, this.client)
                    break
                case "lose":
                    await Lose.execute(interaction, this.client)
                    break
                case "give":
                    await Give.execute(interaction, this.client)
                    break
                case "take":
                    await Take.execute(interaction, this.client)
                    break
                default:
                    await interaction.reply({ content: "Something Went Wrong!?!?!", ephemeral: true })
            }
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Tokens 