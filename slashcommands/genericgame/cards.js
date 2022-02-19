const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discard = require(`../../subcommands/cards/discard`)
const Draw = require(`../../subcommands/cards/draw`)
const Flip = require(`../../subcommands/cards/flip`)
const NewDeck = require(`../../subcommands/cards/newdeck`)
const Play = require(`../../subcommands/cards/play`)
const Reveal = require(`../../subcommands/cards/reveal`)
const Show = require(`../../subcommands/cards/show`)
const Shuffle = require(`../../subcommands/cards/shuffle`)

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
                                    [ "Standard 52 Card Poker Deck", "standard" ],
                                    [ "Pear/Triangle (one 1, two 2s ... ten 10s)", "pear" ],
                                    [ "Custom", "custom" ]
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
                        .setName("flipcard")
                        .setDescription("Flip the top card of the deck")
                        .addStringOption(option => option.setName('deck').setDescription('Deck to draw from').setAutocomplete(true))
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
                        .addStringOption(option => option.setName('card').setDescription('Card to play').setAutocomplete(true).setRequired(true))
                    ) 
            )                    
    }

    async execute(interaction) {
        try {
            switch (interaction.options.getSubcommand()) {
                case "discard":
                    await Discard.execute(interaction, this.client)
                    break
                case "draw":
                    await Draw.execute(interaction, this.client)
                    break
                case "flipcard":
                    await Flip.execute(interaction, this.client)
                    break
                case "show":
                    await Show.execute(interaction, this.client)
                    break
                case "new":
                    await NewDeck.execute(interaction, this.client)
                    break
                case "play":
                    await Play.execute(interaction, this.client)
                    break
                case "reveal":
                    await Reveal.execute(interaction, this.client)
                    break
                case "shuffle":
                    await Shuffle.execute(interaction, this.client)
                    break
                default:
                    await interaction.reply({ content: "Not Ready Yet!?!?!?", ephemeral: true })
            }
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Cards