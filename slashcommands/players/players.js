const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const Add = require(`../../subcommands/players/add`)
const Remove = require(`../../subcommands/players/remove`)
const First = require(`../../subcommands/players/first`)
const Color = require(`../../subcommands/players/color`)
const ColorAll = require(`../../subcommands/players/colorall`)
const Score = require('../../subcommands/players/score.js') // Added import for Score
const Help = require('../../subcommands/players/help.js')

class Players extends SlashCommand {
    constructor(client){
        super(client, {
            name: "players",
            description: "Player management commands",
            usage: "players <subcommand>",
            enabled: true,
            permLevel: "User"
          })
		  this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription("Player management commands")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("help")
                    .setDescription("Show help for the /players commands")
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("add")
                    .setDescription("Add a new player to the current game")
                    .addUserOption(option =>
                        option.setName("player")
                        .setDescription("The player to add to the game")
                        .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("remove")
                    .setDescription("Remove a player from the current game")
                    .addUserOption(option =>
                        option.setName("player")
                        .setDescription("The player to remove from the game")
                        .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("first")
                    .setDescription("Set the first player in the game")
                    .addUserOption(option =>
                        option
                            .setName("player")
                            .setDescription("The player to set as first player")
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("color")
                    .setDescription("Set the color for a player")
                    .addUserOption(option =>
                        option.setName("player")
                        .setDescription("The player to set the color for")
                        .setRequired(true)
                    )
                    .addStringOption(option =>
                        option.setName("color")
                        .setDescription("The color to set (e.g., #FF0000 or red)")
                        .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("colorall")
                    .setDescription("Set the color for all players at once")
            )
            .addSubcommand(subcommand => // Added subcommand definition for score
                subcommand
                    .setName("score")
                    .setDescription("Set a player's score. Defaults to the command user if no player is specified.")
                    .addStringOption(option =>
                        option.setName("score")
                        .setDescription("The score to set")
                        .setRequired(true)
                    )
                    .addUserOption(option =>
                        option.setName("player")
                        .setDescription("The player to set the score for (optional, defaults to you)")
                        .setRequired(false)
                    )
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
                case "first":
                    await First.execute(interaction, this.client)
                    break
                case "color":
                    await Color.execute(interaction, this.client)
                    break
                case "colorall":
                    await ColorAll.execute(interaction, this.client)
                    break
                case "score": // Added case for score
                    await Score.execute(interaction, this.client)
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

module.exports = Players
