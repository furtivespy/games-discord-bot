const { MessageFlags } = require("discord.js");
const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const GameDB = require('../../db/anygame')
const { find } = require('lodash')

const Create = require(`../../subcommands/tokens/create`)
const Remove = require(`../../subcommands/tokens/remove`)
const Check = require(`../../subcommands/tokens/check`)
const Gain = require(`../../subcommands/tokens/gain`)
const Lose = require(`../../subcommands/tokens/lose`)
const Give = require(`../../subcommands/tokens/give`)
const Take = require(`../../subcommands/tokens/take`)
const Reveal = require(`../../subcommands/tokens/reveal`)
const Modify = require(`../../subcommands/tokens/modify.js`);
const Help = require('../../subcommands/tokens/help.js');

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
                    .setName("help")
                    .setDescription("Show help for the /tokens commands 🪙")
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("create")
                    .setDescription("Create a new token type in the game")
                    .addStringOption(option => option.setName("name").setDescription("Name of the token").setRequired(true))
                    .addBooleanOption(option => option.setName("secret").setDescription("Whether the token is secret").setRequired(false))
                    .addStringOption(option => option.setName("description").setDescription("Description of the token").setRequired(false))
                    .addIntegerOption(option => option.setName("cap").setDescription("Maximum number of these tokens allowed in circulation").setRequired(false))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("remove")
                    .setDescription("Remove a token type from the game")
                    .addStringOption(option => 
                        option.setName("name")
                            .setDescription("Name of the token to remove")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("check")
                    .setDescription("Check token counts")
                    .addStringOption(option => 
                        option.setName("name")
                            .setDescription("Name of specific token to check")
                            .setRequired(false)
                            .setAutocomplete(true)
                    )
                    .addBooleanOption(option => option.setName("all").setDescription("Show results to everyone").setRequired(false))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("gain")
                    .setDescription("Gain tokens from the supply")
                    .addStringOption(option => 
                        option.setName("name")
                            .setDescription("Name of the token")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to gain").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("lose")
                    .setDescription("Lose tokens back to the supply")
                    .addStringOption(option => 
                        option.setName("name")
                            .setDescription("Name of the token")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to lose").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("give")
                    .setDescription("Give tokens to another player")
                    .addUserOption(option => option.setName("player").setDescription("Player to give tokens to").setRequired(true))
                    .addStringOption(option => 
                        option.setName("name")
                            .setDescription("Name of the token")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to give").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("take")
                    .setDescription("Take tokens from another player")
                    .addUserOption(option => option.setName("player").setDescription("Player to take tokens from").setRequired(true))
                    .addStringOption(option => 
                        option.setName("name")
                            .setDescription("Name of the token")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addIntegerOption(option => option.setName("amount").setDescription("Amount to take").setRequired(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("reveal")
                    .setDescription("Reveal token information publicly")
                    .addStringOption(option => 
                        option.setName("name")
                            .setDescription("Name of specific token to reveal")
                            .setRequired(false)
                            .setAutocomplete(true)
                    )
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("modify")
                    .setDescription("Modify an existing token's properties")
                    .addStringOption(option =>
                        option.setName("name")
                            .setDescription("Name of the token to modify")
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .addStringOption(option =>
                        option.setName("new_name")
                            .setDescription("New name for the token")
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option.setName("description")
                            .setDescription("New description for the token")
                            .setRequired(false)
                    )
                    .addBooleanOption(option =>
                        option.setName("secret")
                            .setDescription("New secret status for the token (true or false)")
                            .setRequired(false)
                    )
                    .addIntegerOption(option =>
                        option.setName("cap")
                            .setDescription("New numerical cap for the token")
                            .setRequired(false)
                    )
                    .addBooleanOption(option =>
                        option.setName("remove_cap")
                            .setDescription("Set to true to remove the current cap (overrides 'cap' option)")
                            .setRequired(false)
                    )
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
                case "create":
                    await Create.execute(interaction, this.client)
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
                case "reveal":
                    await Reveal.execute(interaction, this.client)
                    break
                case "modify":
                    await Modify.execute(interaction, this.client);
                    break;
                case "help":
                    await Help.execute(interaction, this.client);
                    break;
                default:
                    await interaction.reply({ content: "Something Went Wrong!?!?!", flags: MessageFlags.Ephemeral })
            }
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }

    async handleAutocomplete(interaction) {
        try {
            const gameData = Object.assign(
                {},
                GameDB.defaultGameData,
                await this.client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
            )

            if (gameData.isdeleted || !gameData.tokens) {
                return await interaction.respond([])
            }

            const focusedValue = interaction.options.getFocused().toLowerCase()
            const choices = gameData.tokens
                .filter(token => token.name.toLowerCase().includes(focusedValue))
                .map(token => ({
                    name: token.name,
                    value: token.name
                }))
                .slice(0, 25)

            await interaction.respond(choices)
        } catch (e) {
            this.client.logger.log(e,'error')
            await interaction.respond([])
        }
    }
}

module.exports = Tokens 