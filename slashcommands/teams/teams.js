const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const Roster = require(`../../subcommands/teams/roster`)
const Color = require(`../../subcommands/teams/color`)
const JoinTeam = require(`../../subcommands/teams/jointeam`)
const Randomize = require(`../../subcommands/teams/randomize`)
const Help = require(`../../subcommands/teams/help`)

class Teams extends SlashCommand {
    constructor(client){
        super(client, {
            name: "team",
            description: "Team management commands",
            usage: "team <subcommand>",
            enabled: true,
            permLevel: "User"
          })
		  this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription("Team management commands")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("help")
                    .setDescription("Show help for the /team commands")
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("roster")
                    .setDescription("Set up team names via modal (up to 5 teams)")
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("color")
                    .setDescription("Set the color for a team")
                    .addStringOption(option =>
                        option.setName("team")
                        .setDescription("The team to set the color for")
                        .setRequired(true)
                        .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option.setName("color")
                        .setDescription("The color to set (e.g., #FF0000 or red)")
                        .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("jointeam")
                    .setDescription("Assign a player to a team")
                    .addStringOption(option =>
                        option.setName("team")
                        .setDescription("The team to join")
                        .setRequired(true)
                        .setAutocomplete(true)
                    )
                    .addUserOption(option =>
                        option.setName("player")
                        .setDescription("The player to assign (optional, defaults to you)")
                        .setRequired(false)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("randomize")
                    .setDescription("Randomly distribute all players across existing teams")
            )
    }

    async execute(interaction) {
        try {
            // Check if this is an autocomplete interaction
            if (interaction.isAutocomplete()) {
                return await this.handleAutocomplete(interaction)
            }

            // Handle regular command execution
            switch (interaction.options.getSubcommand()) {
                case "roster":
                    await Roster.execute(interaction, this.client)
                    break
                case "color":
                    await Color.execute(interaction, this.client)
                    break
                case "jointeam":
                    await JoinTeam.execute(interaction, this.client)
                    break
                case "randomize":
                    await Randomize.execute(interaction, this.client)
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

    async handleAutocomplete(interaction) {
        try {
            const GameHelper = require('../../modules/GlobalGameHelper')
            const gameData = await GameHelper.getGameData(this.client, interaction)
            
            if (gameData.isdeleted || !gameData.teams || gameData.teams.length === 0) {
                await interaction.respond([])
                return
            }

            const focusedOption = interaction.options.getFocused(true)
            
            if (focusedOption.name === 'team') {
                const teams = gameData.teams
                    .filter(team => team.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25)
                    .map(team => ({ name: team.name, value: team.id }))
                
                await interaction.respond(teams)
            }
        } catch (e) {
            this.client.logger.log(e, 'error')
            await interaction.respond([])
        }
    }
}

module.exports = Teams

