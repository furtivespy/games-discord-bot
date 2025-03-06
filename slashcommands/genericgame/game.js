const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const AddLink = require(`../../subcommands/genericgame/addlink`)
const AddImage = require(`../../subcommands/genericgame/addimage`)
const NewGamePlus = require(`../../subcommands/genericgame/newgameplus`)
const Next = require(`../../subcommands/genericgame/next`)
const Delete = require(`../../subcommands/genericgame/delete`)
const RemoveLink = require(`../../subcommands/genericgame/removelink`)
const RemoveImage = require(`../../subcommands/genericgame/removeimage`)
const Status = require(`../../subcommands/genericgame/status`)
const Winner = require(`../../subcommands/genericgame/winner`)
const Test = require(`../../subcommands/genericgame/test`)
const Reverse = require(`../../subcommands/genericgame/reverse`)
const AddPlayer = require(`../../subcommands/genericgame/addplayer`)
const RemovePlayer = require(`../../subcommands/genericgame/removeplayer`)
const AddScore = require(`../../subcommands/genericgame/addscore`)
const FirstPlayer = require(`../../subcommands/genericgame/firstplayer`)

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
            /*
            .addSubcommand(subcommand =>
                subcommand
                    .setName("newgame")
                    .setDescription("Start a new game in channel")
                    .addUserOption(option => option.setName("player1").setDescription("first player to add").setRequired(true))
                    .addUserOption(option => option.setName("player2").setDescription("second player to add"))
                    .addUserOption(option => option.setName("player3").setDescription("third player to add"))
                    .addUserOption(option => option.setName("player4").setDescription("fourth player to add"))
                    .addUserOption(option => option.setName("player5").setDescription("fifth player to add"))
                    .addUserOption(option => option.setName("player6").setDescription("sixth player to add"))
                    .addUserOption(option => option.setName("player7").setDescription("seventh player to add"))
                    .addUserOption(option => option.setName("player8").setDescription("eighth player to add"))
                )
                */
            .addSubcommand(subcommand =>
                subcommand
                    .setName("newgame")
                    .setDescription("Start a new game in channel")
                    .addStringOption((option) =>
                        option
                        .setName("game")
                        .setDescription("The game being played")
                        .setAutocomplete(true)
                        .setRequired(true)
                    )
                    .addUserOption(option => option.setName("player1").setDescription("first player to add").setRequired(true))
                    .addUserOption(option => option.setName("player2").setDescription("second player to add"))
                    .addUserOption(option => option.setName("player3").setDescription("third player to add"))
                    .addUserOption(option => option.setName("player4").setDescription("fourth player to add"))
                    .addUserOption(option => option.setName("player5").setDescription("fifth player to add"))
                    .addUserOption(option => option.setName("player6").setDescription("sixth player to add"))
                    .addUserOption(option => option.setName("player7").setDescription("seventh player to add"))
                    .addUserOption(option => option.setName("player8").setDescription("eighth player to add"))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("next")
                    .setDescription("Notify the next player in turn order")
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("reverse")
                    .setDescription("Toggle the turn order of the game (for /game next command)")
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
                    .addStringOption(option => option.setName('confirm').setDescription('Type "delete" to confirm delete - cannot be undone').setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("winner")
                    .setDescription("mark someone as game winner")
                    .addUserOption(option => option.setName("player1").setDescription("The winner of this channel\'s game!").setRequired(true))
                    .addUserOption(option => option.setName("player2").setDescription("Another Winner"))
                    .addUserOption(option => option.setName("player3").setDescription("Another Winner"))
                    .addUserOption(option => option.setName("player4").setDescription("Another Winner"))
                    .addUserOption(option => option.setName("player5").setDescription("Another Winner"))
                    .addUserOption(option => option.setName("player6").setDescription("Another Winner"))
                    .addUserOption(option => option.setName("player7").setDescription("Another Winner"))
                    .addUserOption(option => option.setName("player8").setDescription("Another Winner"))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("addlink")
                    .setDescription("Add a useful link for a game - such as a rules file")
                    .addStringOption((option) =>
                        option
                        .setName("game")
                        .setDescription("The game being played")
                        .setAutocomplete(true)
                        .setRequired(true)
                    )
                    .addStringOption((option) => option.setName("name").setDescription("Name of the link").setRequired(true))
                    .addStringOption((option) => option.setName("url").setDescription("URL for the link").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("addimage")
                    .setDescription("Add an image for a game - such as a helper chart or board")
                    .addStringOption((option) =>
                        option
                        .setName("game")
                        .setDescription("The game being played")
                        .setAutocomplete(true)
                        .setRequired(true)
                    )
                    .addStringOption((option) => option.setName("url").setDescription("URL for the image").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("removelink")
                    .setDescription("Remove a useful link for a game - such as a rules file")
                    .addStringOption((option) =>
                        option
                        .setName("game")
                        .setDescription("The game being played")
                        .setAutocomplete(true)
                        .setRequired(true)
                    )
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("removeimage")
                    .setDescription("Remove an image for a game - such as a helper chart or board")
                    .addStringOption((option) =>
                        option
                        .setName("game")
                        .setDescription("The game being played")
                        .setAutocomplete(true)
                        .setRequired(true)
                    )
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("addplayer")
                    .setDescription("Add a new player to the current game")
                    .addUserOption(option => 
                        option.setName("player")
                        .setDescription("The player to add to the game")
                        .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("removeplayer")
                    .setDescription("Remove a player from the current game")
                    .addUserOption(option => 
                        option.setName("player")
                        .setDescription("The player to remove from the game")
                        .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("addscore")
                    .setDescription("Add a score for a player")
                    .addUserOption(option => 
                        option.setName("player")
                        .setDescription("The player to set the score for")
                        .setRequired(true)
                    )
                    .addStringOption(option =>
                        option.setName("score")
                        .setDescription("The score to set")
                        .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("firstplayer")
                    .setDescription("Set the first player in the game")
                    .addUserOption(option =>
                        option
                            .setName("player")
                            .setDescription("The player to set as first player")
                            .setRequired(true)
                    )
            )
                /*
            .addSubcommand(subcommand =>
                subcommand
                    .setName("test")        
                    .setDescription("Testing Bot - db stuff")
                )
                */
                
    }

    async execute(interaction) {
        try {
            switch (interaction.options.getSubcommand()) {
                case "newgame":
                    await NewGamePlus.execute(interaction, this.client)
                    break
                case "newgameplus":
                    await NewGamePlus.execute(interaction, this.client)
                    break
                case "next":
                    await Next.execute(interaction, this.client)
                    break
                case "reverse":
                    await Reverse.execute(interaction, this.client)
                    break
                case "delete":
                    await Delete.execute(interaction, this.client)
                    break
                case "status":
                    await Status.execute(interaction, this.client)
                    break
                case "winner":
                    await Winner.execute(interaction, this.client)
                    break
                case "test":    
                    await Test.execute(interaction, this.client)
                    break
                case "addlink":
                    await AddLink.execute(interaction, this.client)
                    break
                case "addimage":
                    await AddImage.execute(interaction, this.client)
                    break
                case "removelink":
                    await RemoveLink.execute(interaction, this.client)
                    break
                case "removeimage":
                    await RemoveImage.execute(interaction, this.client)
                    break
                case "addplayer":
                    await AddPlayer.execute(interaction, this.client)
                    break
                case "removeplayer":
                    await RemovePlayer.execute(interaction, this.client)
                    break
                case "addscore":
                    await AddScore.execute(interaction, this.client)
                    break
                case "firstplayer":
                    await FirstPlayer.execute(interaction, this.client)
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