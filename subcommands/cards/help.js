
class Help {
    async execute(interaction, client) {

        const introduction_content = `Quick rundown of the /cards comands:
• Commands are channel specific e.g. "/cards hand show" will show only the cards you have in that channel's game
• Commands that start with "/cards deck" act on a central deck of cards 
• Commands that start "/cards hand" act on the cards current in your hand.`;

        await interaction.reply({ 
            content: introduction_content,
            ephemeral: true 
        });

        const deck_commands_header = `\n**Deck Commands:**`;
        const deck_commands_content = `• **/cards deck new** - Create a new deck of cards in the channel. All cards will be shuffled into a "Draw" pile. Of note there needs to be a /game started
• **/cards deck draw** - Draw a card from a deck in the channel (if no deck is specified, will draw from first created in channel)
• **/cards deck configure** - To add special rules to a deck. *Not Avaialbe Yet*
• **/cards deck flipcard** - Flips and shows the top card of the deck. It is then added to the discard pile
• **/cards deck shuffle** - Shuffle the draw and discard piles together into a new draw pile. *Not Avaialbe Yet*`;

        await interaction.followUp({
            content: `${deck_commands_header}\n${deck_commands_content}`,
            ephemeral: true
        });

        const hand_and_game_commands_header = `\n**Hand & Game Commands:**`;
        const hand_and_game_commands_content = `• **/cards hand discard** - Puts a card from your hand into the deck's discard pile. Card is not show to other players.
• **/cards hand discardall** - Discards all cards from your hand into their respective deck's discard piles.
• **/cards hand play** - Plays a card from your hand (to discard or your play area). Card is shown to everyone as played.
• **/cards hand playmultiple** - Play multiple cards from your hand (to discard or your play area). Cards are shown to everyone.
• **/cards hand playsimultaneous** - Select card(s) for simultaneous play. Use `/cards hand simultaneousreveal` to play them.
• **/cards hand simultaneousreveal** - Reveals all cards selected by players for simultaneous play (to discard or play areas).
• **/cards hand return** - Returns a card to the top of the draw pile. Not shown to others. *Not Avaialbe Yet*
• **/cards hand reveal** - Reveals a card in your hand to other players, but card stays in your hand. *Not Avaialbe Yet*
• **/cards hand show** - Shows your current hand and play area, including card images.

• **/game status** - Current game status, including play area details, card counts, and images.

Thank you, and please let me know if I can make any of these clearer`;

        await interaction.followUp({
            content: `${hand_and_game_commands_header}\n${hand_and_game_commands_content}`,
            ephemeral: true
        });

        const play_area_commands_header = `\n**Play Area Commands:** (Used when Play Area mode is ON)`;
        const play_area_commands_content = `• **/cards playarea discard** - Discard one or more cards from your play area.
• **/cards playarea pick** - Pick up one or more cards from your play area into your hand.
• **/cards playarea take @user** - Take one or more cards from another player's play area into yours.
• **/cards playarea give @user** - Give one or more cards from your play area to another player.`;

        await interaction.followUp({
            content: `${play_area_commands_header}\n${play_area_commands_content}`,
            ephemeral: true
        });
    }
}


module.exports = new Help()