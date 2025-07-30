const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('discord.js');
const GameDB = require('../../db/anygame.js')
const BuildNew = require('../../subcommands/cards/buildernew')
const BuildAdd = require('../../subcommands/cards/builderadd')
const BuildRemove = require('../../subcommands/cards/builderremove')
const Check = require('../../subcommands/cards/check')
const Configure = require('../../subcommands/cards/configuredeck')
const Deal = require('../../subcommands/cards/deal')
const Discard = require(`../../subcommands/cards/discard`)
const DiscardAll = require('../../subcommands/cards/discardall')
const DraftDeal = require(`../../subcommands/cards/draftdeal`)
const DraftPass = require(`../../subcommands/cards/draftpass`)
const DraftTake = require(`../../subcommands/cards/drafttake`)
const DraftReturn = require(`../../subcommands/cards/draftreturn`)
const Draw = require(`../../subcommands/cards/draw`)
const DrawMulti = require(`../../subcommands/cards/drawmulti`)
const Flip = require(`../../subcommands/cards/flip`)
const NewDeck = require(`../../subcommands/cards/newdeck`)
const Pick = require(`../../subcommands/cards/pick`)
const Play = require(`../../subcommands/cards/play`)
const PlayMulti = require(`../../subcommands/cards/playmulti`)
const PlaySimultaneous = require(`../../subcommands/cards/playsimultaneous`)
const Recall = require(`../../subcommands/cards/recall`)
const Reveal = require(`../../subcommands/cards/reveal`)
const Review = require(`../../subcommands/cards/review`)
const Rturn = require(`../../subcommands/cards/return`)
const Show = require(`../../subcommands/cards/show`)
const Shuffle = require(`../../subcommands/cards/shuffle`)
const SimultaneousReveal = require(`../../subcommands/cards/simultaneousreveal`)
const Steal = require('../../subcommands/cards/steal')
const Help = require('../../subcommands/cards/help')
const PlayAreaDiscard = require('../../subcommands/cards/playareadiscard') // Restoring
const PlayAreaPick = require('../../subcommands/cards/playareapick') // Restoring
const PlayAreaTake = require('../../subcommands/cards/playareatake') // Restoring
const PlayAreaGive = require('../../subcommands/cards/playareagive') // Restoring
const PlayAreaClearAll = require('../../subcommands/cards/playareaclearall')
const Burn = require('../../subcommands/cards/burn')
const DeckPeek = require('../../subcommands/cards/deckpeek')

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
        this.data.addSubcommand(subcommand =>
            subcommand
                .setName("help")
                .setDescription("Quick reference for all the /cards commands")
            )
        this.data.addSubcommandGroup(group => {
            return group.setName("deck").setDescription("Manage decks of cards")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("new")
                    .setDescription("Add a new deck of cards to the channel")
                    .addStringOption(option => option.setName('name').setDescription('Name of the deck').setRequired(true))
                    .addStringOption(option => option.setName('cardset').setDescription('What set of cards to use').setRequired(true).setAutocomplete(true))
                    .addStringOption(option => option.setName('customlist').setDescription('list of cards for the new custom deck. separate with commas'))
                ) 
            .addSubcommand(subcommand =>
                subcommand
                    .setName("check")
                    .setDescription("Check the cards in the discard pile")
                    .addStringOption(option => option.setName('deck').setDescription('Deck to check').setAutocomplete(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("draw")
                    .setDescription("Draw a card")
                    .addStringOption(option => option.setName('deck').setDescription('Deck to draw from').setAutocomplete(true))
                ) 
            .addSubcommand(subcommand =>
                subcommand
                    .setName("drawmultiple")
                    .setDescription("Draw a number of cards")
                    .addIntegerOption(option => option.setName('count').setDescription('Number of cards to draw').setRequired(true))
                    .addStringOption(option => option.setName('deck').setDescription('Deck to draw from').setAutocomplete(true))
                ) 
            .addSubcommand(subcommand =>
                subcommand
                    .setName("configure")
                    .setDescription("Configure a deck (rules etc.)")
                    .addStringOption(option => option.setName('config').setDescription('Option to configure').setRequired(true)
                        .addChoices( {name: "Deck Shuffle Style", value: "shufflestyle"},
                            {name: "Display Card Counts", value: "displaycardcounts"},
                        )   
                    )
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
                    .setName("peek")
                    .setDescription("Privately peek at the top card (or a card deeper in the deck) without removing it.")
                    .addIntegerOption(option => option.setName('depth').setDescription('How deep to peek (1 = top card)').setRequired(false).setMinValue(1))
                    .addStringOption(option => option.setName('deck').setDescription('Deck to peek at').setAutocomplete(true))
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
                    .setName("recall")
                    .setDescription("Recall all cards from this deck to start anew")
                    .addStringOption(option => option.setName('deck').setDescription('Deck to recall').setAutocomplete(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("shuffle")
                    .setDescription("Shuffle a deck")
                    .addStringOption(option => option.setName('deck').setDescription('Deck to shuffle').setAutocomplete(true))
                ) 
            .addSubcommand(subcommand =>
                subcommand
                    .setName("review")
                    .setDescription("Review all the cards available in a deck")
                    .addStringOption(option => option.setName('deck').setDescription('Deck to review').setAutocomplete(true))
                )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("pick")
                    .setDescription("Pick a card (or cards) from the discard pile")
                    .addStringOption(option => option.setName('deck').setDescription('Deck to pick from').setAutocomplete(true))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("burn")
                    .setDescription("Move a specified number of cards from the top of a deck to the discard pile without revealing them.")
                    .addIntegerOption(option =>
                        option.setName('count')
                              .setDescription('Number of cards to burn.')
                              .setRequired(true)
                              .setMinValue(1))
                    .addStringOption(option =>
                        option.setName('deck')
                              .setDescription('Deck to burn from.')
                              .setAutocomplete(true))
            );
        });
        this.data.addSubcommandGroup(group =>
            group.setName("hand").setDescription("Manage cards in your hand")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("discard")
                        .setDescription("discard a card (not shown to everyone)")
                        .addStringOption(option => option.setName('card').setDescription('Card to discard').setAutocomplete(true).setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("discardall")
                        .setDescription("Discards all cards from your hand.")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("show")
                        .setDescription("Shows your current hand and play area, including card images.")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("play")
                        .setDescription("Play a card from your hand (to discard or your play area).")
                        .addStringOption(option => option.setName('card').setDescription('Card to play').setAutocomplete(true).setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand  
                        .setName("playmultiple")
                        .setDescription("Play multiple cards from your hand (to discard or your play area).")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("playsimultaneous")
                        .setDescription("Select card(s) for simultaneous play.")
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("simultaneousreveal")
                        .setDescription("Reveal all simultaneous cards")
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
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("pass")
                        .setDescription("Pass one or more cards from your hand to another player")
                        .addUserOption(option => option.setName('target').setDescription('Player to pass cards to').setRequired(true))
                )
        );
        this.data.addSubcommandGroup(group =>
            group.setName("player").setDescription("Manage cards of other players")
            .addSubcommand(subcommand => 
                subcommand
                    .setName("steal")
                    .setDescription("Steal a random card from another player")
                    .addUserOption(option => option.setName('target').setDescription('Target Player of your steal').setRequired(true))
                )    
        );
        this.data.addSubcommandGroup(group =>
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
                    .addChoices({name: "Clockwise (in turn order)", value: "asc"},{name: "Counterclockwise (reverse turn order)", value: "desc"}))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("return")
                    .setDescription("return a card to the draft (aka un-draft a card)")
                    .addStringOption(option => option.setName('card').setDescription('Card to un-draft').setAutocomplete(true).setRequired(true))
            )
        );
        this.data.addSubcommandGroup(group =>
            group.setName("builder").setDescription("Manage a deckbuilder game") 
            .addSubcommand(subcommand =>
                subcommand
                    .setName("new")               
                    .setDescription("Create decks for each player in a deckbuilder")
                    .addStringOption(option => option.setName('basecardset').setDescription('Base set of cards for each player').setRequired(true).setAutocomplete(true))
                    .addStringOption(option => option.setName('supplyset').setDescription('General set of cards for add/remove').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("add")
                    .setDescription("Add a card to your deck")
                    .addStringOption(option => option.setName('card').setDescription('Card to add').setAutocomplete(true).setRequired(true))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("remove")
                    .setDescription("Remove a card from your deck")
                    .addStringOption(option => option.setName('card').setDescription('Card to remove').setAutocomplete(true).setRequired(true))
            )
        );
        this.data.addSubcommandGroup(group =>
            group.setName("playarea").setDescription("Manage cards in your play area")
            .addSubcommand(subcommand =>
                subcommand
                    .setName("discard")
                    .setDescription("Discard one or more cards from your play area.") // Updated description
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("pick")
                    .setDescription("Pick up one or more cards from your play area into your hand.") // Updated description
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("take")
                    .setDescription("Take one or more cards from another player's play area into yours.") // Updated description
                    .addUserOption(option => option.setName('target').setDescription('The player to take cards from').setRequired(true))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("give")
                    .setDescription("Give one or more cards from your play area to another player.") // Updated description
                    .addUserOption(option => option.setName('target').setDescription('The player to give cards to').setRequired(true))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName("clearall")
                    .setDescription("Move all cards from all play areas to the discard pile(s).")
            )
        );
    }

    async execute(interaction) {
        try {
            switch (interaction.options.getSubcommandGroup(false)) { // Added false to allow non-grouped commands like help
                case "deck":
                    switch (interaction.options.getSubcommand()) {
                        case "check":
                            await Check.execute(interaction, this.client)
                            break
                        case "configure":
                            await Configure.execute(interaction, this.client)
                            break
                        case "deal":
                            await Deal.execute(interaction, this.client)
                            break
                        case "draw":
                            await Draw.execute(interaction, this.client)
                            break
                        case "drawmultiple":
                            await DrawMulti.execute(interaction, this.client)
                            break
                        case "flipcard":
                            await Flip.execute(interaction, this.client)
                            break
                        case "new":
                            await NewDeck.execute(interaction, this.client)
                            break
                        case "pick":
                            await Pick.execute(interaction, this.client)
                            break
                        case "recall":
                            await Recall.execute(interaction, this.client)
                            break
                        case "review":
                            await Review.execute(interaction, this.client)
                            break
                        case "shuffle":
                            await Shuffle.execute(interaction, this.client)
                            break
                        case "burn":
                            await Burn.execute(interaction, this.client)
                            break
                        case "peek":
                            await DeckPeek.execute(interaction, this.client)
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
                        case "return":
                            await DraftReturn.execute(interaction, this.client)
                            break
                        default:
                            await interaction.reply({ content: "Command not fully written yet :(", ephemeral: true })
                    }
                    break
                case "player":
                    switch (interaction.options.getSubcommand()) {
                        case "steal":
                            await Steal.execute(interaction, this.client)
                            break
                        default:
                            await interaction.reply({ content: "Command not fully written yet :(", ephemeral: true })
                    }
                    break
                case "builder":
                    switch (interaction.options.getSubcommand()) {
                        case "new":
                            await BuildNew.execute(interaction, this.client)
                            break
                        case "add":
                            await BuildAdd.execute(interaction, this.client)
                            break
                        case "remove":
                            await BuildRemove.execute(interaction, this.client)
                            break
                        default:
                            await interaction.reply({ content: "Command not fully written yet :(", ephemeral: true })
                    }
                    break
                // Restoring playarea group handling
                case "playarea":
                    switch (interaction.options.getSubcommand()) {
                        case "discard":
                            await PlayAreaDiscard.execute(interaction, this.client)
                            break
                        case "pick":
                            await PlayAreaPick.execute(interaction, this.client)
                            break
                        case "take":
                            await PlayAreaTake.execute(interaction, this.client)
                            break
                        case "give":
                            await PlayAreaGive.execute(interaction, this.client)
                            break
                        case "clearall":
                            await PlayAreaClearAll.execute(interaction, this.client)
                            break
                        default:
                            await interaction.reply({ content: "Unknown playarea command.", ephemeral: true })
                    }
                    break
                case "hand":
                    switch (interaction.options.getSubcommand()) {
                        case "discard":
                            await Discard.execute(interaction, this.client)
                            break
                        case "discardall":
                            await DiscardAll.execute(interaction, this.client)
                            break
                        case "show":
                            await Show.execute(interaction, this.client)
                            break
                        case "play":
                            await Play.execute(interaction, this.client)
                            break
                        case "playmultiple":
                            await PlayMulti.execute(interaction, this.client)
                            break
                        case "playsimultaneous":
                            await PlaySimultaneous.execute(interaction, this.client)
                            break
                        case "simultaneousreveal":
                            await SimultaneousReveal.execute(interaction, this.client)
                            break
                        case "reveal":
                            await Reveal.execute(interaction, this.client)
                            break
                        case "return":
                            await Rturn.execute(interaction, this.client)
                            break
                        case "pass":
                            const Pass = require('../../subcommands/cards/pass')
                            await Pass.execute(interaction, this.client)
                            break
                        default:
                            await interaction.reply({ content: "Command not fully written yet :(", ephemeral: true })
                    }
                    break
                default: // Handles commands without a group, like /cards help
                    switch (interaction.options.getSubcommand()) {
                        case "help":
                            await Help.execute(interaction, this.client)
                            break
                        default:
                            // This case should ideally not be reached if getSubcommandGroup() is null for non-grouped commands
                            // However, if a command has no group and is not 'help', it might fall here.
                            // Or if getSubcommandGroup(false) returns null and it's not 'help'.
                            await interaction.reply({ content: "This command structure is not recognized or the command is incomplete.", ephemeral: true })
                    }
                    break
            }

        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Cards