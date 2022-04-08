const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const GameDB = require('../../db/anygame.js')
const Configure = require('../../subcommands/cards/configuredeck')
const Deal = require('../../subcommands/cards/deal')
const Discard = require(`../../subcommands/cards/discard`)
const DraftDeal = require(`../../subcommands/cards/draftdeal`)
const DraftPass = require(`../../subcommands/cards/draftpass`)
const DraftTake = require(`../../subcommands/cards/drafttake`)
const Draw = require(`../../subcommands/cards/draw`)
const Flip = require(`../../subcommands/cards/flip`)
const NewDeck = require(`../../subcommands/cards/newdeck`)
const Play = require(`../../subcommands/cards/play`)
const Reveal = require(`../../subcommands/cards/reveal`)
const Rturn = require(`../../subcommands/cards/return`)
const Show = require(`../../subcommands/cards/show`)
const Shuffle = require(`../../subcommands/cards/shuffle`)
const Help = require(`../../subcommands/cards/help`)

class Cards extends SlashCommand {
    constructor(client){
        super(client, {
            name: "cards",
            description: "cards",
            usage: "cards",
            enabled: true,
            permLevel: "User"
          })
		  this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription("Card Stuff")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("help")
                    .setDescription("Quick reference for all the /cards commands")
                )
            .addSubcommandGroup(group => 
                group.setName("deck").setDescription("Manage decks of cards")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("new")
                        .setDescription("Add a new deck of cards to the channel")
                        .addStringOption(option => option.setName('name').setDescription('Name of the deck').setRequired(true))
                        .addStringOption(option => option.setName('cardset').setDescription('What set of cards to use').setRequired(true)
                            .addChoices(
                                [
                                    ...GameDB.CurrentCardList,
                                    //[ "Custom from list", "custom" ],
                                    //[ "Custom Empty", "customempty" ]
                                ]
                            ))
                        .addStringOption(option => option.setName('customlist').setDescription('list of cards for the new custom deck. separate with commas'))
                    ) 
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("draw")
                        .setDescription("Draw a card")
                        .addStringOption(option => option.setName('deck').setDescription('Deck to draw from').setAutocomplete(true))
                    ) 
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("configure")
                        .setDescription("Configure a deck (rules etc.)")
                        .addStringOption(option => option.setName('config').setDescription('Option to configure').setRequired(true)
                            .addChoices([["Deck Shuffle Style", "shufflestyle"]]))
                        .addStringOption(option => option.setName('deck').setDescription('Deck to configure').setAutocomplete(true))
                    ) 
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("flipcard")
                        .setDescription("Flip the top card of the deck")
                        .addStringOption(option => option.setName('deck').setDescription('Deck to flip from').setAutocomplete(true))
                    ) 
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("deal")
                        .setDescription("Deal cards to all players")
                        .addIntegerOption(option => option.setName('count').setDescription('Number of cards to deal each player').setRequired(true))
                        .addStringOption(option => option.setName('deck').setDescription('Deck to deal from').setAutocomplete(true))
                    )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("shuffle")
                        .setDescription("Shuffle a deck")
                        .addStringOption(option => option.setName('deck').setDescription('Deck to shuffle').setAutocomplete(true))
                    ) 
            )
            .addSubcommandGroup(group => 
                group.setName("hand").setDescription("Manage cards in your hand")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("discard")
                        .setDescription("discard a card (not shown to everyone)")
                        .addStringOption(option => option.setName('card').setDescription('Card to discard').setAutocomplete(true).setRequired(true))
                    ) 
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("show")
                        .setDescription("Shows you your current hand")
                    )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("play")
                        .setDescription("play a card")
                        .addStringOption(option => option.setName('card').setDescription('Card to play').setAutocomplete(true).setRequired(true))
                    ) 
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("reveal")
                        .setDescription("reveal a card from your hand")
                        .addStringOption(option => option.setName('card').setDescription('Card to Reveal').setAutocomplete(true).setRequired(true))
                    ) 
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("return")
                        .setDescription("return a card from your hand to the top of the draw pile")
                        .addStringOption(option => option.setName('card').setDescription('Card to return').setAutocomplete(true).setRequired(true))
                    )    
            )
            .addSubcommandGroup(group =>
                group.setName("draft").setDescription("Manage a card draft")           
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("deal")
                        .setDescription("deal cards to the draft")
                        .addIntegerOption(option => option.setName('count').setDescription('Number of cards to deal each player to draft from').setRequired(true))
                        .addStringOption(option => option.setName('deck').setDescription('Deck to deal from').setAutocomplete(true))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("take")
                        .setDescription("take a card from the draft")
                        .addStringOption(option => option.setName('card').setDescription('Card to take').setAutocomplete(true).setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("pass")
                        .setDescription("pass the draft cards to the next player (for all players!!)")
                        .addStringOption(option => option.setName('direction').setDescription('Which direction to pass ALL cards for ALL players').setRequired(true)
                        .addChoices([["Clockwise (in turn order)", "asc"], ["Counterclockwise (reverse turn order)", "desc"]]))
                )
            )                
    }

    async execute(interaction) {
        try {
            switch (interaction.options.getSubcommandGroup()) {
                case "deck":
                    switch (interaction.options.getSubcommand()) {
                        case "configure":
                            await Configure.execute(interaction, this.client)
                            break
                        case "deal":
                            await Deal.execute(interaction, this.client)
                            break
                        case "draw":
                            await Draw.execute(interaction, this.client)
                            break
                        case "flipcard":
                            await Flip.execute(interaction, this.client)
                            break
                        case "new":
                            await NewDeck.execute(interaction, this.client)
                            break
                        case "shuffle":
                            await Shuffle.execute(interaction, this.client)
                            break
                        default:
                            await interaction.reply({ content: "Command not fully written yet :(", ephemeral: true })
                    }
                    break
                case "draft":
                    switch (interaction.options.getSubcommand()) {
                        case "deal":
                            await DraftDeal.execute(interaction, this.client)
                            break
                        case "pass":
                            await DraftPass.execute(interaction, this.client)
                            break
                        case "take":
                            await DraftTake.execute(interaction, this.client)
                            break
                        default:
                            await interaction.reply({ content: "Command not fully written yet :(", ephemeral: true })
                    }
                    break
                case "hand":
                    switch (interaction.options.getSubcommand()) {
                        case "discard":
                            await Discard.execute(interaction, this.client)
                            break
                        case "show":
                            await Show.execute(interaction, this.client)
                            break
                        case "play":
                            await Play.execute(interaction, this.client)
                            break
                        case "reveal":
                            await Reveal.execute(interaction, this.client)
                            break
                        case "return":
                            await Rturn.execute(interaction, this.client)
                            break
                        default:
                            await interaction.reply({ content: "Command not fully written yet :(", ephemeral: true })
                    }
                    break
                default:
                    switch (interaction.options.getSubcommand()) {
                        case "help":
                            await Help.execute(interaction, this.client)
                            break
                        default:
                            await interaction.reply({ content: "Command not fully written yet :(", ephemeral: true })
                    }
                    break
            }

        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Cards