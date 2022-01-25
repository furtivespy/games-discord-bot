const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const GameDB = require('../../db/anygame.js')
const NewGame = require(`../../subcommands/genericgame/newgame`)
const Delete = require(`../../subcommands/genericgame/delete`)
const Status = require(`../../subcommands/genericgame/status`)

class Game extends SlashCommand {
    constructor(client){
        super(client, {
            name: "game",
            description: "game",
            usage: "game",
            enabled: true,
            permLevel: "User"
          })
		  this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription("Game Stuff")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("newgame")
                    .setDescription("Start a new game in channel")
                    .addUserOption(option => option.setName("player1").setDescription("first player to add").setRequired(true))
                    .addUserOption(option => option.setName("player2").setDescription("second player to add"))
                    .addUserOption(option => option.setName("player3").setDescription("third player to add"))
                    .addUserOption(option => option.setName("player4").setDescription("fourth player to add"))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("status")
                    .setDescription("Get current game status")
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("delete")
                    .setDescription("Remove this channels current game")
                    .addStringOption(option => option.setName('delete').setDescription('Type "delete" to confirm delete - cannot be undone').setRequired(true))
                )
    }

    async execute(interaction) {
        try {
            switch (interaction.options.getSubcommand()) {
                case "newgame":
                    await NewGame.execute(interaction, this.client)
                    break
                case "delete":
                    await Delete.execute(interaction, this.client)
                    break
                case "status":
                    await Status.execute(interaction, this.client)
                    break
                default:
                    await interaction.reply({ content: "Something Went Wrong!?!?!?", ephemeral: true })
            }
            
            
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Game